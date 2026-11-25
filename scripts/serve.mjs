// Server statico minimale per provare il sito in locale:  node scripts/serve.mjs  →  http://localhost:5173
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../site', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

http.createServer(async (req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const file = p.endsWith('\\') || p.endsWith('/') || p === ROOT ? join(p, 'index.html') : p;
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const data = await readFile(file); res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
