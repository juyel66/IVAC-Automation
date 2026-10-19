import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Simple PNG encoder in pure Node
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // CRC32
    let crc = -1;
    for (let i = 4; i < 8 + len; i++) {
      const byte = buf[i];
      crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }
    buf.writeUInt32BE((crc ^ -1) >>> 0, 8 + len);
    return buf;
  }

  // Precompute CRC table
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 per line
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // filter byte: none
    for (let x = 0; x < width; x++) {
      // Draw a rounded emerald shield badge with white accent
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.45;

      if (dist <= radius) {
        // Inner badge: emerald green gradient
        rawData[pos++] = 22;  // R
        rawData[pos++] = 197; // G
        rawData[pos++] = 94;  // B
        rawData[pos++] = 255; // A
      } else {
        // Transparent outside
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const dir = path.resolve('public/icons');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(path.join(dir, 'icon16.png'), createPng(16, 16, 22, 197, 94));
fs.writeFileSync(path.join(dir, 'icon48.png'), createPng(48, 48, 22, 197, 94));
fs.writeFileSync(path.join(dir, 'icon128.png'), createPng(128, 128, 22, 197, 94));
console.log('Icons generated successfully.');
