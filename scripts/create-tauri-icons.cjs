const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const chunkData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(chunkData), 0);
  return Buffer.concat([len, chunkData, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw RGBA scanlines with filter byte 0 at start of each line
  const raw = Buffer.alloc(height * (1 + width * 4));
  let pos = 0;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  for (let y = 0; y < height; y++) {
    raw[pos++] = 0; // filter 0
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius - 1) {
        // Blue circle #2563EB (37, 99, 235)
        raw[pos++] = 37;
        raw[pos++] = 99;
        raw[pos++] = 235;
        raw[pos++] = 255;
      } else if (dist <= radius) {
        // Antialias edge
        const alpha = Math.floor((radius - dist) * 255);
        raw[pos++] = 37;
        raw[pos++] = 99;
        raw[pos++] = 235;
        raw[pos++] = Math.max(0, Math.min(255, alpha));
      } else {
        // Transparent
        raw[pos++] = 0;
        raw[pos++] = 0;
        raw[pos++] = 0;
        raw[pos++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function generateIco(pngBuffer) {
  // Minimal ICO header containing a single PNG
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = 32; // Width
  dirEntry[1] = 32; // Height
  dirEntry[2] = 0;  // Palette count
  dirEntry[3] = 0;  // Reserved
  dirEntry.writeUInt16LE(1, 4);  // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image size in bytes
  dirEntry.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

  return Buffer.concat([header, dirEntry, pngBuffer]);
}

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const png32 = generatePng(32);
const png128 = generatePng(128);
const png256 = generatePng(256);
const ico = generateIco(png32);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), png32);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), png128);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), png256); // Fallback for icns

console.log('✅ Tauri icons successfully generated in src-tauri/icons/');
