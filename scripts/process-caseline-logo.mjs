// One-off: take the original CaseLine logo (with white background)
// and produce a transparent PNG suitable for use on the dark Hyve homepage.
//
// Strategy: walk every pixel; if it's "achromatic bright"
// (max channel > 180 AND max-min < 25 -> grey/white), set alpha to 0.
// This preserves the dark hex badge + neon green circuit lines while
// stripping the white/grey checkerboard / solid white background.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SRC = process.argv[2] ?? "C:/Users/PTMaj/Desktop/cpassessor/public/caseline logo.png";
const OUT = process.argv[3] ?? path.join(__dirname, "..", "public", "hyve-logo", "hyve-caseline-emblem.png");

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

const img  = sharp(SRC);
const meta = await img.metadata();
console.log(`source: ${SRC} (${meta.width}x${meta.height}, ${meta.channels}ch)`);

// Force to RGBA
const { data, info } = await img
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let stripped = 0;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Achromatic bright -> background
  if (max > 180 && (max - min) < 25) {
    data[i + 3] = 0;
    stripped++;
  }
}

console.log(`stripped ${stripped} background pixels of ${data.length / 4} total (${((stripped / (data.length / 4)) * 100).toFixed(1)}%)`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log(`wrote: ${OUT}`);
