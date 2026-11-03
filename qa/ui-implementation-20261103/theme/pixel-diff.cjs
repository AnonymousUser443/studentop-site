'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const here = __dirname;
function decodePng(buffer) {
  const blocks = []; let offset = 8, width, height, type;
  while (offset < buffer.length) { const n = buffer.readUInt32BE(offset), tag = buffer.toString('ascii', offset + 4, offset + 8), body = buffer.subarray(offset + 8, offset + 8 + n); if (tag === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); if (body[8] !== 8 || body[12] !== 0) throw Error('Unsupported PNG'); type = body[9]; } if (tag === 'IDAT') blocks.push(body); offset += n + 12; }
  const channels = type === 2 ? 3 : type === 6 ? 4 : 0; if (!channels) throw Error('Unsupported PNG color type ' + type);
  const packed = zlib.inflateSync(Buffer.concat(blocks)), stride = width * channels, data = Buffer.alloc(stride * height); let at = 0;
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) { const filter = packed[at++]; for (let x = 0; x < stride; x++) { const a = x >= channels ? data[y * stride + x - channels] : 0, b = y ? data[(y - 1) * stride + x] : 0, c = y && x >= channels ? data[(y - 1) * stride + x - channels] : 0; const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]; data[y * stride + x] = (packed[at++] + predictor) & 255; } }
  return { width, height, channels, data };
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(tag, data) { const name = Buffer.from(tag), bytes = Buffer.concat([name, data]); let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0); return Buffer.concat([head, bytes, tail]); }
function writePng(filename, width, height, rgb) { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; const rows = Buffer.alloc((width * 3 + 1) * height); for (let y = 0; y < height; y++) rgb.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3); fs.writeFileSync(filename, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])); }
fs.mkdirSync(path.join(here, 'diff'), { recursive: true });
const report = [];
for (const name of fs.readdirSync(path.join(here, 'before')).filter(name => name.endsWith('.png') && !name.endsWith('-background.png'))) {
  const current = path.join(here, 'after', name); if (!fs.existsSync(current)) continue;
  const before = decodePng(fs.readFileSync(path.join(here, 'before', name))), after = decodePng(fs.readFileSync(current));
  if (before.width !== after.width || before.height !== after.height) throw Error('Dimensions changed: ' + name);
  const count = before.width * before.height, rgb = Buffer.alloc(count * 3); let total = 0, changed3 = 0, changed10 = 0;
  for (let i = 0; i < count; i++) { let maximum = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(before.data[i * before.channels + c] - after.data[i * after.channels + c]); total += d; maximum = Math.max(maximum, d); } if (maximum >= 3) changed3++; if (maximum >= 10) changed10++; rgb[i * 3] = Math.min(255, maximum * 6); rgb[i * 3 + 1] = Math.min(100, maximum); }
  writePng(path.join(here, 'diff', name), before.width, before.height, rgb);
  report.push({ frame: name, width: before.width, height: before.height, meanAbsoluteRgbError: Number((total / (count * 3)).toFixed(4)), changedAtLeast3: changed3, changedAtLeast3Percent: Number((changed3 / count * 100).toFixed(3)), changedAtLeast10: changed10, changedAtLeast10Percent: Number((changed10 / count * 100).toFixed(3)) });
}
const result = { at: new Date().toISOString(), metric: 'Full-frame RGB absolute screenshot difference; changed pixel means any channel differs by >=3 or >=10 of 255. Heatmaps amplify max-channel difference x6. These independently captured paused frames show actual differences, not a zero-diff guarantee; residual ambient timing/font asset updates may contribute.', frames: report };
fs.writeFileSync(path.join(here, 'pixel-differences.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
