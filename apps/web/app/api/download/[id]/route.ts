import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getTenantId } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

function sanitizeFilename(name: string) {
  const cleaned = name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._\-äöüÄÖÜß]/g, '_')
    .replace(/_+/g, '_');
  if (!cleaned.toLowerCase().endsWith('.pdf')) return `${cleaned}.pdf`;
  return cleaned;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  const tenantId = getTenantId();
  const supabase = getSupabaseAdmin();

  const doc = await supabase
    .from('documents')
    .select('suggested_filename, storage_path')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (doc.error) {
    return new NextResponse(`DB error: ${doc.error.message}`, { status: 500 });
  }
  if (!doc.data?.storage_path) {
    return new NextResponse('Not found', { status: 404 });
  }

  const dl = await supabase.storage.from('pdfs').download(doc.data.storage_path);
  if (dl.error) {
    return new NextResponse(`Storage download failed: ${dl.error.message}`, { status: 404 });
  }

  const buf = new Uint8Array(await dl.data.arrayBuffer());
  const filename = doc.data.suggested_filename
    ? sanitizeFilename(doc.data.suggested_filename)
    : `${id}.pdf`;

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
