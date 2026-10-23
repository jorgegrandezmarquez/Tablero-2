// Servidor mínimo SOLO para ver el tablero dentro del Codespace (sin instalar nada). En su PC no hace falta:
// allí basta con hacer doble clic en index.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const puerto = process.env.PORT || 5500;
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };

// Puente a la IA: la clave sale de la variable ANTHROPIC_API_KEY de la terminal (export ...) y NUNCA llega al navegador.
function puente(req, res) {
  const clave = process.env.ANTHROPIC_API_KEY || '';
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ clave: clave.length > 10 })); }
  if (!clave) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'El servidor no tiene ANTHROPIC_API_KEY. En la terminal: export ANTHROPIC_API_KEY=... y luego bash iniciar.sh' } })); }
  const trozos = []; req.on('data', c => trozos.push(c));
  req.on('end', async () => {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' }, body: Buffer.concat(trozos) });
      res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'No se pudo llegar a api.anthropic.com: ' + e.message } })); }
  });
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/estado') || req.url.startsWith('/api/v1/messages')) return puente(req, res);
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(raiz, p));
  if (!f.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(d);
  });
}).listen(puerto, '0.0.0.0', () => console.log('Tablero en http://localhost:' + puerto));
