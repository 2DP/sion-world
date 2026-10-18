/* Optional local preview of the existing SION WORLD checkout. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const port = Number(process.env.PORT || 8134);
http.createServer((req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (route === '/sion-world') route = '/sion-world/';
    if (route.startsWith('/sion-world/')) route = route.slice('/sion-world'.length);
    if (route.endsWith('/')) route += 'index.html';
    const file = path.resolve(root, '.' + route), type = mime[path.extname(file)];
    if (!file.startsWith(root + path.sep) || !type) { res.writeHead(404); res.end('Not found'); return; }
    fs.readFile(file, (error, bytes) => {
      if (error) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    });
  } catch (_) { res.writeHead(400); res.end('Bad request'); }
}).listen(port, '127.0.0.1', () => console.log('SION WORLD: http://127.0.0.1:' + port + '/sion-world/'));
