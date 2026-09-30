// Screenshots of the shared panel in every theme, mode and view, 360px wide.
// Usage: node shoot-v2.js [theme ...]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/panel.html';
  const themes = process.argv.slice(2).length ? process.argv.slice(2) : ['drawer', 'console', 'glass'];
  const browser = await chromium.launch();
  fs.mkdirSync(path.join(ROOT, 'shots', 'v2'), { recursive: true });
  for (const theme of themes) for (const view of ['list', 'settings']) for (const mode of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + '?theme=' + theme + '&mode=' + mode + '&view=' + view);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const name = theme + '-' + view + '-' + mode;
    await page.screenshot({ path: path.join(ROOT, 'shots', 'v2', name + '.png'), fullPage: true });
    console.log(name, 'h=' + h, errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
    await page.close();
  }
  await browser.close();
  server.close();
})();
