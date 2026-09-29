import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';

// Serve the game beneath a static-host mount, without a root-level asset fallback.
// This reproduces deployment under /sion-world/example4/ as well as at /.
for (const mount of ['/', '/sion-world/example4/']) {
  test(`page and module dependencies load beneath ${mount}`, async () => {
    const root = new URL('../', import.meta.url);
    const server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith(mount)) {
        res.writeHead(404).end();
        return;
      }
      const relative = pathname.slice(mount.length) || 'index.html';
      try {
        res.end(await readFile(new URL(relative, root)));
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      for (const entry of [mount, `${mount}index.html`]) {
        const pageUrl = new URL(entry, origin);
        const page = await fetch(pageUrl);
        assert.equal(page.status, 200);
        const html = await page.text();
        const assets = [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))"/g)];
        assert.equal(assets.length, 2);
        const seen = new Set();
        async function checkAsset(url) {
          if (seen.has(url.href)) return;
          seen.add(url.href);
          const response = await fetch(url);
          assert.equal(response.status, 200, `Missing asset: ${url.pathname}`);
          const source = await response.text();
          if (url.pathname.endsWith('.js')) {
            for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
              await checkAsset(new URL(match[1], url));
            }
          }
        }
        for (const [, asset] of assets) await checkAsset(new URL(asset, pageUrl));
        assert.equal(seen.size, 2, 'CSS and the standalone game bundle load');
      }
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}
