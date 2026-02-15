'use client';

export async function renderFirstPagePng(
  file: File
): Promise<{ blob: Blob | null; error: string | null; ms: number }> {
  const started = performance.now();

  try {
    const timeoutMs = 20000;
    const timeout = new Promise<{ blob: null; error: string; ms: number }>((resolve) => {
      setTimeout(() => resolve({ blob: null, error: 'timeout', ms: performance.now() - started }), timeoutMs);
    });

    const work = (async () => {
      const arrayBuffer = await file.arrayBuffer();

      const pdfjs: any = await import('pdfjs-dist/build/pdf');

      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }

      const loadingTask = pdfjs.getDocument({ data: arrayBuffer, disableWorker: true });
      const pdf = await loadingTask.promise;

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        return { blob: null, error: 'no_canvas_context', ms: performance.now() - started };
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      return { blob, error: null, ms: performance.now() - started };
    })();

    return (await Promise.race([work, timeout])) as { blob: Blob | null; error: string | null; ms: number };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'render_failed';
    return { blob: null, error: msg, ms: performance.now() - started };
  }
}
