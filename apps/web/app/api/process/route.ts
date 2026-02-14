import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProcessResult = {
  file_id: string;
  doc_type: string;
  vendor: string;
  amount: number | null;
  currency: string;
  date: string | null;
  building_match: {
    object_number: string | null;
    matched_label: string | null;
    score: number | null;
  };
  suggested_filename: string;
  confidence: {
    doc_type: number;
    vendor: number;
    amount: number;
    building: number;
  };
  debug?: Record<string, unknown>;
};

function getTmpDir() {
  return path.join(os.tmpdir(), 'postbeschriftung');
}

function getDataPath(rel: string) {
  return path.join(process.cwd(), 'data', rel);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9äöü .\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseObjectsCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const idx = (k: string) => header.indexOf(k);

  const iObject = idx('object_number');
  const iBuilding = idx('building_name');
  const iStreet = idx('street');
  const iAliases = idx('aliases');

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const aliases = (cols[iAliases] ?? '')
      .split('|')
      .map((a) => a.trim())
      .filter(Boolean);
    return {
      object_number: (cols[iObject] ?? '').trim(),
      building_name: (cols[iBuilding] ?? '').trim(),
      street: (cols[iStreet] ?? '').trim(),
      aliases
    };
  });
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarityScore(a: string, b: string) {
  const aa = normalize(a);
  const bb = normalize(b);
  const maxLen = Math.max(aa.length, bb.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(aa, bb);
  const sim = 1 - dist / maxLen;
  return Math.max(0, Math.min(100, Math.round(sim * 100)));
}

async function loadVendorMap() {
  try {
    const raw = await fs.readFile(getDataPath('vendor_map.json'), 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function loadObjects() {
  try {
    const raw = await fs.readFile(getDataPath('objects.csv'), 'utf8');
    return parseObjectsCsv(raw);
  } catch {
    return [];
  }
}

function extractFields(text: string, vendorMap: Record<string, string>) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const head = lines.slice(0, 30).join('\n').toLowerCase();

  let doc_type = 'Dokument';
  let doc_conf = 0.3;
  if (/\brechnung\b/i.test(text)) {
    doc_type = 'Rechnung';
    doc_conf = 0.9;
  } else if (/\bangebot\b/i.test(text)) {
    doc_type = 'Angebot';
    doc_conf = 0.85;
  } else if (/\blieferschein\b/i.test(text)) {
    doc_type = 'Lieferschein';
    doc_conf = 0.85;
  }

  let vendor = 'UNK';
  let vendor_conf = 0.15;
  for (const [k, v] of Object.entries(vendorMap)) {
    if (k.toLowerCase() && head.includes(k.toLowerCase())) {
      vendor = v;
      vendor_conf = 0.85;
      break;
    }
  }

  if (vendor === 'UNK') {
    const companyHints = ['gmbh', 'ag', 'kg', 'ohg', 'gbr', 'e.v.', 'ev', 'stadtwerke', 'energie', 'gas', 'netz'];
    const pick = lines.slice(0, 30).find((l) => {
      const ll = l.toLowerCase();
      if (companyHints.some((h) => ll.includes(h))) return true;
      if (/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 .&\-]{6,}$/.test(l)) return true;
      return false;
    });
    if (pick) {
      vendor = pick.slice(0, 80);
      vendor_conf = 0.35;
    }
  }

  const parseDeAmount = (s: string) => {
    const cleaned = s
      .replace(/€/g, '')
      .replace(/EUR/gi, '')
      .replace(/[^0-9.,\-]/g, '')
      .trim();
    if (!cleaned) return null;
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const v = Number.parseFloat(normalized);
    return Number.isFinite(v) ? v : null;
  };

  const amountTriggers = [
    'gesamtbetrag',
    'rechnungsbetrag',
    'zu zahlen',
    'zahlbetrag',
    'endbetrag',
    'summe',
    'brutto',
    'gesamt',
    'betrag'
  ];
  const amountCandidates: number[] = [];
  for (const trig of amountTriggers) {
    const rx = new RegExp(
      `${trig}[^0-9]{0,60}([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2})`,
      'i'
    );
    for (const m of text.matchAll(rx)) {
      const v = m?.[1] ? parseDeAmount(m[1]) : null;
      if (v !== null) amountCandidates.push(v);
    }
  }

  let amount: number | null = null;
  let amount_conf = 0.1;
  if (amountCandidates.length) {
    amount = amountCandidates[amountCandidates.length - 1] ?? null;
    amount_conf = new Set(amountCandidates).size === 1 ? 0.9 : 0.6;
  } else {
    const rxAny = /\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/g;
    const all: number[] = [];
    for (const m of text.matchAll(rxAny)) {
      const v = parseDeAmount(m[1]);
      if (v !== null) all.push(v);
    }
    if (all.length) {
      const mx = Math.max(...all);
      amount = mx;
      amount_conf = all.filter((x) => x === mx).length === 1 ? 0.35 : 0.2;
    }
  }

  let date: string | null = null;
  let date_conf = 0.1;
  const m1 = /\b(\d{2})\.(\d{2})\.(\d{4})\b/.exec(text);
  if (m1) {
    date = `${m1[3]}-${m1[2]}-${m1[1]}`;
    date_conf = 0.75;
  } else {
    const m2 = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
    if (m2) {
      date = `${m2[1]}-${m2[2]}-${m2[3]}`;
      date_conf = 0.75;
    }
  }

  const buildingTriggers = [
    'objekt',
    'weg',
    'liegenschaft',
    'baustelle',
    'leistungsort',
    'adresse',
    'verbrauchsstelle',
    'lieferstelle',
    'lieferadresse',
    'objektnr',
    'objekt-nr'
  ];
  let building_candidate: string | null = null;
  let building_conf = 0.15;
  for (let i = 0; i < lines.length; i++) {
    const ll = lines[i].toLowerCase();
    if (buildingTriggers.some((t) => ll.includes(t))) {
      const chunk = [lines[i], lines[i + 1] ?? '', lines[i + 2] ?? '']
        .filter(Boolean)
        .join(' ')
        .slice(0, 400);
      building_candidate = chunk;
      building_conf = 0.55;
      break;
    }
  }

  return {
    doc_type,
    vendor,
    amount,
    currency: 'EUR',
    date,
    building_candidate,
    confidence: {
      doc_type: doc_conf,
      vendor: vendor_conf,
      amount: amount_conf,
      building: building_conf,
      date: date_conf
    }
  };
}

function matchBuilding(candidate: string | null, objects: Array<{ object_number: string; building_name: string; street: string; aliases: string[] }>) {
  if (!candidate) {
    return { object_number: null, matched_label: null, score: null };
  }
  const candNorm = normalize(candidate);
  if (!candNorm) {
    return { object_number: null, matched_label: null, score: null };
  }

  for (const o of objects) {
    for (const a of o.aliases) {
      const aNorm = normalize(a);
      if (aNorm && candNorm.includes(aNorm)) {
        return { object_number: o.object_number, matched_label: a, score: 100 };
      }
    }
  }

  let best = { object_number: null as string | null, matched_label: null as string | null, score: 0 };
  for (const o of objects) {
    const label = `${o.building_name} ${o.street}`.trim();
    const score = similarityScore(candNorm, label);
    if (score > best.score) {
      best = { object_number: o.object_number, matched_label: label, score };
    }
  }

  if (best.score >= 90) return best;
  return { object_number: null, matched_label: best.matched_label, score: best.score };
}

function buildFilename(fields: {
  object_number: string | null;
  date: string | null;
  doc_type: string;
  vendor: string;
  amount: number | null;
}) {
  const parts: string[] = [];
  if (fields.object_number) parts.push(fields.object_number);
  if (fields.date) parts.push(fields.date);
  parts.push(fields.doc_type || 'Dokument');
  parts.push(fields.vendor || 'UNK');
  if (typeof fields.amount === 'number') parts.push(fields.amount.toFixed(2).replace('.', ','));
  let name = parts.join('_').replace(/\s+/g, '_');
  name = name.replace(/_+/g, '_').replace(/[^a-zA-Z0-9._\-äöüÄÖÜß,]/g, '_').replace(/^_+|_+$/g, '');
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  return name;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!file || !(file instanceof File)) {
      return new NextResponse('Missing file', { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return new NextResponse('Only PDF supported', { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const dir = getTmpDir();
    await fs.mkdir(dir, { recursive: true });

    const id = crypto.randomUUID();

    const parsed = await pdfParse(bytes);
    const text = (parsed?.text ?? '').toString();

    const vendorMap = await loadVendorMap();
    const objects = await loadObjects();
    const fields = extractFields(text, vendorMap);
    const building_match = matchBuilding(fields.building_candidate, objects);
    const suggested_filename = buildFilename({
      object_number: building_match.object_number,
      date: fields.date,
      doc_type: fields.doc_type,
      vendor: fields.vendor,
      amount: fields.amount
    });

    const result: ProcessResult = {
      file_id: id,
      doc_type: fields.doc_type,
      vendor: fields.vendor,
      amount: fields.amount,
      currency: 'EUR',
      date: fields.date,
      building_match,
      suggested_filename,
      confidence: {
        doc_type: fields.confidence.doc_type,
        vendor: fields.confidence.vendor,
        amount: fields.confidence.amount,
        building: fields.confidence.building
      },
      debug: {
        text_length: text.trim().length,
        build_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        head: text
          .split(/\r?\n/)
          .slice(0, 30)
          .join(' | ')
          .slice(0, 500)
      }
    };
    const pdfPath = path.join(dir, `${id}.pdf`);
    const metaPath = path.join(dir, `${id}.json`);

    await fs.writeFile(pdfPath, bytes);
    await fs.writeFile(
      metaPath,
      JSON.stringify({ ...result, original_name: file.name }, null, 2),
      'utf8'
    );

    return NextResponse.json({ ...result, file_id: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new NextResponse(msg, { status: 500 });
  }
}
