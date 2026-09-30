// Samples the rendered background next to text in the shared panel and reports the worst contrast per selector.
// Usage: node check-contrast.js theme [theme ...]
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const SELECTORS = ['.summary', '.search input', '.f .f-l', '.f-n', '.here > span:not(.here-mark)', '.sect-h .n', '.g-status', '.g-count', '.g-hosts', '.g-preview .rt', '.g-preview .rest', '.g-task .t', '.g-stale span', '.g-age span', '.g-meta2 .live', '.g-meta2 .nopen', '.it .t', '.it .h', '.it .note span', '.it-now', '.ga span', '.btn span', '.s-l', '.s-hint', '.s-t', '.seg button', '.th-l', '.s-foot', '.keys span', '.cols span', '.g-meta span', '.g-meta b', '.taskin .k'];
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/panel.html';
  const browser = await chromium.launch();
  for (const theme of process.argv.slice(2)) for (const mode of ['light', 'dark']) for (const view of ['list', 'settings']) {
    const page = await browser.newPage({ viewport: { width: 360, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto(base + '?theme=' + theme + '&mode=' + mode + '&view=' + view);
    await page.evaluate(() => document.fonts.ready);
    // Find text boxes and their colors, then hide all text to photograph the bare background.
    const boxes = await page.evaluate((sels) => {
      const out = [];
      sels.forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') return;
        let op = 1; for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
        out.push({ sel, x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color, op });
      }));
      return out;
    }, SELECTORS);
    await page.addStyleTag({ content: '* { color: transparent !important; -webkit-text-fill-color: transparent !important; } input::placeholder { color: transparent !important; } .ic, .fav, svg { visibility: hidden !important; }' });
    const png = await page.screenshot({ fullPage: true });
    const worst = await page.evaluate(async ({ b64, boxes }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const px = (x, y) => ctx.getImageData(Math.max(0, Math.min(c.width - 1, Math.round(x))), Math.max(0, Math.min(c.height - 1, Math.round(y))), 1, 1).data;
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const res = {};
      boxes.forEach((bx) => {
        const m = bx.color.match(/[\d.]+/g).map(Number); const a = (m[3] == null ? 1 : m[3]) * bx.op;
        const pts = []; for (let i = 1; i <= 9; i++) pts.push([bx.x + bx.w * i / 10, bx.y + bx.h / 2]);
        let min = 99;
        pts.forEach(([x, y]) => { const p = px(x, y);
          const fr = m[0] * a + p[0] * (1 - a), fg = m[1] * a + p[1] * (1 - a), fb = m[2] * a + p[2] * (1 - a);
          const l1 = L(fr, fg, fb), l2 = L(p[0], p[1], p[2]); const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); if (cr < min) min = cr; });
        if (!res[bx.sel] || min < res[bx.sel]) res[bx.sel] = min;
      });
      return res;
    }, { b64: png.toString('base64'), boxes });
    const low = Object.entries(worst).filter(([, v]) => v < 4.5).map(([k, v]) => k + ' ' + v.toFixed(2));
    const min = Object.entries(worst).sort((a, b) => a[1] - b[1])[0];
    console.log(theme, mode, view, 'lowest: ' + (min ? min[0] + ' ' + min[1].toFixed(2) : '-'), low.length ? ' UNDER 4.5: ' + low.join(', ') : '');
    await page.close();
  }
  await browser.close(); server.close();
})();
