'use strict';

/**
 * Pure-Node icon generation: rasterizes A-Time's colorful timer/progress icon
 * into RGBA buffers and encodes them as PNG using only Node built-ins (zlib).
 *
 * This is used by scripts/generate-icons.js to write the app + tray icons, and
 * by the tray at runtime as a fallback if the PNG files are missing — so the
 * menu bar icon always renders even on a fresh checkout.
 */

const zlib = require('zlib');
const { DEFAULT_PALETTE } = require('../src/core/palette');

// ---- Minimal PNG encoder --------------------------------------------------

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  // Fallback CRC32 implementation.
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Encode an RGBA pixel buffer as a PNG Buffer.
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8Array} rgba length width*height*4
 */
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Add a filter byte (0 = none) at the start of each scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy
      ? rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
      : Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- Rasterization helpers ------------------------------------------------

function makeCanvas(size) {
  return { size, data: Buffer.alloc(size * size * 4) };
}

function setPixel(cv, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  // Alpha-composite over existing pixel.
  const sa = a / 255;
  const da = cv.data[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) { cv.data[i + 3] = 0; return; }
  for (let c = 0; c < 3; c++) {
    const sc = [r, g, b][c];
    const dc = cv.data[i + c];
    cv.data[i + c] = Math.round((sc * sa + dc * da * (1 - sa)) / outA);
  }
  cv.data[i + 3] = Math.round(outA * 255);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Draw a colorful segmented ring (the core timer motif) centered on the canvas.
 */
function drawRing(cv, cx, cy, outer, inner, colors, startAngle = -Math.PI / 2) {
  const n = colors.length;
  const twoPi = Math.PI * 2;
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > outer + 1 || dist < inner - 1) continue;
      // Anti-alias the inner/outer edges.
      let alpha = 1;
      if (dist > outer) alpha = Math.max(0, outer + 1 - dist);
      else if (dist < inner) alpha = Math.max(0, dist - (inner - 1));
      if (alpha <= 0) continue;
      let ang = Math.atan2(dy, dx) - startAngle;
      ang = ((ang % twoPi) + twoPi) % twoPi;
      const seg = Math.min(n - 1, Math.floor((ang / twoPi) * n));
      const [r, g, b] = hexToRgb(colors[seg]);
      setPixel(cv, x, y, r, g, b, Math.round(alpha * 255));
    }
  }
}

/** Draw a filled rounded rectangle with a vertical gradient. */
function drawRoundedGradient(cv, c1, c2, radius) {
  const s = cv.size;
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  for (let y = 0; y < s; y++) {
    const t = y / (s - 1);
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));
    for (let x = 0; x < s; x++) {
      // Rounded-corner mask.
      const inX = Math.min(x, s - 1 - x);
      const inY = Math.min(y, s - 1 - y);
      let alpha = 255;
      if (inX < radius && inY < radius) {
        const dx = radius - inX;
        const dy = radius - inY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > radius) continue;
        if (d > radius - 1) alpha = Math.round((radius - d) * 255);
      }
      setPixel(cv, x, y, r, g, b, alpha);
    }
  }
}

/** Draw a simple clock hand from center. */
function drawHand(cv, cx, cy, angle, length, width, color) {
  const [r, g, b] = hexToRgb(color);
  for (let t = 0; t <= length; t += 0.5) {
    const x = cx + Math.cos(angle) * t;
    const y = cy + Math.sin(angle) * t;
    for (let w = -width; w <= width; w++) {
      setPixel(cv, Math.round(x + Math.cos(angle + Math.PI / 2) * w),
        Math.round(y + Math.sin(angle + Math.PI / 2) * w), r, g, b, 255);
    }
  }
}

/**
 * The app icon: gradient rounded square with a colorful timer ring + hands.
 */
function drawAppIcon(size) {
  const cv = makeCanvas(size);
  drawRoundedGradient(cv, '#2B3A67', '#5B2C83', Math.round(size * 0.22));
  const cx = size / 2;
  const cy = size / 2;
  // White backing disc for contrast.
  drawRing(cv, cx, cy, size * 0.36, 0, ['#ffffff'], -Math.PI / 2);
  // Colorful segmented ring.
  drawRing(cv, cx, cy, size * 0.36, size * 0.26, DEFAULT_PALETTE);
  // Clock hands.
  drawHand(cv, cx, cy, -Math.PI / 2, size * 0.20, Math.max(1, size * 0.012), '#2B3A67');
  drawHand(cv, cx, cy, 0, size * 0.14, Math.max(1, size * 0.012), '#2B3A67');
  return cv;
}

/**
 * The tray icon: a compact colorful segmented ring (no background) so it reads
 * well in the menu bar.
 */
function drawTrayIcon(size) {
  const cv = makeCanvas(size);
  const cx = size / 2;
  const cy = size / 2;
  drawRing(cv, cx, cy, size * 0.46, size * 0.24, DEFAULT_PALETTE);
  return cv;
}

module.exports = {
  encodePNG,
  drawAppIcon,
  drawTrayIcon,
  appIconPNG: (size) => encodePNG(size, size, drawAppIcon(size).data),
  trayIconPNG: (size) => encodePNG(size, size, drawTrayIcon(size).data)
};
