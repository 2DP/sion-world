/* Optional local preview. No dependencies; binds only to this computer. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assets = { "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"], "/styles.css": ["styles.css", "text/css"], "/engine.js": ["engine.js", "text/javascript"], "/game.js": ["game.js", "text/javascript"], "/character.svg": ["character.svg", "image/svg+xml"] };
const port = Number(process.env.PORT || 8133);
http.createServer((req, res) => {
  const route = new URL(req.url, "http://localhost").pathname;
  const asset = assets[route];
  if (!asset || !["GET", "HEAD"].includes(req.method)) { res.writeHead(404); res.end("Not found"); return; }
  fs.readFile(path.join(__dirname, asset[0]), (error, data) => {
    if (error) { res.writeHead(500); res.end("Unable to load asset"); return; }
    res.writeHead(200, { "Content-Type": asset[1] + "; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}).listen(port, "127.0.0.1", () => console.log("Pastel Step: http://127.0.0.1:" + port));
