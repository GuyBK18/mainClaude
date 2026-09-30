// Side-by-side overview of the three directions, one image per color mode.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  for (const mode of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1176, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(base + 'overview.html#' + mode);
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
    await page.screenshot({ path: path.join(ROOT, 'shots', 'overview-' + mode + '.png'), fullPage: true });
    console.log('overview', mode, await page.evaluate(() => document.documentElement.scrollHeight));
    await page.close();
  }
  await browser.close();
  server.close();
})();
