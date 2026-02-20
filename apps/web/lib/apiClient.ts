import type { ProcessResult } from './types';

export async function processPdf(
  file: File,
  page1Image?: Blob | null,
  page1Error?: string | null,
  page1Ms?: number
): Promise<ProcessResult> {
  const form = new FormData();
  form.append('file', file);
  if (page1Image) {
    form.append('page1', page1Image, 'page1.png');
  }
  if (page1Error) {
    form.append('page1_error', page1Error);
  }
  if (typeof page1Ms === 'number') {
    form.append('page1_ms', String(page1Ms));
  }

  const controller = new AbortController();
  const timeoutMs = 75_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch('/api/process', {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    if (aborted) {
      throw new Error(`Timeout: Verarbeitung dauert länger als ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  return (await res.json()) as ProcessResult;
}
