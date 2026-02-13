import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? 'http://127.0.0.1:8001';

function getTmpDir() {
  return path.join(process.cwd(), '.tmp');
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

    const bytes = Buffer.from(await file.arrayBuffer());

    const upstreamForm = new FormData();
    upstreamForm.set('file', new Blob([bytes], { type: 'application/pdf' }), file.name);

    const upstreamRes = await fetch(`${OCR_SERVICE_URL}/process`, {
      method: 'POST',
      body: upstreamForm
    });

    if (!upstreamRes.ok) {
      const msg = await upstreamRes.text().catch(() => '');
      return new NextResponse(msg || `OCR service error: ${upstreamRes.status}`, {
        status: 502
      });
    }

    const result = (await upstreamRes.json()) as {
      file_id: string;
      suggested_filename: string;
      [k: string]: unknown;
    };

    const dir = getTmpDir();
    await fs.mkdir(dir, { recursive: true });

    const id = result.file_id ?? crypto.randomUUID();
    const pdfPath = path.join(dir, `${id}.pdf`);
    const metaPath = path.join(dir, `${id}.json`);

    await fs.writeFile(pdfPath, bytes);
    await fs.writeFile(metaPath, JSON.stringify({ ...result, original_name: file.name }, null, 2), 'utf8');

    return NextResponse.json({ ...result, file_id: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new NextResponse(msg, { status: 500 });
  }
}
