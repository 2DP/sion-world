'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const allowed = new Set(['index.html', 'styles.css', 'engine.js', 'charts.js', 'storage.js', 'audio.js', 'game.js', 'lumi.svg', 'cover.svg', 'tests/preview.html', 'tests/music.html', 'tests/holds.html', 'tests/audio-fixture.js']);
const port = Number(process.env.PORT || 8137);
http.createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  const file = route === '/' ? 'index.html' : route.slice(1);
  if (!allowed.has(file) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, file), (error, data) => {
    if (error) { res.writeHead(500); res.end('Unable to read asset'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Starlight Beat: http://127.0.0.1:${port}`));
