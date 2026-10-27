// Bounded container validation, not a pixel decoder. Browser compression supplies still images.
const validSize = (width, height) => Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= 64_000_000;
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(bytes) {
  if (bytes.length < 20 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return false;
  let offset = 2, dimensions = false;
  while (offset + 4 <= bytes.length - 2) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (!marker || marker === 0xd8 || marker === 0xd9 || offset + 2 > bytes.length - 2) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length - 2) return false;
    if (SOF.has(marker)) {
      if (size < 8 || !validSize(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))) return false;
      const components = bytes[offset + 7];
      if (!components || size !== 8 + 3 * components) return false;
      dimensions = true;
    }
    if (marker === 0xda) {
      const components = bytes[offset + 2];
      return dimensions && components > 0 && size === 6 + 2 * components && offset + size < bytes.length - 2;
    }
    offset += size;
  }
  return false;
}

const CRC_TABLE = new Uint32Array(256);
for (let value = 0; value < 256; value++) {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  CRC_TABLE[value] = crc >>> 0;
}
function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let offset = start; offset < end; offset++) crc = CRC_TABLE[(crc ^ bytes[offset]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function png(bytes) {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return false;
  let offset = 8, header = false, imageBytes = 0, chunks = 0;
  while (offset + 12 <= bytes.length && ++chunks <= 4096) {
    const size = bytes.readUInt32BE(offset), type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + size;
    if (end > bytes.length || !/^[A-Za-z]{4}$/.test(type) || crc32(bytes, offset + 4, end - 4) !== bytes.readUInt32BE(end - 4)) return false;
    if (type === 'IHDR') {
      if (header || offset !== 8 || size !== 13 || !validSize(bytes.readUInt32BE(offset + 8), bytes.readUInt32BE(offset + 12))) return false;
      header = true;
    } else if (!header) return false;
    if (type === 'IDAT') imageBytes += size;
    if (type === 'IEND') return header && size === 0 && imageBytes > 0 && end === bytes.length;
    offset = end;
  }
  return false;
}

function webp(bytes) {
  if (bytes.length < 26 || bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) return false;
  let offset = 12, hasPixels = false, chunks = 0;
  while (offset + 8 <= bytes.length && ++chunks <= 4096) {
    const type = bytes.subarray(offset, offset + 4).toString(), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    const end = start + size;
    if (end > bytes.length) return false;
    if (type === 'VP8 ') {
      if (size < 11 || (bytes[start] & 1) || bytes.subarray(start + 3, start + 6).toString('hex') !== '9d012a' || !validSize(bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff)) return false;
      hasPixels = true;
    } else if (type === 'VP8L') {
      if (size < 6 || bytes[start] !== 0x2f) return false;
      const bits = bytes.readUInt32LE(start + 1);
      if ((bits >>> 29) !== 0 || !validSize((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)) return false;
      hasPixels = true;
    } else if (type === 'VP8X') {
      if (size !== 10 || !validSize(bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1)) return false;
    }
    offset = end + (size & 1);
  }
  return hasPixels && offset === bytes.length;
}

function avif(bytes) {
  let boxes = 0, brand = false, dimensions = false, codec = false, pixels = false;
  function walk(start, end, parent = '') {
    let offset = start;
    while (offset + 8 <= end && ++boxes <= 4096) {
      let size = bytes.readUInt32BE(offset), header = 8;
      const type = bytes.subarray(offset + 4, offset + 8).toString();
      if (size === 1) {
        if (offset + 16 > end) return false;
        const wide = bytes.readBigUInt64BE(offset + 8);
        if (wide > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        size = Number(wide); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) return false;
      const data = offset + header, next = offset + size;
      if (type === 'ftyp' && !parent) {
        if (offset !== 0 || size < header + 8 || (size - header) % 4) return false;
        brand = ['avif', 'avis'].includes(bytes.subarray(data, data + 4).toString());
        for (let at = data + 8; at + 4 <= next; at += 4) if (['avif', 'avis'].includes(bytes.subarray(at, at + 4).toString())) brand = true;
      } else if (type === 'meta' && !parent) {
        if (next - data < 4 || !walk(data + 4, next, 'meta')) return false;
      } else if ((type === 'iprp' && parent === 'meta') || (type === 'ipco' && parent === 'iprp')) {
        if (!walk(data, next, type)) return false;
      } else if (type === 'ispe' && parent === 'ipco') {
        if (next - data < 12 || !validSize(bytes.readUInt32BE(data + 4), bytes.readUInt32BE(data + 8))) return false;
        dimensions = true;
      } else if (type === 'av1C' && parent === 'ipco') {
        if (next - data < 4 || bytes[data] !== 0x81) return false;
        codec = true;
      } else if ((type === 'mdat' && !parent) || (type === 'idat' && parent === 'meta')) pixels ||= next > data;
      offset = next;
    }
    return offset === end;
  }
  return bytes.length >= 40 && walk(0, bytes.length) && brand && dimensions && codec && pixels;
}

export function imageContainerValid(bytes, mime) {
  try { return Boolean(({ 'image/jpeg': jpeg, 'image/webp': webp, 'image/png': png, 'image/avif': avif })[mime]?.(bytes)); }
  catch { return false; }
}
