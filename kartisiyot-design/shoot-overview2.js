const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/overview2.html';
  const browser = await chromium.launch();
  for (const view of ['list', 'settings']) for (const mode of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1176, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(base + '?view=' + view + '&mode=' + mode);
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
    await page.screenshot({ path: path.join(ROOT, 'shots', 'v2', 'overview-' + view + '-' + mode + '.png'), fullPage: true });
    console.log('overview', view, mode);
    await page.close();
  }
  await browser.close(); server.close();
})();
