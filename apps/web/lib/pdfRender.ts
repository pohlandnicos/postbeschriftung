'use client';

export async function renderFirstPagePng(file: File): Promise<Blob | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer, disableWorker: true });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    return blob;
  } catch {
    return null;
  }
}
