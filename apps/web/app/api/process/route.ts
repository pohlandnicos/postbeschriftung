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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function vendorIsLikelyReceiver(vendor: string, management: string | null, accounting: string | null) {
  const v = normalize(vendor ?? '');
  if (!v) return false;
  if (v.includes('verwaltung') || v.includes('hausverwaltung')) return true;
  if (v.startsWith('weg ') || v.includes('wohnungseigent') || v.includes('eigentümergemeinschaft')) return true;
  if (v.includes('im auftrag') || v.includes('für die')) return true;
  return false;
}

function vendorLooksSuspicious(vendor: string) {
  const v = (vendor ?? '').toString().trim();
  if (!v) return true;
  if (v === 'UNK') return true;

  // Table/position headers or line-item descriptions that are frequently at the top of offers/invoices.
  const tableOrLineItemRx =
    /(\bbeschreibung\b|\bmenge\b|einzelpreis|\bmwst\b|\bust\b|\bnetto\b|\bbrutto\b|nettobetrag|bruttobetrag|\bgesamtpreis\b|\bpos\b|\bposition\b|\binkl\b|inkl\.|zzgl\.|\bau\s*und\s*abbau\b|\bauf-\s*und\s*abbau\b|\bmontage\b|\bdemontage\b|\bmaterial\b|\barbeitszeit\b|\bstunden\b|\bstk\b|\bm\s?²\b|\bm2\b)/i;
  if (tableOrLineItemRx.test(v)) return true;

  // Too sentence-like for a vendor name
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length >= 8) return true;

  const lowerLetters = (v.match(/[a-zäöüß]/g) ?? []).length;
  const upperLetters = (v.match(/[A-ZÄÖÜ]/g) ?? []).length;
  if (lowerLetters > 0 && upperLetters > 0 && lowerLetters / Math.max(1, lowerLetters + upperLetters) > 0.65) return true;

  return false;
}

function pickVendorFromHeader(text: string, management: string | null, accounting: string | null) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);

  const blockedTokens = [
    'verwaltung',
    'hausverwaltung',
    'weg',
    'wohnungseigent',
    'eigentümergemeinschaft',
    'in grund',
    'im auftrag',
    'für die',
    'kunden',
    'kundennr',
    'kundennummer'
  ];

  const tableHeaderTokens = [
    'beschreibung',
    'menge',
    'einzelpreis',
    'einzelpreisnetto',
    'mwst',
    'ust',
    'netto',
    'brutto',
    'nettobetrag',
    'bruttobetrag',
    'gesamtpreis',
    'summe',
    'pos',
    'position'
  ];

  const lineItemTokens = [
    'inkl',
    'zzgl',
    'aufbau',
    'abbau',
    'montage',
    'demontage',
    'material',
    'arbeitszeit'
  ];

  const companyHints = ['gmbh', 'ag', 'kg', 'ohg', 'gbr', 'e.v.', 'ev', 'goma'];

  const mgmtNorm = management ? normalize(management) : '';
  const accNorm = accounting ? normalize(accounting) : '';

  const candidates = lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 3 && l.length <= 80)
    .filter((l) => {
      const ll = l.toLowerCase();
      if (blockedTokens.some((t) => ll.includes(t))) return false;
      if (tableHeaderTokens.some((t) => ll.includes(t))) return false;
      if (lineItemTokens.some((t) => ll.includes(t))) return false;
      if (mgmtNorm && similarityScore(normalize(l), mgmtNorm) >= 82) return false;
      if (accNorm && similarityScore(normalize(l), accNorm) >= 82) return false;
      return true;
    })
    .map((l) => {
      const ll = l.toLowerCase();
      const hasHint = companyHints.some((h) => ll.includes(h));
      const looksLikeCompany = hasHint || /^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 .&\-]{6,}$/.test(l);
      return { l, score: (looksLikeCompany ? 10 : 0) + (hasHint ? 10 : 0) + Math.min(6, Math.floor(l.length / 12)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.l ?? null;
}

function scoreVendorCandidatesFromText(text: string) {
  const all = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const head = all.slice(0, 60);
  const foot = all.slice(Math.max(0, all.length - 90));

  const contactRx = /(www\.|https?:\/\/|@[a-z0-9\-]+\.|\btelefon\b|\btel\b|\bfax\b|\bmail\b)/i;
  const vatRx = /(ust\-?id|ust\-?idnr|umsatzsteuer\-?id|vat)\b/i;
  const ibanRx = /\biban\b|\bbic\b/i;
  const receiverTokens = /(verwaltung|hausverwaltung|eigentümergemeinschaft|wohnungseigent|\bweg\b|im auftrag|für die|kundennr|kundennummer)/i;
  const companyHints = /(gmbh|ag|kg|ohg|gbr|e\.?v\.?|ev|mbh|ug\b)/i;
  const politePhraseRx =
    /(wir bedanken|vielen dank|danke für|für (ihre|deine) anfrage|mit freundlichen grüßen|freundliche grüße|beste grüße|sehr geehrte|hiermit|anbei|bitte beachten)/i;
  const tableHeaderRx =
    /(\bbeschreibung\b|\bmenge\b|einzelpreis|\bmwst\b|\bust\b|\bnetto\b|\bbrutto\b|nettobetrag|bruttobetrag|\bgesamtpreis\b|\bpos\b|\bposition\b)/i;
  const lineItemRx = /(\binkl\b|inkl\.|zzgl\.|\bau\s*und\s*abbau\b|\bauf-\s*und\s*abbau\b|\bmontage\b|\bdemontage\b|\bmaterial\b|\barbeitszeit\b)/i;

  const windows = [head, foot];
  const makeContextFlags = (lines: string[]) => {
    const flags = new Array(lines.length).fill(0).map(() => ({ contact: false, vat: false, iban: false }));
    for (let i = 0; i < lines.length; i++) {
      const hasContact = contactRx.test(lines[i]);
      const hasVat = vatRx.test(lines[i]);
      const hasIban = ibanRx.test(lines[i]);
      for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) {
        if (hasContact) flags[j].contact = true;
        if (hasVat) flags[j].vat = true;
        if (hasIban) flags[j].iban = true;
      }
    }
    return flags;
  };

  let best: { line: string; score: number } | null = null;

  for (const lines of windows) {
    const flags = makeContextFlags(lines);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].replace(/\s+/g, ' ').trim();
      if (l.length < 3 || l.length > 80) continue;

      const words = l.split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const lowerLetters = (l.match(/[a-zäöüß]/g) ?? []).length;
      const upperLetters = (l.match(/[A-ZÄÖÜ]/g) ?? []).length;
      const hasSentencePunct = /[,:;!?]/.test(l);

      if (politePhraseRx.test(l)) continue;

      if (tableHeaderRx.test(l)) continue;

      if (lineItemRx.test(l)) continue;

      const lower = l.toLowerCase();
      if (receiverTokens.test(lower)) continue;

      if (/(grundlage|leistungen|ausführungstermin|ausfuehrungstermin|nach absprache|vob\b|angebot\s+\w+)/i.test(lower)) {
        continue;
      }

      const hasHint = companyHints.test(lower);

      // Only accept as vendor candidate if it really looks like a sender/company:
      // - legal form hint OR
      // - ALL CAPS-ish company line OR
      // - line near contact/vat/iban context (typical sender blocks)
      const allCapsish = /^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 .&\-]{6,}$/.test(l);
      const hasSenderContext = flags[i].contact || flags[i].vat || flags[i].iban;
      const looksLikeCompany = hasHint || allCapsish || hasSenderContext;
      if (!looksLikeCompany) continue;

      if (!hasHint && !allCapsish) {
        if (wordCount >= 8) continue;
        if (hasSentencePunct && wordCount >= 6) continue;
        if (lowerLetters > 0 && upperLetters > 0 && lowerLetters / Math.max(1, lowerLetters + upperLetters) > 0.55) continue;
      }

      // Avoid selecting lines that are obviously not a company name
      if (/\bwir\b|\buns\b|\bfür\b|\bihre\b/i.test(l) && !hasHint && !allCapsish) continue;

      let score = 0;
      if (hasHint) score += 18;
      score += Math.min(8, Math.floor(l.length / 10));

      if (flags[i].contact) score += 18;
      if (flags[i].vat) score += 18;
      if (flags[i].iban) score += 12;

      if (/\bangebot\b|\brechnung\b|\blieferschein\b/i.test(l)) score -= 8;

      if (!best || score > best.score) best = { line: l, score };
    }
  }

  const confidence = best ? (best.score >= 42 ? 0.85 : best.score >= 30 ? 0.7 : best.score >= 22 ? 0.55 : 0.35) : 0.15;
  return { vendor: best?.line ?? null, confidence };
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
    const tenantId = getTenantId();
    const supabase = getSupabaseAdmin();
    const res = await supabase
      .from('objects')
      .select('object_number, building_name, street, postal_code, city, management, accounting, aliases')
      .eq('tenant_id', tenantId);

    if (res.error) return [];
    return (res.data ?? []).map((r) => ({
      object_number: r.object_number,
      building_name: r.building_name ?? '',
      street: r.street ?? '',
      postal_code: r.postal_code ?? '',
      city: r.city ?? '',
      management: r.management ?? '',
      accounting: r.accounting ?? '',
      aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : []
    }));
  } catch {
    return [];
  }
}

function extractFields(text: string, vendorMap: Record<string, string>) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headRaw = lines.slice(0, 30).join('\n');
  const head = headRaw.toLowerCase();

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
  const headSenderContextRx = /(www\.|https?:\/\/|@[a-z0-9\-]+\.|\btelefon\b|\btel\b|\bfax\b|\bmail\b|ust\-?id|ust\-?idnr|umsatzsteuer\-?id|vat|\biban\b|\bbic\b)/i;
  const hasHeadSenderContext = headSenderContextRx.test(headRaw);
  for (const [k, v] of Object.entries(vendorMap)) {
    const key = (k ?? '').toString().trim().toLowerCase();
    if (!key) continue;

    const isShort = key.length <= 3;
    const rx = new RegExp(`(?:^|[^a-z0-9äöüß])${escapeRegExp(key)}(?:$|[^a-z0-9äöüß])`, 'i');
    if (!rx.test(headRaw)) continue;

    if (isShort && !hasHeadSenderContext) continue;

    vendor = v;
    vendor_conf = 0.85;
    break;
  }

  if (vendor === 'UNK') {
    const scored = scoreVendorCandidatesFromText(text);
    if (scored.vendor) {
      vendor = scored.vendor.slice(0, 80);
      vendor_conf = scored.confidence;
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
    'bauvorhaben',
    'baustelle',
    'leistungsort',
    'leistungsadresse',
    'objektadresse',
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
      const chunk = [lines[i], lines[i + 1] ?? '', lines[i + 2] ?? '', lines[i + 3] ?? '', lines[i + 4] ?? '']
        .filter(Boolean)
        .join(' ')
        .slice(0, 400);
      building_candidate = chunk;
      building_conf = 0.55;
      break;
    }
  }

  if (!building_candidate) {
    // Fallback: try to find an address-like block near the top (common for offers)
    const top = lines.slice(0, 70);
    const zipCityRx = /\b\d{5}\b\s+[A-Za-zÄÖÜäöüß\- ]{2,}/;
    const streetRx = /(straße|str\.|strasse|weg|allee|platz|gasse|ring|damm|ufer)\b/i;
    const streetCityRx = /(straße|str\.|strasse|weg|allee|platz|gasse|ring|damm|ufer)\b[^\n]{0,40}[,]\s*[A-Za-zÄÖÜäöüß\- ]{2,}/i;

    let bestAddr: string | null = null;
    for (let i = 0; i < top.length; i++) {
      const l = top[i];
      if (!streetRx.test(l)) continue;
      const next = top[i + 1] ?? '';
      const prev = top[i - 1] ?? '';
      const chunk = [prev, l, next].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (zipCityRx.test(chunk) || streetCityRx.test(chunk)) {
        bestAddr = chunk.slice(0, 400);
        break;
      }
    }

    if (bestAddr) {
      building_candidate = bestAddr;
      building_conf = 0.35;
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

function matchBuilding(
  candidate: string | null,
  objects: Array<{ object_number: string; building_name: string; street: string; postal_code: string; city: string; aliases: string[] }>
) {
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
    const streetNorm = normalize(o.street);
    const zipNorm = normalize(o.postal_code);
    const cityNorm = normalize(o.city);
    const label = `${o.building_name} ${o.street} ${o.postal_code} ${o.city}`.trim();

    let score = similarityScore(candNorm, label);
    if (streetNorm && candNorm.includes(streetNorm)) score = Math.max(score, 92);
    if (zipNorm && candNorm.includes(zipNorm) && cityNorm && candNorm.includes(cityNorm)) score = Math.max(score, 95);
    if (score > best.score) {
      best = { object_number: o.object_number, matched_label: label, score };
    }
  }

  if (best.score >= 82) return best;
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
  if (fields.date) parts.push(fields.date.replace(/\-/g, ''));
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

  if (
    /(\bbeschreibung\b|\bmenge\b|einzelpreis|\bmwst\b|\bust\b|\bnetto\b|\bbrutto\b|nettobetrag|bruttobetrag|\bgesamtpreis\b|\bpos\b|\bposition\b)/i.test(v)
  ) {
    return 'UNK';
  }

  if (/(\binkl\b|inkl\.|zzgl\.|\bau\s*und\s*abbau\b|\bauf-\s*und\s*abbau\b|\bmontage\b|\bdemontage\b|\bmaterial\b|\barbeitszeit\b)/i.test(v)) {
    return 'UNK';
  }

  if (v.split(/\s+/).filter(Boolean).length >= 10) {
    return 'UNK';
  }

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
  const safeJsonParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let obj: any = safeJsonParse(content) ?? {};
  if (!obj || typeof obj !== 'object') obj = {};
  if (Object.keys(obj).length === 0) {
    const m = content.match(/\{[\s\S]*\}/);
    const parsed = m?.[0] ? safeJsonParse(m[0]) : null;
    if (parsed && typeof parsed === 'object') obj = parsed;
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
    const startedAt = Date.now();
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

    const pdfParseStart = Date.now();
    const parsed = await pdfParse(bytes);
    const pdf_parse_ms = Date.now() - pdfParseStart;
    const text = (parsed?.text ?? '').toString();
    const pages = typeof (parsed as any)?.numpages === 'number' ? ((parsed as any).numpages as number) : null;

    const vendorMapStart = Date.now();
    const vendorMap = await loadVendorMap();
    const vendor_map_ms = Date.now() - vendorMapStart;

    const objectsStart = Date.now();
    const objects = await loadObjects();
    const objects_ms = Date.now() - objectsStart;

    const textLen = text.trim().length;
    let usedOpenAI = false;

    let vision_ms_primary: number | null = null;
    let vision_ms_building: number | null = null;
    let vision_ms_vendor: number | null = null;

    let fields = extractFields(text, vendorMap);
    const canUseOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const page1Received = page1 instanceof File;
    const page1Size = page1Received ? page1.size : 0;
    const page1ErrStr = typeof page1Error === 'string' ? page1Error : '';
    const page1MsNum = typeof page1Ms === 'string' ? Number.parseFloat(page1Ms) : null;

    if (textLen < 200 && page1Received && canUseOpenAI) {
      try {
        const imgBytes = new Uint8Array(await (page1 as File).arrayBuffer());
        const visionStart = Date.now();
        const v = await visionExtractFromImage(imgBytes);
        vision_ms_primary = Date.now() - visionStart;
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
      } catch {
        // ignore vision errors
      }
    }

    let cleanVendor = sanitizeVendor(fields.vendor);
    if (cleanVendor === 'UNK') {
      const headerPick = pickVendorFromHeader(text, null, null);
      if (headerPick) {
        cleanVendor = sanitizeVendor(headerPick);
        if (cleanVendor !== 'UNK') {
          fields = {
            ...fields,
            vendor: headerPick,
            confidence: { ...fields.confidence, vendor: Math.max(fields.confidence.vendor, 0.75) }
          };
        }
      }
    }

    let building_match = matchBuilding(fields.building_candidate, objects);
    if (!building_match.object_number && page1Received && canUseOpenAI) {
      try {
        const imgBytes = new Uint8Array(await (page1 as File).arrayBuffer());
        const visionStart = Date.now();
        const v = await visionExtractFromImage(imgBytes);
        vision_ms_building = Date.now() - visionStart;
        if (v.building_candidate) {
          const candidate = v.building_candidate;
          const retry = matchBuilding(candidate, objects);
          if (retry.object_number || (retry.score ?? 0) > (building_match.score ?? 0)) {
            usedOpenAI = true;
            fields = {
              ...fields,
              building_candidate: candidate,
              confidence: { ...fields.confidence, building: Math.max(fields.confidence.building, 0.75) }
            };
            building_match = retry;
          }
        }
      } catch {
        // ignore vision errors
      }
    }
    const matchedObject = building_match.object_number
      ? (objects as any[]).find((o) => String(o.object_number) === String(building_match.object_number))
      : null;
    const matchedManagement = typeof (matchedObject as any)?.management === 'string' ? (matchedObject as any).management : null;
    const matchedAccounting = typeof (matchedObject as any)?.accounting === 'string' ? (matchedObject as any).accounting : null;

    let finalVendor = cleanVendor;
    let finalVendorConf = fields.confidence.vendor;
    const vendorLooksWrong = vendorIsLikelyReceiver(finalVendor, matchedManagement, matchedAccounting);
    const vendorLooksBad = vendorLooksSuspicious(finalVendor);

    if ((vendorLooksWrong || vendorLooksBad || finalVendorConf < 0.5) && page1Received && canUseOpenAI) {
      try {
        const imgBytes = new Uint8Array(await (page1 as File).arrayBuffer());
        const visionStart = Date.now();
        const v = await visionExtractFromImage(imgBytes);
        vision_ms_vendor = Date.now() - visionStart;
        usedOpenAI = true;
        if (v.vendor) {
          const vv = sanitizeVendor(v.vendor);
          if (!vendorIsLikelyReceiver(vv, matchedManagement, matchedAccounting)) {
            finalVendor = vv;
            finalVendorConf = Math.max(finalVendorConf, 0.85);
          }
        }
      } catch {
        // ignore vision errors
      }
    }

    if ((vendorLooksWrong || finalVendorConf < 0.5) && finalVendor === cleanVendor) {
      const scored = scoreVendorCandidatesFromText(text);
      if (scored.vendor) {
        const vv = sanitizeVendor(scored.vendor);
        if (!vendorIsLikelyReceiver(vv, matchedManagement, matchedAccounting)) {
          finalVendor = vv;
          finalVendorConf = Math.max(finalVendorConf, scored.confidence);
        }
      }
    }

    const suggested_filename = buildFilename({
      object_number: building_match.object_number,
      date: fields.date,
      doc_type: fields.doc_type,
      vendor: finalVendor,
      amount: fields.amount
    });

    const result: ProcessResult = {
      file_id: id,
      doc_type: fields.doc_type,
      vendor: finalVendor,
      amount: fields.amount,
      currency: 'EUR',
      date: fields.date,
      building_match,
      suggested_filename,
      confidence: {
        doc_type: fields.confidence.doc_type,
        vendor: finalVendorConf,
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
        doc_type_raw: fields.doc_type,
        doc_type_conf: fields.confidence.doc_type,
        vendor_raw: fields.vendor,
        vendor_conf: fields.confidence.vendor,
        vendor_before: cleanVendor,
        vendor_after: finalVendor,
        vendor_receiver_guard: vendorLooksWrong,
        building_candidate: fields.building_candidate,
        building_score: building_match.score,
        building_object_number: building_match.object_number,
        building_matched_label: building_match.matched_label,
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

    const storageStart = Date.now();
    const up = await supabase.storage
      .from('pdfs')
      .upload(storagePath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
    const storage_ms = Date.now() - storageStart;
    if (up.error) {
      return new NextResponse(`Storage upload failed: ${up.error.message}`, { status: 500 });
    }

    const dbStart = Date.now();
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
      management: matchedManagement,
      accounting: matchedAccounting,
      confidence: result.confidence,
      debug: result.debug ?? null
    });
    const db_ms = Date.now() - dbStart;
    if (ins.error) {
      return new NextResponse(`DB insert failed: ${ins.error.message}`, { status: 500 });
    }

    const total_ms = Date.now() - startedAt;
    const debug = (result.debug ?? {}) as Record<string, unknown>;
    debug.pdf_parse_ms = pdf_parse_ms;
    debug.vendor_map_ms = vendor_map_ms;
    debug.objects_ms = objects_ms;
    if (typeof vision_ms_primary === 'number') debug.vision_ms_primary = vision_ms_primary;
    if (typeof vision_ms_building === 'number') debug.vision_ms_building = vision_ms_building;
    if (typeof vision_ms_vendor === 'number') debug.vision_ms_vendor = vision_ms_vendor;
    debug.storage_ms = storage_ms;
    debug.db_ms = db_ms;
    debug.total_ms = total_ms;
    result.debug = debug;

    return NextResponse.json({ ...result, file_id: result.file_id, pages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new NextResponse(msg, { status: 500 });
  }
}
