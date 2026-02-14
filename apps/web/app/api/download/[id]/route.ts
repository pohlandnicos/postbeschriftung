import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';

function getTmpDir() {
  return path.join(os.tmpdir(), 'postbeschriftung');
}

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
  const dir = getTmpDir();
  const pdfPath = path.join(dir, `${id}.pdf`);
  const metaPath = path.join(dir, `${id}.json`);

  try {
    const pdfBuf = await fs.readFile(pdfPath);
    const pdf = new Uint8Array(pdfBuf);

    let filename = `${id}.pdf`;
    try {
      const metaRaw = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaRaw) as { suggested_filename?: string };
      if (meta.suggested_filename) filename = sanitizeFilename(meta.suggested_filename);
    } catch {
      // ignore
    }

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
