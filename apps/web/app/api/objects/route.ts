import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getTenantId } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ObjectRow = {
  object_number: string;
  building_name?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  management?: string | null;
  accounting?: string | null;
  aliases?: string[] | null;
};

export async function GET() {
  const tenantId = getTenantId();
  const supabase = getSupabaseAdmin();

  const res = await supabase
    .from('objects')
    .select('id, object_number, building_name, street, postal_code, city, management, accounting, aliases, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('object_number', { ascending: true });

  if (res.error) {
    return new NextResponse(`DB error: ${res.error.message}`, { status: 500 });
  }

  return NextResponse.json({ items: res.data ?? [] });
}

export async function POST(req: Request) {
  const tenantId = getTenantId();
  const supabase = getSupabaseAdmin();

  let body: { items?: ObjectRow[] };
  try {
    body = (await req.json()) as any;
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const cleaned = items
    .map((it) => ({
      tenant_id: tenantId,
      object_number: String(it.object_number ?? '').trim(),
      building_name: it.building_name ?? null,
      street: it.street ?? null,
      postal_code: it.postal_code ?? null,
      city: it.city ?? null,
      management: it.management ?? null,
      accounting: it.accounting ?? null,
      aliases: Array.isArray(it.aliases) ? it.aliases.filter(Boolean) : []
    }))
    .filter((it) => Boolean(it.object_number));

  if (!cleaned.length) {
    return NextResponse.json({ upserted: 0 });
  }

  const up = await supabase
    .from('objects')
    .upsert(cleaned, { onConflict: 'tenant_id,object_number' });

  if (up.error) {
    return new NextResponse(`DB upsert failed: ${up.error.message}`, { status: 500 });
  }

  return NextResponse.json({ upserted: cleaned.length });
}
