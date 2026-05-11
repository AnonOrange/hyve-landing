// Generate PWA-required icons for the CaseLine Co-App from the
// existing caseline emblem. Targets:
//   public/caseline-co-app/icon-192.png  (Android home screen, manifest)
//   public/caseline-co-app/icon-512.png  (manifest + splash)
//   public/caseline-co-app/icon-180.png  (iOS apple-touch-icon)
//   public/caseline-co-app/icon-maskable-512.png (Android adaptive icons —
//     same artwork inset by 10% so the system can crop into a circle/squircle
//     without clipping the design)

import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SRC = path.join(__dirname, '..', 'public', 'hyve-logo', 'hyve-caseline-emblem.png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'caseline-co-app');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Dark cyan-accented background matching the desktop theme so the icon
// reads correctly on both light and dark home screens.
const bg = { r: 8, g: 7, b: 10, alpha: 1 };

async function makeIcon(size, filename, opts = {}) {
  const { inset = 0 } = opts;
  const pad = Math.round(size * inset);
  const inner = size - pad * 2;
  const innerPng = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: innerPng, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, filename));
  console.log(`  ${filename} (${size}x${size}${inset ? `, inset ${Math.round(inset * 100)}%` : ''})`);
}

await makeIcon(192, 'icon-192.png');
await makeIcon(512, 'icon-512.png');
await makeIcon(180, 'icon-180.png');                       // iOS apple-touch-icon
await makeIcon(512, 'icon-maskable-512.png', { inset: 0.10 }); // Android adaptive safe zone
console.log('done');
