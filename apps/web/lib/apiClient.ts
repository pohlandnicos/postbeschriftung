import type { ProcessResult } from './types';

export async function processPdf(file: File): Promise<ProcessResult> {
  const form = new FormData();
  form.append('file', file);

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
