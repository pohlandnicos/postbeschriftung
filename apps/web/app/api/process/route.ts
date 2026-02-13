import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? 'http://127.0.0.1:8001';

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

    const dir = getTmpDir();
    await fs.mkdir(dir, { recursive: true });

    let result: ProcessResult;
    let usedMock = false;
    try {
      const upstreamForm = new FormData();
      upstreamForm.set('file', new Blob([bytes], { type: 'application/pdf' }), file.name);

      const upstreamRes = await fetch(`${OCR_SERVICE_URL}/process`, {
        method: 'POST',
        body: upstreamForm
      });

      if (!upstreamRes.ok) {
        const msg = await upstreamRes.text().catch(() => '');
        throw new Error(msg || `OCR service error: ${upstreamRes.status}`);
      }

      result = (await upstreamRes.json()) as ProcessResult;
    } catch (e) {
      usedMock = true;
      const now = new Date();
      const iso = now.toISOString().slice(0, 10);
      const id = crypto.randomUUID();
      result = {
        file_id: id,
        doc_type: 'Dokument',
        vendor: 'DEMO',
        amount: null,
        currency: 'EUR',
        date: iso,
        building_match: {
          object_number: null,
          matched_label: null,
          score: null
        },
        suggested_filename: `DEMO_${iso}_${file.name.replace(/\s+/g, '_')}`.replace(/[^a-zA-Z0-9._\-äöüÄÖÜß]/g, '_').replace(/_+/g, '_').replace(/\.pdf$/i, '') + '.pdf',
        confidence: {
          doc_type: 0.1,
          vendor: 0.1,
          amount: 0.1,
          building: 0.1
        },
        debug: {
          mock: true,
          reason: e instanceof Error ? e.message : 'unknown'
        }
      };
    }

    const id = result.file_id ?? crypto.randomUUID();
    const pdfPath = path.join(dir, `${id}.pdf`);
    const metaPath = path.join(dir, `${id}.json`);

    await fs.writeFile(pdfPath, bytes);
    await fs.writeFile(
      metaPath,
      JSON.stringify({ ...result, original_name: file.name, used_mock: usedMock }, null, 2),
      'utf8'
    );

    return NextResponse.json({ ...result, file_id: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new NextResponse(msg, { status: 500 });
  }
}
