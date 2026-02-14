import type { ProcessResult } from './types';

export async function processPdf(file: File, page1Image?: Blob | null): Promise<ProcessResult> {
  const form = new FormData();
  form.append('file', file);
  if (page1Image) {
    form.append('page1', page1Image, 'page1.png');
  }

  const res = await fetch('/api/process', {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  return (await res.json()) as ProcessResult;
}
