// Empaqueta esta carpeta en un .zip para llevarla a su PC (sin instalar nada: solo usa Node, que ya está en el Codespace).
// Uso:  node empaquetar.mjs        ->  crea tablero-noc.zip en esta misma carpeta; luego clic derecho > Descargar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const salida = path.join(raiz, 'tablero-noc.zip');
const excluir = new Set(['node_modules', '.git', 'tablero-noc.zip']);

const tabla = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = tabla[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function* archivos(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluir.has(e.name)) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) yield* archivos(path.join(dir, e.name), r); else yield [r, path.join(dir, e.name)];
  }
}

const partes = [], central = []; let desplazamiento = 0;
const fecha = ((2026 - 1980) << 9) | (1 << 5) | 1, hora = 0;
for (const [nombre, ruta] of archivos(raiz)) {
  const datos = fs.readFileSync(ruta), n = Buffer.from(nombre, 'utf8'), crc = crc32(datos);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(hora, 10); lh.writeUInt16LE(fecha, 12);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(datos.length, 18); lh.writeUInt32LE(datos.length, 22); lh.writeUInt16LE(n.length, 26); lh.writeUInt16LE(0, 28);
  partes.push(lh, n, datos);
  const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(hora, 12); ch.writeUInt16LE(fecha, 14);
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(datos.length, 20); ch.writeUInt32LE(datos.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(desplazamiento, 42);
  central.push(ch, n);
  desplazamiento += lh.length + n.length + datos.length;
}
const tam = central.reduce((s, b) => s + b.length, 0), fin = Buffer.alloc(22);
fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(central.length / 2, 8); fin.writeUInt16LE(central.length / 2, 10); fin.writeUInt32LE(tam, 12); fin.writeUInt32LE(desplazamiento, 16);
fs.writeFileSync(salida, Buffer.concat([...partes, ...central, fin]));
console.log('Listo: ' + salida + ' (' + (fs.statSync(salida).size / 1e6).toFixed(1) + ' MB). Clic derecho sobre el archivo > Descargar. En su PC: descomprima y abra index.html.');
