// One-off (re-runnable): 256px thumbnails for the exercise guide art.
// Chips/rows render at 36-64px; decoding 1254px sources per row is what
// saturates the bitmap pipeline (gfxinfo: slow-bitmap-upload on every frame).
// Heroes keep the full-res files. Run: node scripts/gen-exercise-thumbs.mjs
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../assets/exercises/', import.meta.url));
const outDir = join(root, 'thumbs');
await mkdir(outDir, { recursive: true });

const files = (await readdir(root)).filter((f) => f.endsWith('.png') && f !== 'thumbs');
let totalIn = 0;
let totalOut = 0;
for (const f of files) {
  const src = join(root, f);
  const dst = join(outDir, f);
  const info = await sharp(src)
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(dst);
  const meta = await sharp(src).metadata();
  totalIn += info.size;
  totalOut += info.size;
  console.log(
    `${f}: ${meta.width}x${meta.height} -> ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)}KB`,
  );
}
console.log(`thumbs total: ${(totalOut / 1024).toFixed(0)}KB`);
