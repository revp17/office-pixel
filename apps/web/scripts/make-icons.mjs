// Genera los iconos de la PWA (estilo pixel-art: un edificio) sin dependencias. Uso: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [31, 41, 55, 255];
const WALL = [226, 232, 240, 255];
const WIN = [250, 204, 21, 255];
const DOOR = [59, 130, 246, 255];

/** cuadrícula 16×16 del edificio; `pad` deja margen (los iconos «maskable» recortan los bordes) */
function draw(size, pad) {
  const px = new Uint8Array(size * size * 4);
  const unit = Math.floor((size * (1 - 2 * pad)) / 16);
  const off = Math.floor((size - unit * 16) / 2);
  const set = (x, y, c) => {
    for (let j = 0; j < unit; j++)
      for (let i = 0; i < unit; i++) {
        const o = ((off + y * unit + j) * size + off + x * unit + i) * 4;
        px.set(c, o);
      }
  };
  for (let i = 0; i < size * size; i++) px.set(BG, i * 4);
  for (let y = 2; y < 15; y++) for (let x = 3; x < 13; x++) set(x, y, WALL);
  for (const y of [4, 7, 10]) for (const x of [5, 8, 11]) if (x < 12) set(x, y, WIN), set(x - 0, y + 1, WIN);
  for (let y = 12; y < 15; y++) for (let x = 7; x < 9; x++) set(x, y, DOOR);
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
function png(size, pad) {
  const raw = draw(size, pad);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    Buffer.from(raw.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), png(192, 0.06));
writeFileSync(new URL('icon-512.png', out), png(512, 0.06));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.2));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, 0.08));
console.log('iconos generados en apps/web/public');
