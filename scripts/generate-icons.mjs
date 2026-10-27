// Pure Node.js PNG generator (zero external dependencies) to produce compliant
// 192x192, 512x512, maskable 512x512, and 180x180 apple-touch-icon PNGs
// in the exact Sholo Guti Light Cream (#F5E8CF), Wood (#98643D), Emerald (#168653), and Red (#C93636) palette.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createSholoGutiPng(size, isMaskable = false) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const pad = isMaskable ? size * 0.14 : size * 0.06;

  // Helper to check distance to segment
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  const s = (v) => (v / 512) * (size - pad * 2) + pad;

  const lines = [
    [150, 84, 362, 84],
    [150, 84, 256, 168],
    [362, 84, 256, 168],
    [120, 168, 392, 168],
    [120, 344, 392, 344],
    [120, 168, 120, 344],
    [392, 168, 392, 344],
    [120, 256, 392, 256],
    [256, 84, 256, 428],
    [120, 168, 392, 344],
    [392, 168, 120, 344],
    [256, 344, 150, 428],
    [256, 344, 362, 428],
    [150, 428, 362, 428],
  ];

  const redPieces = [
    [256, 118],
    [176, 168],
    [336, 168],
  ];

  const greenPieces = [
    [176, 344],
    [336, 344],
    [256, 394],
  ];

  const pieceRadius = (26 / 512) * (size - pad * 2);
  const lineThick = Math.max(1.8, (8 / 512) * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0

    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;

      // Default Wood Frame (#98643D -> R:152, G:100, B:61)
      let r = 152;
      let g = 100;
      let b = 61;

      // Inner Cream Board (#F5E8CF -> R:245, G:232, B:207)
      if (x >= pad && x < size - pad && y >= pad && y < size - pad) {
        r = 245;
        g = 232;
        b = 207;
      }

      // Board Connection Lines (#916B43 -> R:145, G:107, B:67)
      for (const [x1, y1, x2, y2] of lines) {
        if (distToSegment(x, y, s(x1), s(y1), s(x2), s(y2)) <= lineThick / 2) {
          r = 145;
          g = 107;
          b = 67;
          break;
        }
      }

      // Center Golden Marker (#EAB308 -> R:234, G:179, B:8)
      if (Math.hypot(x - center, y - center) <= pieceRadius * 0.65) {
        r = 234;
        g = 179;
        b = 8;
      }

      // Red Pieces (#C93636 -> R:201, G:54, B:54)
      for (const [px, py] of redPieces) {
        if (Math.hypot(x - s(px), y - s(py)) <= pieceRadius) {
          r = 201;
          g = 54;
          b = 54;
        }
      }

      // Emerald Green Pieces (#168653 -> R:22, G:134, B:83)
      for (const [px, py] of greenPieces) {
        if (Math.hypot(x - s(px), y - s(py)) <= pieceRadius) {
          r = 22;
          g = 134;
          b = 83;
        }
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createSholoGutiPng(192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createSholoGutiPng(512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createSholoGutiPng(512, true));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createSholoGutiPng(180, false));
console.log('Generated all PWA and Android PNG icon assets in /public');
