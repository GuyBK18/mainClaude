// End-to-end check in a real Chromium with the extension loaded. Run: node kartisiyot-dev/tests/e2e.js
// Covers: the design and light/dark choice survive closing the panel and restarting the browser,
// groups with their status and task survive a restart, undo in the panel, and screenshots of every theme.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');

const EXT = path.resolve(__dirname, '..', '..', 'kartisiyot');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'kartisiyot-e2e-'));
let failures = 0;
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake pages with real-looking addresses and titles, so nothing goes to the network.
const TITLES = {
  'www.youtube.com/watch?v=rsc20': 'React Server Components, explained in 20 minutes - YouTube',
  'react.dev/reference/react/useEffect': 'useEffect – React',
  'react.dev/learn/thinking-in-react': 'Thinking in React – React',
  'www.geektime.co.il/react-state-management/': 'איך לנהל state בריאקט בלי לאבד את השפיות',
  'overreacted.io/a-complete-guide-to-useeffect/': 'A Complete Guide to useEffect — overreacted',
  'www.ynet.co.il/news/article/budget2027': 'הממשלה אישרה את תקציב 2027 בקריאה ראשונה',
  'www.haaretz.co.il/news/housing-law': 'מה משתנה בחוק הדיור הציבורי',
  'docs.google.com/document/d/budget-notes': 'תקציב 2027 – סיכום לפגישה',
};
const FAV = { youtube: '#ff0033', react: '#58c4dc', geektime: '#0c9d6a', overreacted: '#d23669', ynet: '#e4002b', haaretz: '#0b2545', google: '#4285f4' };
async function fakeWeb(ctx) {
  await ctx.route(/^https:\/\//, (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/favicon.svg') {
      const c = Object.keys(FAV).find((k) => u.hostname.includes(k));
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="' + (FAV[c] || '#888') + '"/></svg>' });
    }
    const key = u.host + u.pathname + u.search;
    const title = TITLES[key] || u.hostname;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>' + title + '</title><link rel="icon" href="/favicon.svg"><p>' + title });
  });
}
async function launch(extra) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chromium', headless: true, viewport: { width: 360, height: 800 }, deviceScaleFactor: 2,
    args: ['--disable-extensions-except=' + EXT, '--load-extension=' + EXT].concat(extra || []),
  });
  await fakeWeb(ctx);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  return { ctx, sw, id: new URL(sw.url()).host };
}
async function openPanel(b) {
  const page = await b.ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
  await page.goto('chrome-extension://' + b.id + '/sidepanel.html');
  await page.waitForSelector('#list .group, #list .empty');
  await page.evaluate(() => document.fonts.ready);
  page.errors = errors;
  return page;
}
const stored = (b) => b.sw.evaluate(() => chrome.storage.local.get(['groups', 'settings', 'trash']));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  let b = await launch();

  // ---------- sample data ----------
  // Pages are opened by the test browser (so the fake web answers them), then grouped by the extension's worker.
  const openAll = async (list) => { for (const u of list) { const p = await b.ctx.newPage(); await p.goto(u); } };
  const A = ['https://www.youtube.com/watch?v=rsc20', 'https://react.dev/reference/react/useEffect', 'https://react.dev/learn/thinking-in-react',
    'https://www.geektime.co.il/react-state-management/', 'https://overreacted.io/a-complete-guide-to-useeffect/'];
  const C = ['https://www.ynet.co.il/news/article/budget2027', 'https://www.haaretz.co.il/news/housing-law', 'https://docs.google.com/document/d/budget-notes'];
  await openAll(A.concat(C));
  await b.sw.evaluate(async ([A, C]) => {
    const tabs = await chrome.tabs.query({});
    const ids = (list) => list.map((u) => tabs.find((t) => t.url === u).id);
    const g1 = await chrome.tabs.group({ tabIds: ids(A) });
    await chrome.tabGroups.update(g1, { title: 'קורס React', color: 'blue' });
    const g2 = await chrome.tabs.group({ tabIds: ids(C) });
    await chrome.tabGroups.update(g2, { color: 'green' });
  }, [A, C]);
  await sleep(3500);
  const day = 864e5, now = Date.now();
  const sample = [
    { name: 'קורס React', status: 'watch', items: ['https://www.youtube.com/watch?v=rsc20', 'https://react.dev/reference/react/useEffect', 'https://react.dev/learn/thinking-in-react',
      'https://www.geektime.co.il/react-state-management/', 'https://overreacted.io/a-complete-guide-to-useeffect/'].map((url) => ({ url })).concat([{ url: 'https://nextjs.org/blog/next-16', title: 'Next.js 16' }]) },
    { name: 'Claude Code tips', color: 'purple', status: 'working', pinned: true, task: 'לאסוף את הטיפים הכי שימושיים לקובץ CLAUDE.md אחד', lastActiveAt: now - 3 * day,
      items: [{ url: 'https://www.anthropic.com/engineering/claude-code-best-practices', title: 'Claude Code: Best practices for agentic coding' },
        { url: 'https://code.claude.com/docs/en/hooks', title: 'Hooks reference' }, { url: 'https://code.claude.com/docs/en/slash-commands', title: 'Slash commands' },
        { url: 'https://www.youtube.com/watch?v=cc10tips', title: '10 Claude Code tips I wish I knew sooner - YouTube' }, { url: 'https://code.claude.com/docs/en/sub-agents', title: 'Subagents: when to use them' }] },
    { name: 'other', color: 'grey', lastActiveAt: now - 9 * day,
      items: [{ url: 'https://news.ycombinator.com/item?id=41234567', title: 'Show HN: A tiny SQLite browser in one file' }, { url: 'https://www.google.com/travel/flights/athens', title: 'טיסות לאתונה בנובמבר' },
        { url: 'https://linear.app/method', title: 'The Linear Method' }, { url: 'https://practicaltypography.com/', title: 'Practical Typography' }] },
    { name: '', color: 'cyan', status: 'watch', lastActiveAt: now - 12 * day,
      items: [{ url: 'https://www.youtube.com/watch?v=sewing', title: 'The Surprising Genius of Sewing Machines - YouTube' }, { url: 'https://www.youtube.com/watch?v=aircAruvnKk', title: 'But what is a neural network? - YouTube' }] },
    { name: 'מתכונים', color: 'orange', status: 'read', lastActiveAt: now - 36 * day,
      items: [{ url: 'https://www.10dakot.co.il/recipe/shakshuka', title: 'שקשוקה של פעם, בדיוק כמו אצל סבתא' }, { url: 'https://www.seriouseats.com/focaccia', title: 'The Best Focaccia' },
        { url: 'https://www.foody.co.il/foody_recipe/spinach-pie', title: 'פשטידת תרד וגבינות בלי קמח' }] },
  ];
  const page0 = await openPanel(b);
  const msg = (m) => page0.evaluate((mm) => chrome.runtime.sendMessage(mm), m);
  const imp = await msg({ type: 'importData', mode: 'merge', groups: sample });
  check(imp && imp.ok && imp.added === 4 && imp.joined === 1, 'sample data imported (4 new, 1 merged into the open group)');
  let data = await stored(b);
  const react = data.groups.find((g) => g.name === 'קורס React');
  await msg({ type: 'setItemNote', id: react.id, itemId: react.items[0].id, note: 'לחזור לדקה 12, החלק על streaming' });
  await msg({ type: 'setItemTitle', id: react.id, itemId: react.items[1].id, title: 'התיעוד של useEffect' });
  await msg({ type: 'setTask', id: react.id, task: '' });
  data = await stored(b);
  check(data.groups.length === 6, 'six groups stored (' + data.groups.length + ')');
  check(data.groups.filter((g) => g.chromeGroupId != null).length === 2, 'two groups open in Chrome');
  check(react.items.some((i) => i.url.includes('next-16') && i.tabId == null), 'the merged link sits in the open group as not open');
  await page0.close();

  // ---------- panel: undo ----------
  let page = await openPanel(b);
  check(page.errors.length === 0, 'panel loads without errors ' + page.errors.join(' | '));
  await page.click('[data-gid="' + react.id + '"] .g-head');
  const firstItem = '[data-gid="' + react.id + '"] .it:nth-child(3)';
  await page.hover(firstItem);
  await page.click(firstItem + ' [data-act="doneItem"]');
  await page.waitForSelector('#toast:not([hidden]) [data-act="undo"]');
  data = await stored(b);
  check(data.groups.find((g) => g.id === react.id).items.length === 5, 'done removes the item');
  await page.click('#toast [data-act="undo"]');
  await sleep(2500);
  data = await stored(b);
  check(data.groups.find((g) => g.id === react.id).items.length === 6, 'undo brings it back');

  // ---------- screenshots of the finished panel ----------
  for (const theme of ['drawer', 'console', 'glass']) for (const mode of ['light', 'dark']) {
    await page.evaluate((s) => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign({}, r.settings, s) })), { theme, mode });
    await sleep(350);
    await page.evaluate(() => { document.getElementById('toast').hidden = true; });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(SHOTS, 'final-' + theme + '-' + mode + '.png'), fullPage: true });
  }
  await page.click('#btnSettings');
  await sleep(200);
  await page.screenshot({ path: path.join(SHOTS, 'final-glass-dark-settings.png'), fullPage: true });

  // ---------- check 1: the design and mode stay after closing the panel ----------
  await page.click('[data-act="setTheme"][data-val="console"]');
  await page.click('[data-act="setMode"][data-val="dark"]');
  await page.close();
  page = await openPanel(b);
  let look = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.mode]);
  check(look[0] === 'console' && look[1] === 'dark', 'after closing and reopening the panel: ' + look.join('/'));
  await page.close();

  // ---------- check 2: a browser restart keeps groups, status, task, design and mode ----------
  const before = await stored(b);
  await b.ctx.close();
  b = await launch(['--restore-last-session']);
  await sleep(7000);
  page = await openPanel(b);
  look = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.mode]);
  check(look[0] === 'console' && look[1] === 'dark', 'after a browser restart the design and mode stay: ' + look.join('/'));
  const after = await stored(b);
  check(after.groups.length === before.groups.length, 'same number of groups after restart (' + before.groups.length + ' -> ' + after.groups.length + ')');
  const tips = after.groups.find((g) => g.name === 'Claude Code tips');
  check(tips && tips.status === 'working' && tips.task.startsWith('לאסוף') && tips.pinned, 'status, task and pin survive the restart');
  const r2 = after.groups.filter((g) => g.name === 'קורס React');
  check(r2.length === 1 && r2[0].chromeGroupId != null, 'the open group came back linked, not duplicated');
  check(r2[0] && r2[0].items.some((i) => i.note), 'item notes survive the restart');
  check(page.errors.length === 0, 'no errors after restart ' + page.errors.join(' | '));
  await b.ctx.close();
  fs.rmSync(PROFILE, { recursive: true, force: true });
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('E2E CRASHED:', e); process.exit(2); });
