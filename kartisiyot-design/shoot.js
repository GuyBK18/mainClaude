// Screenshots every mockup at 360px wide, light and dark, through a tiny local server
// (fonts don't load from file:// pages).
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
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ['a-index', 'b-console', 'c-catalog'];
  const browser = await chromium.launch();
  for (const name of names) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'he-IL' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(base + name + '.html');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight));
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: path.join(ROOT, 'shots', name + '-' + scheme + '.png') });
      await page.screenshot({ path: path.join(ROOT, 'shots', name + '-' + scheme + '-full.png'), fullPage: true });
      console.log(name, scheme, 'height=' + height, 'fonts=' + [...new Set(fonts)].join(', '), errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
})();
