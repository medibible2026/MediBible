// Draws MediBible's app icons (no image libraries needed) into public/icons/.
// Run once after changing the design: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { root } from './lib/stepbible.mjs';

const ACCENT = [138, 59, 30];
const PAGE = [248, 241, 230];
const LINE = [214, 186, 160];

/** Shape tests in unit coordinates (0..1). maskable: full-bleed background, artwork kept in the safe zone. */
function colourAt(x, y, maskable) {
  const inRoundedSquare = (r) => {
    const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  if (!maskable && !inRoundedSquare(0.22)) return null; // transparent corners
  // Artwork scaled into the centre (maskable icons may be cropped to a circle).
  const s = maskable ? 0.72 : 0.9;
  const u = (x - 0.5) / s + 0.5, v = (y - 0.5) / s + 0.5;
  const rect = (x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
  // Cross above the book
  if (rect(0.465, 0.1, 0.535, 0.36) || rect(0.39, 0.17, 0.61, 0.235)) return PAGE;
  // Open book: two pages with a spine gap, slightly raised outer corners
  const lift = Math.abs(u - 0.5) * 0.12;
  const top = 0.42 - lift, bottom = 0.8 - lift * 0.4;
  const onPage = (u >= 0.17 && u <= 0.485) || (u >= 0.515 && u <= 0.83);
  if (onPage && v >= top && v <= bottom) {
    // Text lines on each page
    for (const ly of [0.52, 0.6, 0.68]) {
      const lt = ly - lift * 0.8;
      const lineX = (u >= 0.22 && u <= 0.44) || (u >= 0.56 && u <= 0.78);
      if (lineX && v >= lt && v <= lt + 0.028) return LINE;
    }
    return PAGE;
  }
  return ACCENT;
}

function png(size, maskable) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colourAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, maskable);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const n = SS * SS;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = join(root, 'public', 'icons');
mkdirSync(dir, { recursive: true });
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false],
]) {
  writeFileSync(join(dir, name), png(size, maskable));
  console.log('wrote', name);
}
