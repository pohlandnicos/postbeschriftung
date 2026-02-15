import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const destDir = path.join(root, 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

const candidates = [
  path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'),
  path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js'),
  path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js')
];

try {
  await fs.mkdir(destDir, { recursive: true });
  let copied = false;
  for (const src of candidates) {
    try {
      await fs.copyFile(src, dest);
      copied = true;
      break;
    } catch {
      // ignore
    }
  }
  if (!copied) {
    throw new Error('pdf.js worker not found in node_modules/pdfjs-dist');
  }
  // eslint-disable-next-line no-console
  console.log(`Copied pdf.js worker to ${dest}`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Failed to copy pdf.js worker:', e);
  process.exit(0);
}
