import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const src = path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js');
const destDir = path.join(root, 'public');
const dest = path.join(destDir, 'pdf.worker.min.js');

try {
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(src, dest);
  // eslint-disable-next-line no-console
  console.log(`Copied pdf.js worker to ${dest}`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Failed to copy pdf.js worker:', e);
  process.exit(0);
}
