import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function iconSvg(size) {
  const pad = size * 0.16;
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const s = inner / 24;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <g transform="translate(${cx - 12 * s}, ${cy - 12 * s}) scale(${s})"
     fill="none" stroke="#ffffff" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="4"/>
    <line x1="6" y1="12" x2="10" y2="12"/>
    <line x1="8" y1="10" x2="8" y2="14"/>
    <circle cx="15" cy="13" r="0.9" fill="#ffffff" stroke="none"/>
    <circle cx="18" cy="11" r="0.9" fill="#ffffff" stroke="none"/>
  </g>
</svg>`;
}

const targets = [
  { path: "src/app/icon.png", size: 512 },
  { path: "src/app/apple-icon.png", size: 180 },
  { path: "public/icon-192.png", size: 192 },
  { path: "public/icon-512.png", size: 512 },
];

for (const { path, size } of targets) {
  const outPath = root + path;
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(iconSvg(size))).png().toFile(outPath);
  console.log(`Erstellt: ${path} (${size}x${size})`);
}
