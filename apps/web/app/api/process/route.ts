import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse';
import OpenAI from 'openai';
import { getSupabaseAdmin, getTenantId } from '@/lib/supabaseServer';

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

type VisionExtract = {
  doc_type?: string;
  vendor?: string;
  amount?: number | null;
  currency?: string;
  date?: string | null;
  building_candidate?: string | null;
};

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
      'ig'
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

function sanitizeVendor(raw: string) {
  let v = (raw ?? '').toString().trim();
  if (!v) return 'UNK';

  v = v.replace(/\s+/g, ' ').trim();

  const parts = v.split(/\s*[|·•]\s*/g);
  v = parts[0] ?? v;

  const cutTokens = [
    'straße',
    'str.',
    'strasse',
    'weg',
    'allee',
    'platz',
    'gasse',
    'haus',
    'postfach',
    'plz',
    'd-',
    'de-',
    'deutschland'
  ];
  const lower = v.toLowerCase();

  let cutAt = -1;
  for (const t of cutTokens) {
    const idx = lower.indexOf(t);
    if (idx !== -1) cutAt = cutAt === -1 ? idx : Math.min(cutAt, idx);
  }
  const mZip = lower.search(/\b\d{5}\b/);
  if (mZip !== -1) cutAt = cutAt === -1 ? mZip : Math.min(cutAt, mZip);

  if (cutAt !== -1) v = v.slice(0, cutAt).trim();

  v = v.replace(/[,:;\-]+\s*$/g, '').trim();
  if (!v) return 'UNK';
  return v.slice(0, 80);
}

function parseNumberMaybe(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v
      .replace(/€/g, '')
      .replace(/EUR/gi, '')
      .replace(/[^0-9.,\-]/g, '')
      .trim();
    if (!cleaned) return null;
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function visionExtractFromImage(imageBytes: Uint8Array): Promise<VisionExtract> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {};
  }

  const client = new OpenAI({ apiKey });
  const b64 = Buffer.from(imageBytes).toString('base64');

  const prompt =
    'Du extrahierst aus einer deutschen Rechnung/Schlussrechnung Felder als JSON. ' +
    'Gib NUR gültiges JSON zurück, ohne Markdown. Felder: ' +
    '{ doc_type, vendor, amount, currency, date, building_candidate }. ' +
    'doc_type z.B. Rechnung/Angebot/Lieferschein/Dokument. ' +
    'amount als Zahl (deutsches Format erkannt), currency meist EUR. ' +
    'date als ISO YYYY-MM-DD falls erkennbar. building_candidate: Adresse/WEG/Verbrauchsstelle/Objekt-Text.';

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${b64}` }
          }
        ]
      }
    ]
  });

  const content = resp.choices?.[0]?.message?.content ?? '';
  let obj: any = {};
  try {
    obj = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m?.[0]) obj = JSON.parse(m[0]);
  }

  return {
    doc_type: typeof obj.doc_type === 'string' ? obj.doc_type : undefined,
    vendor: typeof obj.vendor === 'string' ? obj.vendor : undefined,
    amount: parseNumberMaybe(obj.amount),
    currency: typeof obj.currency === 'string' ? obj.currency : undefined,
    date: typeof obj.date === 'string' ? obj.date : null,
    building_candidate:
      typeof obj.building_candidate === 'string' ? obj.building_candidate : null
  };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const page1 = form.get('page1');
    const page1Error = form.get('page1_error');
    const page1Ms = form.get('page1_ms');

    if (!file || !(file instanceof File)) {
      return new NextResponse('Missing file', { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return new NextResponse('Only PDF supported', { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const id = crypto.randomUUID();

    const parsed = await pdfParse(bytes);
    const text = (parsed?.text ?? '').toString();
    const pages = typeof (parsed as any)?.numpages === 'number' ? ((parsed as any).numpages as number) : null;

    const vendorMap = await loadVendorMap();
    const objects = await loadObjects();

    const textLen = text.trim().length;
    let usedOpenAI = false;

    let fields = extractFields(text, vendorMap);
    const canUseOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const page1Received = page1 instanceof File;
    const page1Size = page1Received ? page1.size : 0;
    const page1ErrStr = typeof page1Error === 'string' ? page1Error : '';
    const page1MsNum = typeof page1Ms === 'string' ? Number.parseFloat(page1Ms) : null;

    if (textLen < 200 && page1Received && canUseOpenAI) {
      const imgBytes = new Uint8Array(await (page1 as File).arrayBuffer());
      const v = await visionExtractFromImage(imgBytes);
      usedOpenAI = true;

      fields = {
        ...fields,
        doc_type: v.doc_type ?? fields.doc_type,
        vendor: v.vendor ?? fields.vendor,
        amount: v.amount ?? fields.amount,
        currency: v.currency ?? fields.currency,
        date: v.date ?? fields.date,
        building_candidate: v.building_candidate ?? fields.building_candidate,
        confidence: {
          doc_type: v.doc_type ? 0.85 : fields.confidence.doc_type,
          vendor: v.vendor ? 0.85 : fields.confidence.vendor,
          amount: typeof v.amount === 'number' ? 0.85 : fields.confidence.amount,
          building: v.building_candidate ? 0.75 : fields.confidence.building,
          date: v.date ? 0.75 : (fields.confidence as any).date
        }
      };
    }
    const cleanVendor = sanitizeVendor(fields.vendor);
    const building_match = matchBuilding(fields.building_candidate, objects);
    const suggested_filename = buildFilename({
      object_number: building_match.object_number,
      date: fields.date,
      doc_type: fields.doc_type,
      vendor: cleanVendor,
      amount: fields.amount
    });

    const result: ProcessResult = {
      file_id: id,
      doc_type: fields.doc_type,
      vendor: cleanVendor,
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
        text_length: textLen,
        used_openai: usedOpenAI,
        openai_available: canUseOpenAI,
        page1_received: page1Received,
        page1_size: page1Size,
        page1_error: page1ErrStr,
        page1_ms: page1MsNum,
        build_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        head: text
          .split(/\r?\n/)
          .slice(0, 30)
          .join(' | ')
          .slice(0, 500)
      }
    };

    const tenantId = getTenantId();
    const supabase = getSupabaseAdmin();
    const storagePath = `original/${result.file_id}.pdf`;

    const up = await supabase.storage
      .from('pdfs')
      .upload(storagePath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
    if (up.error) {
      return new NextResponse(`Storage upload failed: ${up.error.message}`, { status: 500 });
    }

    const ins = await supabase.from('documents').insert({
      id: result.file_id,
      tenant_id: tenantId,
      user_id: null,
      original_filename: file.name,
      suggested_filename: result.suggested_filename,
      storage_path: storagePath,
      pages,
      doc_type: result.doc_type,
      vendor: result.vendor,
      amount: result.amount,
      currency: result.currency,
      date: result.date,
      object_number: result.building_match.object_number,
      matched_label: result.building_match.matched_label,
      match_score: result.building_match.score,
      confidence: result.confidence,
      debug: result.debug ?? null
    });
    if (ins.error) {
      return new NextResponse(`DB insert failed: ${ins.error.message}`, { status: 500 });
    }

    return NextResponse.json({ ...result, file_id: result.file_id, pages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new NextResponse(msg, { status: 500 });
  }
}
