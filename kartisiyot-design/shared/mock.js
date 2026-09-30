// Shared sample data, icons and helpers for the three design mockups.
// Every mockup renders exactly this data, so the directions can be compared fairly.

var SAMPLE = {
  activeUrl: 'https://www.youtube.com/watch?v=rsc20',
  groups: [
    {
      id: 'g1', name: 'קורס React', color: 'blue', live: true, status: 'watch', task: '', pinned: false, days: 0,
      items: [
        { title: 'React Server Components, explained in 20 minutes - YouTube', url: 'https://www.youtube.com/watch?v=rsc20', note: 'לחזור לדקה 12, החלק על streaming', active: true },
        { title: 'useEffect – React', customTitle: 'התיעוד של useEffect', url: 'https://react.dev/reference/react/useEffect' },
        { title: 'Thinking in React', url: 'https://react.dev/learn/thinking-in-react', hover: true },
        { title: 'איך לנהל state בריאקט בלי לאבד את השפיות', url: 'https://www.geektime.co.il/react-state-management/' },
        { title: 'A Complete Guide to useEffect', url: 'https://overreacted.io/a-complete-guide-to-useeffect/' },
        { title: 'Next.js 16', url: 'https://nextjs.org/blog/next-16', notOpen: true }
      ]
    },
    {
      id: 'g2', name: '', color: 'green', live: true, status: 'none', task: '', pinned: false, days: 0,
      items: [
        { title: 'הממשלה אישרה את תקציב 2027 בקריאה ראשונה', url: 'https://www.ynet.co.il/news/article/budget2027' },
        { title: 'מה משתנה בחוק הדיור הציבורי', url: 'https://www.haaretz.co.il/news/housing-law' },
        { title: 'תקציב 2027 – סיכום לפגישה', url: 'https://docs.google.com/document/d/budget-notes' }
      ]
    },
    {
      id: 'g3', name: 'Claude Code tips', color: 'purple', live: false, status: 'working', pinned: true, days: 3,
      task: 'לאסוף את הטיפים הכי שימושיים לקובץ CLAUDE.md אחד',
      items: [
        { title: 'Claude Code: Best practices for agentic coding', url: 'https://www.anthropic.com/engineering/claude-code-best-practices' },
        { title: 'Hooks reference', url: 'https://code.claude.com/docs/en/hooks' },
        { title: 'Slash commands', url: 'https://code.claude.com/docs/en/slash-commands' },
        { title: '10 Claude Code tips I wish I knew sooner - YouTube', url: 'https://www.youtube.com/watch?v=cc10tips' },
        { title: 'Subagents: when to use them', url: 'https://code.claude.com/docs/en/sub-agents' }
      ]
    },
    {
      id: 'g5', name: 'other', color: 'grey', live: false, status: 'none', task: '', pinned: false, days: 9,
      items: [
        { title: 'Show HN: A tiny SQLite browser in one file', url: 'https://news.ycombinator.com/item?id=41234567' },
        { title: 'טיסות לאתונה בנובמבר', url: 'https://www.google.com/travel/flights/athens' },
        { title: 'The Linear Method', url: 'https://linear.app/method' },
        { title: 'איך לבחור מקלדת מכנית - YouTube', url: 'https://www.youtube.com/watch?v=keyboards' },
        { title: 'Practical Typography', url: 'https://practicaltypography.com/' },
        { title: 'The Mac apps I use every day - YouTube', url: 'https://www.youtube.com/watch?v=macapps' },
        { title: 'איך לגבות את התמונות מהאייפון', url: 'https://support.apple.com/he-il/108782' }
      ]
    },
    {
      id: 'g6', name: '', color: 'cyan', live: false, status: 'watch', task: '', pinned: false, days: 12,
      items: [
        { title: 'The Surprising Genius of Sewing Machines - YouTube', url: 'https://www.youtube.com/watch?v=sewing' },
        { title: 'But what is a neural network? - YouTube', url: 'https://www.youtube.com/watch?v=aircAruvnKk' },
        { title: 'עמוס עוז על כתיבה – הרצאה - YouTube', url: 'https://www.youtube.com/watch?v=amosoz' }
      ]
    },
    {
      id: 'g4', name: 'מתכונים', color: 'orange', live: false, status: 'read', task: '', pinned: false, days: 36,
      items: [
        { title: 'שקשוקה של פעם, בדיוק כמו אצל סבתא', url: 'https://www.10dakot.co.il/recipe/shakshuka' },
        { title: 'The Best Focaccia', url: 'https://www.seriouseats.com/focaccia' },
        { title: 'פשטידת תרד וגבינות בלי קמח', url: 'https://www.foody.co.il/foody_recipe/spinach-pie' },
        { title: 'Chocolate Babka', url: 'https://cooking.nytimes.com/recipes/babka' }
      ]
    }
  ]
};

var STATUS = {
  none: 'ללא סטטוס', watch: 'לצפייה', read: 'לקריאה', skim: 'למעבר', working: 'בעבודה', archive: 'ארכיון'
};

var FILTERS = [
  { key: 'all', label: 'הכול', n: 6 },
  { key: 'live', label: 'פתוחות', n: 2 },
  { key: 'watch', label: 'לצפייה', n: 2 },
  { key: 'read', label: 'לקריאה', n: 1 },
  { key: 'skim', label: 'למעבר', n: 0 },
  { key: 'working', label: 'בעבודה', n: 1 },
  { key: 'task', label: 'עם משימה', n: 2 },
  { key: 'old', label: 'ישנות', n: 1 },
  { key: 'archive', label: 'ארכיון', n: 0 }
];

// Chrome's tab group colors, light and dark.
var GROUP_COLORS = {
  grey:   ['#5f6368', '#dadce0'], blue:   ['#1a73e8', '#8ab4f8'], red:    ['#d93025', '#f28b82'],
  yellow: ['#e8a700', '#fdd663'], green:  ['#1e8e3e', '#81c995'], pink:   ['#d01884', '#ff8bcb'],
  purple: ['#9334e6', '#d7aefb'], cyan:   ['#007b83', '#78d9ec'], orange: ['#e8710a', '#fcad70']
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}
function displayTitle(it) {
  if (it.customTitle) return it.customTitle;
  return it.title.replace(/\s*-\s*YouTube$/, '');
}
function topHosts(g, n) {
  var seen = [];
  g.items.forEach(function (it) { var h = hostOf(it.url); if (seen.indexOf(h) < 0) seen.push(h); });
  return seen.slice(0, n || 2);
}
// Age line. Hebrew duals where Hebrew uses them.
function ageText(days) {
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  if (days < 14) return 'לפני ' + days + ' ימים';
  var w = Math.round(days / 7);
  if (w === 2) return 'לפני שבועיים';
  if (days < 60) return 'לפני ' + w + ' שבועות';
  var m = Math.round(days / 30);
  return m === 2 ? 'לפני חודשיים' : 'לפני ' + m + ' חודשים';
}
function staleText(days) {
  var w = Math.round(days / 7);
  return 'לא נפתחה כבר ' + (w === 2 ? 'שבועיים' : w + ' שבועות');
}
function isStale(g) { return !g.live && g.days >= 14; }
// Wrap user text so its direction never leaks into the surrounding Hebrew.
function bdi(s, cls) { return '<bdi' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(s) + '</bdi>'; }
// A line of user text that may be cut with an ellipsis. dir=auto makes an English title
// lose its end, not its start. The CSS keeps it flush right with text-align: right.
function line(s, cls) { return '<span class="' + (cls || 't') + '" dir="auto">' + esc(s) + '</span>'; }
// Item titles run together on one line: up to two, each cut with its own ellipsis
// (so an English title loses its end, not its start), then "ועוד N".
function runon(g, max, noRest) {
  max = max || 2;
  var shown = g.items.slice(0, max).map(function (it) { return '<span class="rt" dir="auto">' + esc(displayTitle(it)) + '</span>'; });
  var rest = g.items.length - shown.length;
  return shown.join('<span class="sep"></span>') + (rest > 0 && !noRest ? '<span class="rest">ועוד ' + rest + '</span>' : '');
}

// ---------- icons (24x24, stroke) ----------
var ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronStart: '<path d="m9 6 6 6-6 6"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  note: '<path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  move: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5H5V6h5"/>',
  window: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9h18"/>',
  closeSave: '<path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9"/>',
  merge: '<path d="M7 4v5a5 5 0 0 0 5 5h7M16 11l3 3-3 3M7 20v-3"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  book: '<path d="M3.5 5.5H9a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5h-6zM20.5 5.5H15a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5h6z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  half: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  dashed: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3.3"/>',
  box: '<path d="M3.5 5h17v4h-17zM5.5 9v10h13V9M10 13h4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chat: '<path d="M4 5h16v11H10l-6 4z"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="m7 9.5 3 2.5-3 2.5M12.5 15H17"/>',
  corner: '<path d="M6 4v6a4 4 0 0 0 4 4h9M16 11l3 3-3 3"/>',
  arrowUp: '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
  enter: '<path d="M19 5v6a3 3 0 0 1-3 3H5M9 10l-4 4 4 4"/>',
  ribbon: '<path d="M7 3h10v18l-5-3.5L7 21z" fill="currentColor" stroke="none"/>',
  stack: '<path d="m12 4 9 4.5-9 4.5-9-4.5z"/><path d="m3 13 9 4.5 9-4.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  cmd: '<path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9h11A2.5 2.5 0 1 0 15 6.5v11a2.5 2.5 0 1 0 2.5-2.5h-11A2.5 2.5 0 1 0 9 17.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  optKey: '<path d="M4 7h5l6 10h5M14 7h6"/>',
  shiftKey: '<path d="M12 4.5 20 12.5h-4.5V19h-7v-6.5H4z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
function icon(name, size, cls) {
  var s = size || 16;
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
}

// ---------- stand-in favicons (the real panel uses Chrome's own favicon cache) ----------
var FAV = {
  'youtube.com': '<rect x="0" y="2.5" width="16" height="11" rx="3" fill="#ff0033"/><path d="M6.5 5.5v5l4.3-2.5z" fill="#fff"/>',
  'react.dev': '<circle cx="8" cy="8" r="8" fill="#23272f"/><ellipse cx="8" cy="8" rx="5.6" ry="2.2" fill="none" stroke="#58c4dc" stroke-width="1"/><ellipse cx="8" cy="8" rx="5.6" ry="2.2" fill="none" stroke="#58c4dc" stroke-width="1" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="5.6" ry="2.2" fill="none" stroke="#58c4dc" stroke-width="1" transform="rotate(-60 8 8)"/><circle cx="8" cy="8" r="1.2" fill="#58c4dc"/>',
  'geektime.co.il': '<rect width="16" height="16" rx="3" fill="#0c9d6a"/><circle cx="8" cy="8" r="3.2" fill="none" stroke="#fff" stroke-width="1.8"/>',
  'overreacted.io': '<circle cx="8" cy="8" r="8" fill="#d23669"/><circle cx="8" cy="8" r="3" fill="#ffd8e4"/>',
  'nextjs.org': '<circle cx="8" cy="8" r="8" fill="#000"/><path d="M5.5 5v6M5.5 5l5.5 7M10.5 5v3.5" stroke="#fff" stroke-width="1.3" fill="none"/>',
  'ynet.co.il': '<rect width="16" height="16" rx="2" fill="#e4002b"/><path d="M4.5 5l3.5 4 3.5-4M8 9v3.5" stroke="#fff" stroke-width="1.6" fill="none"/>',
  'haaretz.co.il': '<rect width="16" height="16" rx="2" fill="#0b2545"/><path d="M4 5h8M4 8h8M4 11h5" stroke="#fff" stroke-width="1.3"/>',
  'docs.google.com': '<path d="M3 1h7l3.5 3.5V15H3z" fill="#4285f4"/><path d="M5.5 8h5M5.5 10.5h5M5.5 13h3" stroke="#fff" stroke-width="1.1"/>',
  'anthropic.com': '<rect width="16" height="16" rx="3" fill="#191919"/><path d="M5 12 8 4l3 8M6.2 9h3.6" stroke="#f0eee6" stroke-width="1.4" fill="none"/>',
  'code.claude.com': '<rect width="16" height="16" rx="3" fill="#d97757"/><path d="M8 3.2v9.6M3.2 8h9.6M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  'news.ycombinator.com': '<rect width="16" height="16" fill="#ff6600"/><path d="M5 4l3 4.5L11 4M8 8.5V12.5" stroke="#fff" stroke-width="1.6" fill="none"/>',
  'google.com': '<circle cx="8" cy="8" r="8" fill="#fff"/><path d="M8 0a8 8 0 0 1 8 8H8z" fill="#ea4335"/><path d="M16 8a8 8 0 0 1-8 8V8z" fill="#34a853"/><path d="M8 16A8 8 0 0 1 0 8h8z" fill="#fbbc05"/><path d="M0 8a8 8 0 0 1 8-8v8z" fill="#4285f4"/><circle cx="8" cy="8" r="3.2" fill="#fff"/>',
  'linear.app': '<circle cx="8" cy="8" r="8" fill="#5e6ad2"/><path d="M4 9.5 9.5 4M5.5 12 12 5.5" stroke="#fff" stroke-width="1.3"/>',
  'practicaltypography.com': '<rect width="16" height="16" rx="2" fill="#2d2d2d"/><path d="M4.5 4.5h7M8 4.5v7.5" stroke="#fff" stroke-width="1.6"/>',
  'support.apple.com': '<circle cx="8" cy="8" r="8" fill="#a2aaad"/><circle cx="8" cy="9" r="3.5" fill="#fff"/>',
  '10dakot.co.il': '<rect width="16" height="16" rx="3" fill="#f28c28"/><circle cx="8" cy="8" r="4" fill="none" stroke="#fff" stroke-width="1.6"/>',
  'seriouseats.com': '<circle cx="8" cy="8" r="8" fill="#c8102e"/><path d="M5 10.5c1 1.2 5 1.2 6 0M5.5 6.5h5" stroke="#fff" stroke-width="1.4" fill="none"/>',
  'foody.co.il': '<circle cx="8" cy="8" r="8" fill="#7ab648"/><path d="M5.5 11c0-4 2-6 5-6.5-.5 3-2 5.5-5 6.5z" fill="#fff"/>',
  'cooking.nytimes.com': '<rect width="16" height="16" rx="2" fill="#121212"/><path d="M4.5 5h7M8 5v7" stroke="#fff" stroke-width="1.8"/>'
};
function fav(url, size) {
  var s = size || 16;
  var body = FAV[hostOf(url)] || '<rect width="16" height="16" rx="3" fill="#888"/>';
  return '<svg class="fav" width="' + s + '" height="' + s + '" viewBox="0 0 16 16" aria-hidden="true">' + body + '</svg>';
}

function statusIcon(status) {
  return { none: 'dashed', watch: 'eye', read: 'book', skim: 'bolt', working: 'half', archive: 'box' }[status];
}
