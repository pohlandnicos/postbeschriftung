import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getTenantId } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnalyticsRow = {
  id: string;
  created_at: string;
  suggested_filename: string | null;
  original_filename: string | null;
  vendor: string | null;
  doc_type: string | null;
  pages: number | null;
  object_number: string | null;
};

type ObjectFacetRow = {
  object_number: string;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  management: string | null;
  accounting: string | null;
};

function safeKey(s: unknown, fallback: string) {
  const v = typeof s === 'string' ? s.trim() : '';
  return v || fallback;
}

function isoDay(s: string) {
  // expects ISO timestamp
  return s.slice(0, 10);
}

function parseRange(params: URLSearchParams): { from: Date | null; to: Date | null; label: string } {
  const range = (params.get('range') ?? '30d') as '7d' | '30d' | '90d' | 'all';
  const fromParam = params.get('from');
  const toParam = params.get('to');

  const to = toParam ? new Date(toParam) : null;
  const from = fromParam ? new Date(fromParam) : null;

  if (fromParam || toParam) {
    return {
      from: from && Number.isFinite(from.getTime()) ? from : null,
      to: to && Number.isFinite(to.getTime()) ? to : null,
      label: 'custom'
    };
  }

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  if (range === 'all') return { from: null, to: end, label: 'all' };

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  return { from: start, to: end, label: range };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = getTenantId();
  const supabase = getSupabaseAdmin();

  const objectNumber = searchParams.get('object_number');
  const docType = searchParams.get('doc_type');
  const vendor = searchParams.get('vendor');
  const employee = searchParams.get('employee');

  const { from, to, label: rangeLabel } = parseRange(searchParams);

  // facets
  const objectsRes = await supabase
    .from('objects')
    .select('object_number, street, postal_code, city, management, accounting')
    .eq('tenant_id', tenantId)
    .order('object_number', { ascending: true });

  if (objectsRes.error) {
    return new NextResponse(`DB error(objects): ${objectsRes.error.message}`, { status: 500 });
  }

  const objectLabelByNumber = new Map<string, string>();
  const employeesByObject = new Map<string, { management: string | null; accounting: string | null }>();
  for (const o of (objectsRes.data ?? []) as unknown as ObjectFacetRow[]) {
    const street = typeof o.street === 'string' ? o.street.trim() : '';
    const pc = typeof o.postal_code === 'string' ? o.postal_code.trim() : '';
    const city = typeof o.city === 'string' ? o.city.trim() : '';
    const parts = [street, [pc, city].filter(Boolean).join(' ')].filter(Boolean);
    const key = String(o.object_number);
    objectLabelByNumber.set(key, parts.join(', '));
    employeesByObject.set(key, {
      management: typeof o.management === 'string' ? o.management.trim() || null : null,
      accounting: typeof o.accounting === 'string' ? o.accounting.trim() || null : null
    });
  }

  // documents (bounded)
  let q = supabase
    .from('documents')
    .select('id, created_at, suggested_filename, original_filename, vendor, doc_type, pages, object_number')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (from) q = q.gte('created_at', from.toISOString());
  if (to) q = q.lte('created_at', to.toISOString());
  if (objectNumber) q = q.eq('object_number', objectNumber);
  if (docType) q = q.eq('doc_type', docType);
  if (vendor) q = q.eq('vendor', vendor);

  const docsRes = await q;
  if (docsRes.error) {
    return new NextResponse(`DB error(documents): ${docsRes.error.message}`, { status: 500 });
  }

  let docs = (docsRes.data ?? []) as AnalyticsRow[];

  if (employee) {
    const empNorm = employee.trim().toLowerCase();
    docs = docs.filter((d) => {
      const obj = d.object_number ? String(d.object_number) : '';
      const emps = obj ? employeesByObject.get(obj) : null;
      const mgmt = (emps?.management ?? '').toLowerCase();
      const acc = (emps?.accounting ?? '').toLowerCase();
      return mgmt === empNorm || acc === empNorm;
    });
  }

  const byType = new Map<string, number>();
  const byVendor = new Map<string, number>();
  const byObject = new Map<string, number>();
  const byDay = new Map<string, number>();
  const byEmployee = new Map<string, number>();
  const matrix = new Map<string, { total: number; byType: Map<string, number> }>();

  let totalPages = 0;
  let pagesKnown = 0;

  for (const d of docs) {
    const t = safeKey(d.doc_type, 'Unbekannt');
    const v = safeKey(d.vendor, 'UNK');
    const o = safeKey(d.object_number, '—');

    const objKey = d.object_number ? String(d.object_number) : '';
    const emps = objKey ? employeesByObject.get(objKey) : null;
    const employeeNames = [emps?.management, emps?.accounting].filter((x): x is string => typeof x === 'string' && Boolean(x.trim()));

    byType.set(t, (byType.get(t) ?? 0) + 1);
    byVendor.set(v, (byVendor.get(v) ?? 0) + 1);
    byObject.set(o, (byObject.get(o) ?? 0) + 1);

    for (const en of employeeNames) {
      const key = en.trim();
      byEmployee.set(key, (byEmployee.get(key) ?? 0) + 1);
    }

    const day = d.created_at ? isoDay(d.created_at) : 'unknown';
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    if (typeof d.pages === 'number') {
      totalPages += d.pages;
      pagesKnown += 1;
    }

    const entry = matrix.get(o) ?? { total: 0, byType: new Map<string, number>() };
    entry.total += 1;
    entry.byType.set(t, (entry.byType.get(t) ?? 0) + 1);
    matrix.set(o, entry);
  }

  const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const topVendors = [...byVendor.entries()].sort((a, b) => b[1] - a[1]);
  const topObjects = [...byObject.entries()].sort((a, b) => b[1] - a[1]);
  const topEmployees = [...byEmployee.entries()].sort((a, b) => b[1] - a[1]);

  // series for charts: ensure continuous days for preset ranges
  const now = new Date();
  const endDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const series: [string, number][] = [];
  if (rangeLabel === '7d' || rangeLabel === '30d' || rangeLabel === '90d') {
    const days = rangeLabel === '7d' ? 7 : rangeLabel === '30d' ? 30 : 90;
    const start = new Date(endDay.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    for (let t = start.getTime(); t <= endDay.getTime(); t += 24 * 60 * 60 * 1000) {
      const d = new Date(t).toISOString().slice(0, 10);
      series.push([d, byDay.get(d) ?? 0]);
    }
  } else {
    const keys = [...byDay.keys()].sort();
    for (const k of keys) series.push([k, byDay.get(k) ?? 0]);
  }

  // UI facets (sorted)
  const facetDocTypes = [...new Set(topTypes.map(([k]) => k))];
  const facetVendors = [...new Set(topVendors.map(([k]) => k))];
  const facetEmployees = [...new Set(topEmployees.map(([k]) => k))];
  const facetObjects = topObjects.map(([k, cnt]) => ({
    object_number: k === '—' ? null : k,
    label: k === '—' ? 'Ohne Objekt' : objectLabelByNumber.get(k) ?? '',
    count: cnt
  }));

  const recent = docs.slice(0, 50).map((d) => ({
    id: d.id,
    created_at: d.created_at,
    suggested_filename: d.suggested_filename ?? d.original_filename ?? d.id,
    vendor: d.vendor ?? 'UNK',
    doc_type: d.doc_type ?? 'Unbekannt',
    pages: d.pages,
    object_number: d.object_number
  }));

  const matrixOut = [...matrix.entries()].map(([obj, v]) => ({
    object_number: obj === '—' ? null : obj,
    label: obj === '—' ? 'Ohne Objekt' : objectLabelByNumber.get(obj) ?? '',
    total: v.total,
    by_type: Object.fromEntries([...v.byType.entries()].sort((a, b) => b[1] - a[1]))
  }));

  return NextResponse.json({
    meta: {
      range: rangeLabel,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      limited_to: 5000
    },
    totals: {
      documents: docs.length,
      total_pages: totalPages,
      pages_known: pagesKnown,
      unique_objects: new Set(docs.map((d) => safeKey(d.object_number, '—'))).size
    },
    facets: {
      objects: facetObjects,
      doc_types: facetDocTypes,
      vendors: facetVendors,
      employees: facetEmployees
    },
    top: {
      by_type: topTypes.slice(0, 12).map(([k, v]) => ({ key: k, count: v })),
      by_vendor: topVendors.slice(0, 12).map(([k, v]) => ({ key: k, count: v })),
      by_employee: topEmployees.slice(0, 12).map(([k, v]) => ({ key: k, count: v }))
    },
    series,
    matrix: matrixOut,
    recent
  });
}
