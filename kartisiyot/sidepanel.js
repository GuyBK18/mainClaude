// כרטיסיות - חלונית הצד
// מבנה אחד לכל שלושת העיצובים. העיצוב מתחלף רק ב-CSS (data-theme, data-mode על html).
'use strict';

var STATUS = { none: 'ללא סטטוס', watch: 'לצפייה', read: 'לקריאה', skim: 'למעבר', working: 'בעבודה', archive: 'ארכיון' };
var STATUS_ICON = { none: 'dashed', watch: 'eye', read: 'book', skim: 'bolt', working: 'half', archive: 'box' };
var FILTERS = [['all', 'הכול'], ['live', 'פתוחות'], ['watch', 'לצפייה'], ['read', 'לקריאה'], ['skim', 'למעבר'],
  ['working', 'בעבודה'], ['task', 'עם משימה'], ['old', 'ישנות'], ['archive', 'ארכיון']];
var FILTER_ICON = { watch: 'eye', read: 'book', skim: 'bolt', working: 'half', task: 'note', old: 'clock', archive: 'box' };
var COLORS = {
  grey: ['#5f6368', '#dadce0'], blue: ['#1a73e8', '#8ab4f8'], red: ['#d93025', '#f28b82'], yellow: ['#e8a700', '#fdd663'],
  green: ['#1e8e3e', '#81c995'], pink: ['#d01884', '#ff8bcb'], purple: ['#9334e6', '#d7aefb'], cyan: ['#007b83', '#78d9ec'], orange: ['#e8710a', '#fcad70']
};
var DEFAULTS = { theme: 'drawer', mode: 'system', chatTarget: 'app', codeTarget: 'app', codeFolder: '', staleDays: 14, lastExport: null };
var APP_LIMIT = 14000;   // אפליקציית קלוד חותכת בערך ב-14,000 תווים
var WEB_LIMIT = 7000;    // אורך הקישור המקודד לאתר

var ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
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
  arrowUp: '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
  enter: '<path d="M19 5v6a3 3 0 0 1-3 3H5M9 10l-4 4 4 4"/>',
  cmd: '<path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9h11A2.5 2.5 0 1 0 15 6.5v11a2.5 2.5 0 1 0 2.5-2.5h-11A2.5 2.5 0 1 0 9 17.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  optKey: '<path d="M4 7h5l6 10h5M14 7h6"/>',
  shiftKey: '<path d="M12 4.5 20 12.5h-4.5V19h-7v-6.5H4z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  layers: '<path d="m12 4 9 4.5-9 4.5-9-4.5z"/><path d="m3 13 9 4.5 9-4.5"/>'
};
function icon(name, size) {
  var s = size || 16;
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

// ---------- מצב ----------
var S = { groups: [], trash: [], settings: Object.assign({}, DEFAULTS), activeTab: null };
var ui = {
  view: 'list', expanded: new Set(), filter: 'all', query: '', editing: null, showExtra: false,
  order: null, lastUndo: null, pending: false, drag: null
};
var cards = new Map();   // מזהה קבוצה -> { sig, el }
var mq = matchMedia('(prefers-color-scheme: dark)');
var $ = function (id) { return document.getElementById(id); };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return String(url || ''); } }
function pageKey(url) {
  var u;
  try { u = new URL(url); } catch (e) { return String(url || ''); }
  u.hash = '';
  var host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' && u.pathname === '/watch') return 'yt:' + u.searchParams.get('v');
  if (host === 'youtu.be') return 'yt:' + u.pathname.slice(1);
  u.searchParams.delete('t');
  var q = u.searchParams.toString();
  return u.protocol + '//' + host + u.pathname.replace(/\/$/, '') + (q ? '?' + q : '');
}
// כותרת לתצוגה: שם הסרטון ביוטיוב, כותרת הדף באתרים אחרים, או הכותרת שהמשתמש כתב
function displayTitle(it) {
  if (it.customTitle) return it.customTitle;
  var host = hostOf(it.url);
  var t = String(it.title || '').trim().replace(/^\(\d+\+?\)\s*/, '');
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) t = t.replace(/\s*[-–]\s*YouTube$/i, '');
  return !t || t === it.url ? host : t;
}
function favicon(url, size) {
  return '<img class="fav" alt="" width="' + size + '" height="' + size + '" src="' + esc(chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=32')) + '">';
}
function isLive(g) { return g.chromeGroupId != null; }
function daysSince(ts) { return Math.floor((Date.now() - (ts || Date.now())) / 864e5); }
function isStale(g) { return !isLive(g) && g.status !== 'archive' && daysSince(g.lastActiveAt) >= (S.settings.staleDays || 14); }
function ago(ts) {
  var d = daysSince(ts);
  if (d <= 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d === 2) return 'לפני יומיים';
  if (d < 14) return 'לפני ' + d + ' ימים';
  var w = Math.round(d / 7);
  if (d < 60) return w === 2 ? 'לפני שבועיים' : 'לפני ' + w + ' שבועות';
  var m = Math.round(d / 30);
  return m === 2 ? 'לפני חודשיים' : 'לפני ' + m + ' חודשים';
}
function staleText(g) { return 'לא נפתחה כבר ' + ago(g.lastActiveAt).replace('לפני ', ''); }
function gc(g) { return (COLORS[g.color] || COLORS.grey)[document.documentElement.dataset.mode === 'dark' ? 1 : 0]; }
function topHosts(g) {
  var seen = [];
  g.items.forEach(function (it) { var h = hostOf(it.url); if (seen.indexOf(h) < 0) seen.push(h); });
  return seen.slice(0, 2).join(', ');
}
function hasTask(g) { return !!(g.task || '').trim() || g.items.some(function (it) { return it.note; }); }

function send(msg) {
  return chrome.runtime.sendMessage(msg).then(function (r) {
    if (!r || !r.ok) throw new Error((r && r.error) || 'הפעולה נכשלה. נסה שוב.');
    return r;
  });
}
function act(msg) { return send(msg).catch(function (e) { toast(e.message); return null; }); }

// ---------- הודעה עם ביטול ----------
var toastTimer = null;
function toast(text, trashId) {
  var el = $('toast');
  el.innerHTML = '<span>' + esc(text) + '</span>' + (trashId ? '<button type="button" data-act="undo" data-trash="' + esc(trashId) + '">' + icon('undo', 14) + 'ביטול</button>' : '');
  el.hidden = false;
  if (trashId) ui.lastUndo = trashId;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.hidden = true; }, trashId ? 8000 : 3500);
}
function undo(trashId) {
  if (!trashId) return;
  $('toast').hidden = true;
  if (ui.lastUndo === trashId) ui.lastUndo = null;
  act({ type: 'restore', trashId: trashId }).then(function (r) { if (r) toast('שוחזר'); });
}

// ---------- מראה ----------
function effectiveMode() { var m = S.settings.mode; return m === 'dark' || (m === 'system' && mq.matches) ? 'dark' : 'light'; }
function applyLook() {
  var root = document.documentElement;
  root.dataset.theme = ['drawer', 'console', 'glass'].indexOf(S.settings.theme) >= 0 ? S.settings.theme : 'drawer';
  root.dataset.mode = effectiveMode();
  try { localStorage.setItem('look', JSON.stringify({ theme: root.dataset.theme, mode: root.dataset.mode })); } catch (e) {}
  var live = S.groups.filter(isLive);
  root.style.setProperty('--amb-1', live[0] ? gc(live[0]) : '#8a8f99');
  root.style.setProperty('--amb-2', live[1] ? gc(live[1]) : (live[0] ? gc(live[0]) : '#8a8f99'));
  var dark = root.dataset.mode === 'dark';
  $('btnMode').innerHTML = icon(dark ? 'sun' : 'moon', 17);
  $('btnMode').title = dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה';
  $('btnMode').setAttribute('aria-label', $('btnMode').title);
}
function saveSettings(patch) {
  S.settings = Object.assign({}, S.settings, patch);
  applyLook();
  return chrome.storage.local.set({ settings: S.settings });
}

// ---------- סינון ומיון ----------
function matchesFilter(g, f) {
  if (f === 'archive') return g.status === 'archive';
  if (g.status === 'archive') return false;
  if (f === 'all') return true;
  if (f === 'live') return isLive(g);
  if (f === 'task') return hasTask(g);
  if (f === 'old') return isStale(g);
  return g.status === f;
}
// null אם הקבוצה לא מתאימה לחיפוש, אחרת הפריטים להצגה
function searchResult(g) {
  var q = ui.query.trim().toLowerCase();
  if (!q) return g.items;
  var hit = function (s) { return String(s || '').toLowerCase().indexOf(q) >= 0; };
  if (hit(g.name) || hit(g.task) || hit(STATUS[g.status])) return g.items;
  var items = g.items.filter(function (it) { return hit(displayTitle(it)) || hit(it.url) || hit(it.note); });
  return items.length ? items : null;
}
// הסדר של השמורות קבוע כל עוד החלונית פתוחה, כדי שכרטיס לא יקפוץ מתחת לעכבר
function savedOrder(list) {
  var byActivity = function (a, b) { return (b.lastActiveAt || 0) - (a.lastActiveAt || 0); };
  if (!ui.order) ui.order = S.groups.filter(function (g) { return !isLive(g); }).sort(byActivity).map(function (g) { return g.id; });
  var known = new Set(ui.order);
  var fresh = list.filter(function (g) { return !known.has(g.id); }).map(function (g) { return g.id; });
  if (fresh.length) ui.order = fresh.concat(ui.order);
  var pos = new Map(ui.order.map(function (id, i) { return [id, i]; }));
  return list.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (pos.get(a.id) - pos.get(b.id)); });
}

// ---------- ציור ----------
function runon(items) {
  var shown = items.slice(0, 2).map(function (it) { return '<span class="rt" dir="auto">' + esc(displayTitle(it)) + '</span>'; });
  var rest = items.length - shown.length;
  return shown.join('<span class="sep"></span>') + (rest > 0 ? '<span class="rest">ועוד ' + rest + '</span>' : '');
}
function nameHTML(g, dupName) {
  if (ui.editing === 'g:' + g.id) return '<input class="edit g-edit" dir="auto" value="' + esc(g.name) + '" placeholder="שם לקבוצה" aria-label="שם הקבוצה">';
  if (!g.name) return '<span class="g-un">ללא שם</span><span class="g-hosts" dir="ltr">' + esc(topHosts(g)) + '</span>';
  return '<span class="g-name" dir="auto" title="לחיצה כפולה לשינוי השם">' + esc(g.name) + '</span>' +
    (dupName ? '<span class="g-hosts" dir="ltr">' + esc(topHosts(g)) + '</span>' : '');
}
function itemHTML(g, it, ctx) {
  var active = S.activeTab && it.tabId != null && it.tabId === S.activeTab.id;
  var notOpen = isLive(g) && it.tabId == null;
  var dupIn = ctx.urlGroups.get(pageKey(it.url)) || [];
  var others = dupIn.filter(function (x) { return x !== g; });
  var cls = 'it' + (active ? ' active' : '') + (notOpen ? ' notopen' : '') + (others.length ? ' dup' : '');
  var title = ui.editing === 'i:' + it.id
    ? '<input class="edit i-edit" dir="auto" value="' + esc(displayTitle(it)) + '" placeholder="' + esc(it.title || hostOf(it.url)) + '" aria-label="כותרת לפריט">'
    : '<span class="t" dir="auto">' + esc(displayTitle(it)) + '</span>';
  var note = ui.editing === 'n:' + it.id
    ? '<div class="note">' + icon('note', 13) + '<input class="edit n-edit" dir="auto" value="' + esc(it.note) + '" placeholder="מה לעשות עם הפריט הזה" aria-label="הערה לפריט"></div>'
    : it.note ? '<div class="note" data-act="noteItem">' + icon('note', 13) + '<span dir="auto">' + esc(it.note) + '</span></div>' : '';
  var dupTitle = others.length ? 'שמור גם ב־' + others.map(function (x) { return x.name || 'קבוצה ללא שם'; }).join(', ') : '';
  return '<li class="' + cls + '" data-iid="' + it.id + '" data-nav tabindex="0" draggable="true" title="' + esc(it.url) + '">' +
    '<span class="it-fav">' + favicon(it.url, 16) + (others.length ? '<span class="dupmark" title="' + esc(dupTitle) + '">' + icon('layers', 12) + '</span>' : '') + '</span>' +
    '<span class="it-main">' + title + (notOpen ? '<span class="h">לא פתוח</span>' : '<span class="h" dir="ltr">' + esc(hostOf(it.url)) + '</span>') + '</span>' +
    (active ? '<span class="it-now">הלשונית הפעילה</span>' : '') +
    '<span class="acts">' +
    '<button type="button" data-act="renameItem" title="שינוי כותרת" aria-label="שינוי כותרת">' + icon('pencil', 14) + '</button>' +
    '<button type="button" data-act="noteItem" title="הערה" aria-label="הערה">' + icon('note', 14) + '</button>' +
    '<button type="button" data-act="moveItem" title="העברה לקבוצה אחרת" aria-label="העברה לקבוצה אחרת">' + icon('move', 14) + '</button>' +
    '<button type="button" data-act="doneItem" title="סיימתי, להסיר מהקבוצה" aria-label="סיימתי, להסיר מהקבוצה">' + icon('check', 15) + '</button>' +
    '</span>' + note + '</li>';
}
function bodyHTML(g, items, ctx) {
  var live = isLive(g);
  var notOpen = live ? g.items.filter(function (it) { return it.tabId == null; }).length : 0;
  var opts = Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === g.status ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('');
  return '<div class="g-body">' +
    '<div class="g-meta2"><label class="pick" title="סטטוס">' + icon(STATUS_ICON[g.status], 13) + '<span>' + STATUS[g.status] + '</span>' + icon('chevronDown', 11) +
    '<select data-act="status" aria-label="סטטוס">' + opts + '</select></label>' +
    (live ? '<span class="live">פתוחה בכרום</span>' : '<span class="nopen">נשמרה ' + esc(ago(g.updatedAt)) + '</span>') +
    '<span class="sp"></span>' + (notOpen ? '<span class="nopen">' + (g.items.length - notOpen) + ' מתוך ' + g.items.length + ' פתוחים</span>' : '') + '</div>' +
    '<ul class="items">' + items.map(function (it) { return itemHTML(g, it, ctx); }).join('') + '</ul>' +
    '<label class="taskin"><span class="k">משימה</span><input data-act="task" dir="auto" value="' + esc(g.task) + '" placeholder="מה לעשות עם הקבוצה. יישלח לקלוד עם הקישורים"></label>' +
    '<div class="claude"><button type="button" class="btn pri" data-act="claude-chat">' + icon('chat', 15) + '<span>צ׳אט עם קלוד</span></button>' +
    '<button type="button" class="btn sec" data-act="claude-code">' + icon('terminal', 15) + '<span>קלוד קוד</span></button></div>' +
    '<div class="gacts">' +
    (live
      ? '<button type="button" class="ga" data-act="openGroup" title="הצגה בכרום">' + icon('window', 15) + '<span>הצגה בכרום</span></button>' +
        '<button type="button" class="ga" data-act="closeGroup" title="סגירה בכרום, הקבוצה נשארת כאן">' + icon('closeSave', 15) + '<span>סגירה ושמירה</span></button>'
      : '<button type="button" class="ga" data-act="openGroup" title="פתיחת כל הקישורים כקבוצה בכרום">' + icon('window', 15) + '<span>פתיחת הכול</span></button>') +
    '<button type="button" class="ga" data-act="copy" title="העתקת הכותרות והקישורים">' + icon('copy', 15) + '<span>העתקה</span></button>' +
    '<button type="button" class="ga" data-act="groupMenu" title="עוד פעולות">' + icon('more', 15) + '<span>עוד</span></button>' +
    '</div></div>';
}
function groupHTML(g, items, ctx) {
  var open = ui.expanded.has(g.id) || !!ui.query.trim();
  var stale = isStale(g);
  var cls = 'group' + (open ? ' open' : '') + (stale ? ' stale' : '') + (isLive(g) ? ' live' : '') + (g.name ? '' : ' unnamed') + (g.pinned ? ' pinned' : '');
  var age = isLive(g) ? 'פתוחה' : stale ? staleText(g).replace('לא נפתחה כבר ', '') : ago(g.lastActiveAt).replace('לפני ', '');
  var head = '<div class="g-head" data-act="toggle" data-nav tabindex="0" role="button" aria-expanded="' + open + '">' +
    '<span class="g-mark"></span><div class="g-tab"><span class="g-chev">' + icon('chevronDown', 13) + '</span>' +
    (g.pinned ? '<span class="g-pin" title="נעוצה">' + icon('pin', 12) + '</span>' : '') + nameHTML(g, ctx.dupNames.has(g.name)) + '</div>' +
    '<div class="g-info"><span class="g-st st-' + g.status + '" title="' + STATUS[g.status] + '">' + icon(STATUS_ICON[g.status], 14) + '</span>' +
    (g.status !== 'none' ? '<span class="g-status">' + STATUS[g.status] + '</span>' : '') +
    '<span class="g-count" title="' + g.items.length + ' פריטים">' + g.items.length + '</span>' +
    '<span class="g-age">' + (stale ? icon('clock', 12) : '') + '<span>' + esc(age) + '</span></span></div></div>';
  var card = '<div class="g-card">' +
    '<div class="g-line"><p class="g-preview">' + runon(items) + '</p><span class="g-meta">' +
    (g.status !== 'none' ? '<span>' + STATUS[g.status] + '</span>' : '') + '<b>' + g.items.length + '</b></span></div>' +
    ((g.task || '').trim() ? '<p class="g-task">' + icon('note', 13) + '<span class="k">משימה</span><span class="t" dir="auto">' + esc(g.task) + '</span></p>' : '') +
    (stale ? '<p class="g-stale">' + icon('clock', 12) + '<span>' + esc(staleText(g)) + '</span></p>' : '') +
    (open ? bodyHTML(g, items, ctx) : '') + '</div>';
  return '<article class="' + cls + '" data-gid="' + g.id + '" style="--gc:' + gc(g) + '">' + head + card + '</article>';
}
function toEl(html) { var t = document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; }
function isTyping() { var a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.id !== 'search'; }

function renderList() {
  var list = $('list');
  var visible = [];
  S.groups.forEach(function (g) {
    if (!matchesFilter(g, ui.filter)) return;
    var items = searchResult(g);
    if (items) visible.push({ g: g, items: items });
  });
  var names = new Map(), urlGroups = new Map();
  S.groups.forEach(function (g) {
    if (g.name) names.set(g.name, (names.get(g.name) || 0) + 1);
    g.items.forEach(function (it) {
      var k = pageKey(it.url), arr = urlGroups.get(k) || [];
      if (arr.indexOf(g) < 0) arr.push(g);
      urlGroups.set(k, arr);
    });
  });
  var ctx = { dupNames: new Set(Array.from(names).filter(function (e) { return e[1] > 1; }).map(function (e) { return e[0]; })), urlGroups: urlGroups };
  var live = visible.filter(function (x) { return isLive(x.g); }).sort(function (a, b) {
    return ((a.g.windowId || 0) - (b.g.windowId || 0)) || ((a.g.stripPos || 0) - (b.g.stripPos || 0));
  });
  var byId = new Map(visible.map(function (x) { return [x.g.id, x]; }));
  var saved = savedOrder(visible.filter(function (x) { return !isLive(x.g); }).map(function (x) { return x.g; })).map(function (g) { return byId.get(g.id); });
  var activeId = S.activeTab && S.activeTab.id;

  function card(x) {
    var open = ui.expanded.has(x.g.id) || !!ui.query.trim();
    var sig = JSON.stringify([x.g, x.items.map(function (i) { return i.id; }), open, ui.editing, ui.query, S.settings.staleDays,
      document.documentElement.dataset.mode, ctx.dupNames.has(x.g.name), x.g.items.some(function (i) { return i.tabId === activeId; }) ? activeId : 0,
      x.g.items.map(function (i) { return (ctx.urlGroups.get(pageKey(i.url)) || []).length; })]);
    var c = cards.get(x.g.id);
    if (c && c.sig === sig) return c.el;
    if (c && c.el.contains(document.activeElement) && isTyping()) { ui.pending = true; return c.el; }
    var el = toEl(groupHTML(x.g, x.items, ctx));
    if (c && c.el.contains(document.activeElement)) {
      var gidFocus = document.activeElement.closest('[data-iid]');
      var sel = gidFocus ? '[data-iid="' + gidFocus.dataset.iid + '"]' : '.g-head';
      c.el.replaceWith(el);
      var again = el.querySelector(sel);
      if (again) again.focus({ preventScroll: true });
    }
    cards.set(x.g.id, { sig: sig, el: el });
    return el;
  }
  function section(key, title, arr) {
    var sec = list.querySelector('section[data-sect="' + key + '"]');
    if (!arr.length) { if (sec) sec.remove(); return null; }
    if (!sec) sec = toEl('<section class="sect" data-sect="' + key + '"><h2 class="sect-h"><span></span><span class="n"></span></h2><div class="stack"></div></section>');
    sec.querySelector('.sect-h span').textContent = title;
    sec.querySelector('.sect-h .n').textContent = arr.length;
    var stack = sec.querySelector('.stack');
    var els = arr.map(card);
    var same = els.length === stack.children.length && els.every(function (el, i) { return stack.children[i] === el; });
    if (!same) stack.replaceChildren.apply(stack, els);
    return sec;
  }
  var ids = new Set(S.groups.map(function (g) { return g.id; }));
  cards.forEach(function (c, id) { if (!ids.has(id)) cards.delete(id); });

  var secs = [section('live', 'פתוחות בכרום', live), section('saved', ui.filter === 'archive' ? 'בארכיון' : 'שמורות', saved)].filter(Boolean);
  var empty = list.querySelector('.empty');
  if (!secs.length) {
    var text = !S.groups.length ? 'אין קבוצות עדיין. קבוצת לשוניות שתיצור בכרום תופיע כאן, וכך גם קבוצות שתשמור מכאן.'
      : ui.query.trim() ? 'שום קבוצה לא מתאימה לחיפוש.' : 'אין קבוצות בסינון הזה.';
    if (!empty) { empty = toEl('<p class="empty"></p>'); }
    empty.textContent = text;
    list.replaceChildren(empty);
    return;
  }
  var cur = Array.from(list.children);
  if (cur.length !== secs.length || secs.some(function (s, i) { return cur[i] !== s; })) list.replaceChildren.apply(list, secs);
}

function renderHeader() {
  var live = S.groups.filter(isLive).length;
  var total = S.groups.filter(function (g) { return g.status !== 'archive'; }).length;
  $('summary').textContent = total ? total + ' קבוצות · ' + live + ' פתוחות' : '';
  $('btnSettings').classList.toggle('on', ui.view !== 'list');
  $('btnSettings').setAttribute('aria-pressed', String(ui.view !== 'list'));
  $('listHead').hidden = ui.view !== 'list';
  $('list').hidden = ui.view !== 'list';
  $('cols').hidden = ui.view !== 'list';
  $('keys').hidden = ui.view !== 'list';
  $('side').hidden = ui.view === 'list';
  var nav = $('filters');
  nav.classList.toggle('show-extra', ui.showExtra);
  nav.innerHTML = FILTERS.map(function (f, i) {
    var n = S.groups.filter(function (g) { return matchesFilter(g, f[0]); }).length;
    var ic = FILTER_ICON[f[0]];
    var on = ui.filter === f[0];
    return '<button type="button" class="f' + (on ? ' on' : '') + (n ? '' : ' zero') + (i >= 4 && !on ? ' extra' : '') + (ic ? ' ico' : '') + '" data-act="filter" data-val="' + f[0] + '" title="' + f[1] + '" aria-pressed="' + on + '">' +
      (ic ? '<span class="f-ic">' + icon(ic, 13) + '</span>' : '') + '<span class="f-l">' + f[1] + '</span><span class="f-n">' + n + '</span></button>';
  }).join('') + '<button type="button" class="f more" data-act="moreFilters" aria-expanded="' + ui.showExtra + '"><span class="f-l">' + (ui.showExtra ? 'פחות' : 'עוד') + '</span>' + icon('chevronDown', 12) + '</button>';
  renderHere();
}

function renderHere() {
  var el = $('here');
  var t = S.activeTab;
  if (!t || !/^(https?|file):/.test(t.url || '')) { el.hidden = true; return; }
  var key = pageKey(t.url);
  var inGroups = S.groups.filter(function (g) { return g.items.some(function (it) { return it.tabId === t.id || pageKey(it.url) === key; }); });
  el.hidden = false;
  if (inGroups.length) {
    var g = inGroups[0];
    el.innerHTML = '<span class="here-mark" style="--gc:' + gc(g) + '"></span><span>הלשונית הפעילה כבר ' + (inGroups.length > 1 ? 'ב־' + inGroups.length + ' קבוצות, למשל' : 'בקבוצה') + '</span>' +
      '<button type="button" class="here-go" data-act="goGroup" data-gid="' + g.id + '" dir="auto">' + esc(g.name || 'ללא שם') + '</button>';
  } else {
    el.innerHTML = '<span class="here-mark none"></span><span>הלשונית הפעילה לא שמורה</span><button type="button" class="here-go" data-act="add">שמירה</button>';
  }
}

function renderKeys() {
  $('keys').innerHTML =
    '<span>ניווט <span class="kseq" dir="ltr"><kbd>' + icon('arrowUp', 10) + '</kbd><kbd>' + icon('arrowDown', 10) + '</kbd></span></span>' +
    '<span>פתיחה <kbd>' + icon('enter', 10) + '</kbd></span><span>חיפוש <kbd>/</kbd></span><span>סיימתי <kbd>D</kbd></span>' +
    '<span>ביטול <span class="kseq" dir="ltr"><kbd>' + icon('cmd', 10) + '</kbd><kbd>Z</kbd></span></span>';
}

// ---------- הגדרות וסל מחזור ----------
function seg(act, opts, cur) {
  return '<div class="seg" role="group">' + opts.map(function (o) {
    return '<button type="button" data-act="' + act + '" data-val="' + o[0] + '" class="' + (o[0] === cur ? 'on' : '') + '" aria-pressed="' + (o[0] === cur) + '">' + o[1] + '</button>';
  }).join('') + '</div>';
}
function row(label, hint, control, cls) {
  return '<div class="s-row' + (cls ? ' ' + cls : '') + '"><div class="s-lbl"><span class="s-l">' + label + '</span>' +
    (hint ? '<span class="s-hint">' + hint + '</span>' : '') + '</div><div class="s-ctl">' + control + '</div></div>';
}
function sec(title, rows) { return '<div class="s-sec"><h3 class="s-t">' + title + '</h3><div class="s-rows">' + rows + '</div></div>'; }
var shortcutKeys = '';
function keycaps(sc) {
  if (!sc) return '<span class="s-hint">לא מוגדר</span>';
  var parts = sc.indexOf('+') >= 0 ? sc.split('+') : Array.from(sc);
  var map = { Alt: 'optKey', Option: 'optKey', '⌥': 'optKey', Shift: 'shiftKey', '⇧': 'shiftKey', Command: 'cmd', '⌘': 'cmd' };
  return '<span class="kseq" dir="ltr">' + parts.map(function (p) {
    return '<kbd>' + (map[p] ? icon(map[p], 12) : esc(p === 'Ctrl' || p === 'MacCtrl' || p === '⌃' ? 'Ctrl' : p)) + '</kbd>';
  }).join('') + '</span>';
}
function renderSettings() {
  var s = S.settings;
  var themes = [['drawer', 'מגירה'], ['console', 'מסוף'], ['glass', 'זכוכית']].map(function (t) {
    return '<button type="button" class="th' + (s.theme === t[0] ? ' on' : '') + '" data-act="setTheme" data-val="' + t[0] + '" aria-pressed="' + (s.theme === t[0]) + '">' +
      '<span class="th-pv pv-' + t[0] + '"><i></i><i></i><i></i></span><span class="th-l">' + t[1] + '</span></button>';
  }).join('');
  var trashN = S.trash.length;
  $('side').innerHTML = '<section class="settings">' +
    '<div class="s-head"><button type="button" class="ibtn back" data-act="back" title="חזרה לקבוצות" aria-label="חזרה לקבוצות">' + icon('back', 18) + '</button><h2>הגדרות</h2></div>' +
    sec('מראה',
      row('עיצוב', '', '<div class="themes">' + themes + '</div>', 'col') +
      row('מצב תצוגה', 'הכפתור למעלה מחליף בין בהיר לכהה', seg('setMode', [['system', 'לפי המערכת'], ['light', 'בהיר'], ['dark', 'כהה']], s.mode), 'col')) +
    sec('קלוד',
      row('צ׳אט עם קלוד נפתח', '', seg('setChat', [['app', 'באפליקציה'], ['web', 'באתר']], s.chatTarget)) +
      row('קלוד קוד נפתח', '', seg('setCode', [['app', 'באפליקציה'], ['web', 'באתר']], s.codeTarget)) +
      row('תיקיית עבודה לקלוד קוד', 'לא חובה. רק באפליקציה, והיא תבקש אישור לפני שימוש.', '<input class="path" id="codeFolder" dir="ltr" value="' + esc(s.codeFolder) + '" placeholder="/Users/me/Projects" aria-label="תיקיית עבודה">', 'col') +
      row('בדיקת קישור', 'פותח את קלוד עם המילה "בדיקה". שום דבר לא נשלח.', '<button type="button" class="btn sm" data-act="testLink">' + icon('external', 14) + '<span>בדיקה</span></button>')) +
    sec('קבוצות',
      row('קבוצה נחשבת ישנה אחרי', '', '<span class="num"><input id="staleDays" type="number" min="1" max="365" dir="ltr" value="' + (s.staleDays || 14) + '" aria-label="מספר ימים"><span>ימים</span></span>') +
      row('קיצור מקלדת לחלונית', '', '<span class="keys-set">' + keycaps(shortcutKeys) + '<button type="button" class="lnk" data-act="shortcut">שינוי</button></span>')) +
    sec('נתונים',
      row('גיבוי', s.lastExport ? 'הייצוא האחרון היה ' + ago(s.lastExport) : 'עוד לא ייצאת גיבוי', '<button type="button" class="btn sm" data-act="export">' + icon('download', 14) + '<span>ייצוא</span></button>') +
      row('ייבוא מקובץ', 'להוסיף לקבוצות הקיימות, או להחליף אותן', '<button type="button" class="btn sm" data-act="import">' + icon('upload', 14) + '<span>ייבוא</span></button>') +
      row('סל המחזור', (trashN ? trashN + ' פריטים. ' : 'ריק. ') + 'נמחקים לתמיד אחרי 30 יום.', '<button type="button" class="btn sm" data-act="openTrash">' + icon('trash', 14) + '<span>פתיחה</span></button>')) +
    '<p class="s-foot">גרסה ' + esc(chrome.runtime.getManifest().version) + '. הנתונים נשמרים רק בכרום, במחשב הזה.</p></section>';
}
var REASONS = { deleted: 'נמחקה', removed: 'הפריט האחרון הוסר', done: 'סומן כסיים', emptied: 'הלשוניות נסגרו אחת אחת', ungrouped: 'פורקה בכרום', merged: 'מוזגה לקבוצה אחרת', import: 'לפני ייבוא' };
function renderTrash() {
  var rows = S.trash.map(function (e) {
    var title = e.kind === 'item' ? displayTitle(e.item) : e.kind === 'snapshot' ? 'הקבוצות השמורות (' + e.groups.length + ')' : (e.group.name || 'קבוצה ללא שם');
    var sub = (e.kind === 'item' ? 'פריט' + (e.groupName ? ' מ־' + e.groupName : '') : e.kind === 'snapshot' ? 'גיבוי' : 'קבוצה, ' + e.group.items.length + ' פריטים') +
      '. ' + (REASONS[e.reason] || '') + ' ' + ago(e.deletedAt) + '.';
    return '<div class="s-row" data-trash="' + esc(e.id) + '"><div class="s-lbl"><span class="s-l" dir="auto">' + esc(title) + '</span><span class="s-hint">' + esc(sub) + '</span></div>' +
      '<div class="s-ctl tr-acts"><button type="button" class="btn sm" data-act="trashRestore">' + icon('undo', 14) + '<span>שחזור</span></button>' +
      '<button type="button" class="ibtn" data-act="trashDelete" title="מחיקה לתמיד" aria-label="מחיקה לתמיד">' + icon('trash', 15) + '</button></div></div>';
  }).join('');
  $('side').innerHTML = '<section class="settings">' +
    '<div class="s-head"><button type="button" class="ibtn back" data-act="back" title="חזרה להגדרות" aria-label="חזרה להגדרות">' + icon('back', 18) + '</button><h2>סל המחזור</h2></div>' +
    (S.trash.length ? sec('נמחקו לאחרונה', rows) + '<p class="s-foot"><button type="button" class="lnk" data-act="trashEmpty">ריקון הסל</button></p>'
      : '<p class="empty">הסל ריק.</p>') + '</section>';
}

function renderAll() {
  if (isTyping() && ui.view !== 'list') return;
  renderHeader();
  if (ui.view === 'list') renderList();
  else if (ui.view === 'settings') renderSettings();
  else renderTrash();
}

// ---------- קלוד ----------
function promptText(g, limit, encoded) {
  var head = 'אלה הקישורים בקבוצה ' + (g.name ? '"' + g.name + '"' : 'ללא שם') + (g.status !== 'none' ? ' (סטטוס: ' + STATUS[g.status] + ')' : '') + ':';
  var tail = '\n\nהמשימה: ' + (g.task || '').trim();
  var size = function (s) { return encoded ? encodeURIComponent(s).length : s.length; };
  var used = size(head + tail), lines = [head], left = 0;
  g.items.forEach(function (it, i) {
    var line = 'פריט ' + (i + 1) + ': ' + displayTitle(it) + '\nכתובת: ' + it.url + (it.note ? '\nהערה: ' + it.note : '');
    if (left || used + size(line + '\n') > limit) { left++; return; }
    lines.push(line); used += size(line + '\n');
  });
  if (left) lines.push('ועוד ' + left + ' קישורים שלא נכנסו בגלל מגבלת אורך. הרשימה המלאה הועתקה ללוח.');
  return lines.join('\n') + tail;
}
// קישור לאפליקציה נפתח דרך הלשונית הפעילה, כי החלונית היא לא לשונית ושאלת "לפתוח את קלוד?" של כרום מוצגת מעל לשונית
async function launch(url) {
  if (/^https:/.test(url)) { await chrome.tabs.create({ url: url }); return; }
  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) { await chrome.tabs.update(tabs[0].id, { url: url }); return; }
  } catch (e) {}
  var a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); a.remove();
}
function claudeUrl(kind, text) {
  var s = S.settings, q = encodeURIComponent(text);
  if (kind === 'chat') return s.chatTarget === 'web' ? 'https://claude.ai/new?q=' + q : 'claude://claude.ai/new?q=' + q;
  return s.codeTarget === 'web' ? 'https://claude.ai/code?prompt=' + q
    : 'claude://code/new?q=' + q + (s.codeFolder ? '&folder=' + encodeURIComponent(s.codeFolder) : '');
}
function openInClaude(kind, g) {
  var web = (kind === 'chat' ? S.settings.chatTarget : S.settings.codeTarget) === 'web';
  var full = promptText(g, Infinity, false);
  var text = web ? promptText(g, WEB_LIMIT, true) : promptText(g, APP_LIMIT, false);
  navigator.clipboard.writeText(full).catch(function () {});
  launch(claudeUrl(kind, text)).catch(function () { toast('לא הצלחתי לפתוח את קלוד. הטקסט הועתק ללוח.'); });
  toast('נפתח בקלוד. הטקסט הועתק גם ללוח, למקרה שלא הופיע.');
}

// ---------- תפריטים ----------
var menu = null;
function closeMenu() { if (menu) { menu.el.remove(); var a = menu.anchor; menu = null; if (a && document.contains(a)) a.focus({ preventScroll: true }); } }
function openMenu(anchor, entries, title) {
  closeMenu();
  var el = document.createElement('div');
  el.className = 'menu'; el.setAttribute('role', 'menu');
  el.innerHTML = (title ? '<p class="menu-t">' + esc(title) + '</p>' : '') + entries.map(function (e, i) {
    if (e.sep) return '<hr>';
    return '<button type="button" role="menuitem" data-mi="' + i + '"' + (e.disabled ? ' disabled' : '') + (e.danger ? ' class="danger"' : '') + '>' +
      (e.icon ? icon(e.icon, 14) : '') + '<span dir="auto">' + esc(e.label) + '</span>' + (e.hint ? '<small>' + esc(e.hint) + '</small>' : '') + '</button>';
  }).join('');
  document.body.appendChild(el);
  var r = anchor.getBoundingClientRect();
  var top = r.bottom + 4;
  if (top + el.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 4);
  el.style.top = top + 'px';
  el.style.right = Math.max(8, innerWidth - r.right) + 'px';
  menu = { el: el, entries: entries, anchor: anchor };
  var first = el.querySelector('button:not([disabled])');
  if (first) first.focus();
}
function groupLabel(g) { return g.name || ('ללא שם, ' + topHosts(g)); }
function targetEntries(exclude, run) {
  var list = S.groups.filter(function (g) { return g !== exclude && g.status !== 'archive'; }).sort(function (a, b) {
    return (isLive(b) - isLive(a)) || (b.pinned - a.pinned) || ((b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  });
  return list.map(function (g) { return { label: groupLabel(g), hint: isLive(g) ? 'פתוחה' : '', icon: isLive(g) ? 'window' : 'box', run: function () { run(g); } }; });
}
function addMenu(anchor) {
  var t = S.activeTab;
  var ok = t && /^(https?|file):/.test(t.url || '');
  var entries = [];
  if (ok) {
    entries.push({ label: 'קבוצה חדשה בכרום', icon: 'plus', run: function () { act({ type: 'addTab', tabId: t.id, target: 'new' }).then(function (r) { if (r) toast('נוצרה קבוצה חדשה'); }); } });
    targetEntries(null, function (g) {
      act({ type: 'addTab', tabId: t.id, target: g.id }).then(function (r) { if (r) toast(r.already ? 'הלשונית כבר שמורה בקבוצה הזו' : 'נשמר ב־' + groupLabel(g)); });
    }).forEach(function (e) { entries.push(e); });
    entries.push({ sep: true });
  }
  entries.push({ label: 'כל הלשוניות שלא בקבוצה בחלון הזה', icon: 'layers', run: function () {
    chrome.windows.getCurrent().then(function (w) { return act({ type: 'saveWindow', windowId: w.id }); }).then(function (r) { if (r) toast(r.count + ' לשוניות נאספו לקבוצה חדשה'); });
  } });
  openMenu(anchor, entries, ok ? 'שמירת הלשונית הנוכחית' : 'אי אפשר לשמור את הלשונית הנוכחית');
}
function groupMenu(anchor, g) {
  var entries = [
    { label: g.pinned ? 'ביטול הנעיצה' : 'נעיצה למעלה', icon: 'pin', run: function () { act({ type: 'setPinned', id: g.id, pinned: !g.pinned }); } },
    { label: 'שינוי שם', icon: 'pencil', run: function () { startEdit('g:' + g.id); } },
    { label: 'מיזוג אל קבוצה אחרת', icon: 'merge', run: function () { mergeMenu(anchor, g); } },
    { label: g.status === 'archive' ? 'הוצאה מהארכיון' : 'העברה לארכיון', icon: 'box', run: function () { act({ type: 'setStatus', id: g.id, status: g.status === 'archive' ? 'none' : 'archive' }); } },
    { sep: true },
    { label: isLive(g) ? 'מחיקת הקבוצה וסגירת הלשוניות' : 'מחיקת הקבוצה', icon: 'trash', danger: true, run: function () {
      act({ type: 'deleteGroup', id: g.id }).then(function (r) { if (r) toast('הקבוצה נמחקה', r.trashId); });
    } }
  ];
  openMenu(anchor, entries);
}
function mergeMenu(anchor, g) {
  setTimeout(function () {
    openMenu(anchor, targetEntries(g, function (into) {
      act({ type: 'mergeGroups', id: g.id, intoId: into.id }).then(function (r) { if (r) { ui.expanded.add(into.id); toast('הקבוצות מוזגו', r.trashId); } });
    }), 'מיזוג "' + groupLabel(g) + '" אל');
  }, 0);
}
function moveMenu(anchor, g, it) {
  openMenu(anchor, targetEntries(g, function (to) {
    act({ type: 'moveItem', id: g.id, itemId: it.id, toId: to.id }).then(function (r) { if (r) toast('הועבר ל־' + groupLabel(to)); });
  }), 'העברה אל');
}

// ---------- עריכה במקום ----------
function startEdit(key) {
  ui.editing = key;
  var gid = key.slice(0, 2) === 'g:' ? key.slice(2) : null;
  if (!gid) {
    var iid = key.slice(2);
    var g = S.groups.find(function (x) { return x.items.some(function (it) { return it.id === iid; }); });
    if (g) gid = g.id;
  }
  if (gid) ui.expanded.add(gid);
  renderList();
  var input = document.querySelector('.edit');
  if (input) { input.focus(); input.select(); }
}
function finishEdit(input, commit) {
  var key = ui.editing;
  if (!key) return;
  ui.editing = null;
  var v = input.value.trim();
  var gid = input.closest('[data-gid]') && input.closest('[data-gid]').dataset.gid;
  var li = input.closest('[data-iid]');
  if (commit && gid) {
    if (key.slice(0, 2) === 'g:') act({ type: 'setName', id: gid, name: v });
    else if (key.slice(0, 2) === 'i:') act({ type: 'setItemTitle', id: gid, itemId: li.dataset.iid, title: v });
    else act({ type: 'setItemNote', id: gid, itemId: li.dataset.iid, note: v });
  }
  var focusSel = li ? '[data-iid="' + li.dataset.iid + '"]' : gid ? '[data-gid="' + gid + '"] .g-head' : null;
  setTimeout(function () {
    renderList();
    var el = focusSel && document.querySelector(focusSel);
    if (el) el.focus({ preventScroll: true });
  }, 0);
}

// ---------- פעולות ----------
function groupOf(el) { var c = el.closest('[data-gid]'); return c && S.groups.find(function (g) { return g.id === c.dataset.gid; }); }
function itemOf(el, g) { var c = el.closest('[data-iid]'); return c && g && g.items.find(function (it) { return it.id === c.dataset.iid; }); }
function copyText(g) {
  navigator.clipboard.writeText(promptText(g, Infinity, false).replace(/\n\nהמשימה: $/, '')).then(function () { toast('הקישורים הועתקו'); }, function () { toast('ההעתקה נכשלה'); });
}
function removeItem(g, it) {
  act({ type: 'removeItem', id: g.id, itemId: it.id }).then(function (r) { if (r) toast('הפריט הוסר', r.trashId); });
}
function openItem(g, it, background) {
  act({ type: 'openItem', id: g.id, itemId: it.id, background: !!background });
}
function toggleGroup(g) {
  if (ui.expanded.has(g.id)) ui.expanded.delete(g.id); else ui.expanded.add(g.id);
  renderList();
}
function exportData() {
  chrome.storage.local.get(['groups', 'settings']).then(function (r) {
    var data = JSON.stringify({ app: 'kartisiyot', version: 2, exportedAt: new Date().toISOString(), groups: r.groups || [], settings: r.settings || {} }, null, 2);
    var url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'kartisiyot-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    saveSettings({ lastExport: Date.now() }).then(renderAll);
    toast('הגיבוי ירד לתיקיית ההורדות');
  });
}
var importAnchor = null;
function importFile(file) {
  file.text().then(function (txt) {
    var data = JSON.parse(txt);
    if (!data || !Array.isArray(data.groups)) throw new Error('bad');
    openMenu(importAnchor || $('btnSettings'), [
      { label: 'הוספה לקבוצות הקיימות', icon: 'plus', run: function () { doImport(data, 'merge'); } },
      { label: 'החלפת הקבוצות השמורות', hint: 'המצב הנוכחי נשמר בסל', icon: 'upload', run: function () { doImport(data, 'replace'); } }
    ], data.groups.length + ' קבוצות בקובץ');
  }).catch(function () { toast('הקובץ לא תקין. צריך קובץ שנוצר ב"ייצוא".'); });
}
function doImport(data, mode) {
  act({ type: 'importData', groups: data.groups, mode: mode }).then(function (r) {
    if (!r) return;
    if (data.settings && mode === 'replace') saveSettings(Object.assign({}, data.settings, { lastExport: S.settings.lastExport }));
    toast('יובאו ' + r.added + ' קבוצות' + (r.joined ? ', ו־' + r.joined + ' מוזגו לקבוצות קיימות' : ''));
  });
}
function navMove(dir) {
  var nodes = Array.from(document.querySelectorAll('#list [data-nav]')).filter(function (n) { return n.offsetParent; });
  if (!nodes.length) return;
  var i = nodes.indexOf(document.activeElement);
  var next = nodes[i < 0 ? (dir > 0 ? 0 : nodes.length - 1) : Math.max(0, Math.min(nodes.length - 1, i + dir))];
  next.focus();
  next.scrollIntoView({ block: 'nearest' });
}

document.addEventListener('click', function (e) {
  var mi = e.target.closest('[data-mi]');
  if (mi && menu) { var entry = menu.entries[+mi.dataset.mi]; closeMenu(); entry.run(); return; }
  if (menu && !e.target.closest('.menu')) closeMenu();
  var el = e.target.closest('[data-act]');
  if (!el) {
    var cardEl = e.target.closest('.g-card');
    if (cardEl && !e.target.closest('.g-body')) toggleGroup(groupOf(cardEl));
    return;
  }
  if (el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  var a = el.dataset.act, g = groupOf(el), it = itemOf(el, g);
  switch (a) {
    case 'toggle': if (!e.target.closest('.edit')) toggleGroup(g); break;
    case 'renameItem': startEdit('i:' + it.id); break;
    case 'noteItem': startEdit('n:' + it.id); break;
    case 'moveItem': moveMenu(el, g, it); break;
    case 'doneItem': removeItem(g, it); break;
    case 'claude-chat': openInClaude('chat', g); break;
    case 'claude-code': openInClaude('code', g); break;
    case 'openGroup': act({ type: 'openGroup', id: g.id }).then(function (r) { if (r && r.skipped && r.skipped.length) toast('נפתח, בלי ' + r.skipped.length + ' קישורים שכרום לא מאפשר לפתוח'); }); break;
    case 'closeGroup': act({ type: 'closeGroup', id: g.id }).then(function (r) { if (r) toast('הקבוצה נסגרה בכרום ונשמרה כאן'); }); break;
    case 'copy': copyText(g); break;
    case 'groupMenu': groupMenu(el, g); break;
    case 'add': addMenu(el); break;
    case 'mode': saveSettings({ mode: effectiveMode() === 'dark' ? 'light' : 'dark' }).then(function () { cards.clear(); renderAll(); }); break;
    case 'settings': ui.view = ui.view === 'list' ? 'settings' : 'list'; renderAll(); break;
    case 'back': ui.view = ui.view === 'trash' ? 'settings' : 'list'; renderAll(); break;
    case 'filter': ui.filter = el.dataset.val; renderAll(); break;
    case 'moreFilters': ui.showExtra = !ui.showExtra; renderHeader(); break;
    case 'goGroup':
      ui.filter = 'all'; ui.expanded.add(el.dataset.gid); ui.view = 'list'; renderAll();
      var card = document.querySelector('#list [data-gid="' + el.dataset.gid + '"]');
      if (card) { card.scrollIntoView({ block: 'start', behavior: 'smooth' }); card.querySelector('.g-head').focus({ preventScroll: true }); }
      break;
    case 'undo': undo(el.dataset.trash); break;
    case 'setTheme': saveSettings({ theme: el.dataset.val }).then(function () { cards.clear(); renderAll(); }); break;
    case 'setMode': saveSettings({ mode: el.dataset.val }).then(function () { cards.clear(); renderAll(); }); break;
    case 'setChat': saveSettings({ chatTarget: el.dataset.val }).then(renderAll); break;
    case 'setCode': saveSettings({ codeTarget: el.dataset.val }).then(renderAll); break;
    case 'testLink': openInClaude('chat', { name: '', status: 'none', task: 'בדיקה', items: [] }); break;
    case 'shortcut': chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); break;
    case 'export': exportData(); break;
    case 'import': importAnchor = el; $('importFile').click(); break;
    case 'openTrash': ui.view = 'trash'; renderAll(); break;
    case 'trashRestore': undo(el.closest('[data-trash]').dataset.trash); break;
    case 'trashDelete': act({ type: 'purgeTrash', trashId: el.closest('[data-trash]').dataset.trash }); break;
    case 'trashEmpty': act({ type: 'purgeTrash' }); break;
  }
});
document.addEventListener('dblclick', function (e) {
  var n = e.target.closest('.g-name, .g-un');
  if (n) { var g = groupOf(n); if (g) startEdit('g:' + g.id); }
});
// לחיצה על פריט פותחת אותו. לחיצה עם Cmd או בגלגלת פותחת ברקע.
document.addEventListener('mouseup', function (e) {
  if (e.button > 1) return;
  var li = e.target.closest('.it');
  if (!li || e.target.closest('.acts, .edit, .note')) return;
  var g = groupOf(li), it = itemOf(li, g);
  if (g && it) openItem(g, it, e.button === 1 || e.metaKey || e.ctrlKey);
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.dataset.act === 'status') { var g = groupOf(t); act({ type: 'setStatus', id: g.id, status: t.value }); }
  if (t.id === 'codeFolder') saveSettings({ codeFolder: t.value.trim() });
  if (t.id === 'staleDays') saveSettings({ staleDays: Math.max(1, Math.min(365, parseInt(t.value, 10) || 14)) }).then(function () { cards.clear(); });
  if (t.id === 'importFile') { var f = t.files[0]; t.value = ''; if (f) importFile(f); }
});
var taskTimers = {};
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.id === 'search') {
    clearTimeout(taskTimers.search);
    taskTimers.search = setTimeout(function () { ui.query = t.value; renderList(); }, 120);
  } else if (t.dataset.act === 'task') {
    var g = groupOf(t);
    clearTimeout(taskTimers[g.id]);
    taskTimers[g.id] = setTimeout(function () { act({ type: 'setTask', id: g.id, task: t.value }); }, 500);
  }
});
document.addEventListener('focusout', function (e) {
  var t = e.target;
  if (t.classList && t.classList.contains('edit') && ui.editing) finishEdit(t, true);
  if (t.dataset && t.dataset.act === 'task') {
    var g = groupOf(t);
    clearTimeout(taskTimers[g.id]);
    if (g && t.value !== (g.task || '')) act({ type: 'setTask', id: g.id, task: t.value });
  }
  setTimeout(function () {
    document.querySelectorAll('.group.cursor').forEach(function (n) { if (!n.contains(document.activeElement)) n.classList.remove('cursor'); });
    if (ui.pending && !isTyping()) { ui.pending = false; renderAll(); }
  }, 0);
});
document.addEventListener('focusin', function (e) {
  var gEl = e.target.closest && e.target.closest('.group');
  document.querySelectorAll('.group.cursor').forEach(function (n) { if (n !== gEl) n.classList.remove('cursor'); });
  if (gEl && e.target.matches('[data-nav]')) gEl.classList.add('cursor');
});
document.addEventListener('keydown', function (e) {
  var t = e.target, key = e.key;
  if (menu) {
    if (key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      var bs = Array.from(menu.el.querySelectorAll('button:not([disabled])')), i = bs.indexOf(document.activeElement);
      bs[(i + (key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
    }
    return;
  }
  if (t.classList && t.classList.contains('edit')) {
    if (key === 'Enter') { e.preventDefault(); t.blur(); }
    if (key === 'Escape') { e.preventDefault(); finishEdit(t, false); }
    return;
  }
  if (t.id === 'search') {
    if (key === 'Escape' && t.value) { e.preventDefault(); t.value = ''; ui.query = ''; renderList(); }
    if (key === 'ArrowDown') { e.preventDefault(); navMove(1); }
    return;
  }
  if (t.dataset && t.dataset.act === 'task') { if (key === 'Enter') t.blur(); return; }
  var typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
  if (typing) return;
  if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 'z') { if (ui.lastUndo) { e.preventDefault(); undo(ui.lastUndo); } return; }
  if (key === '/' && ui.view === 'list') { e.preventDefault(); $('search').focus(); return; }
  if (ui.view !== 'list') { if (key === 'Escape') { ui.view = ui.view === 'trash' ? 'settings' : 'list'; renderAll(); } return; }
  if (key === 'ArrowDown' || key === 'ArrowUp') { e.preventDefault(); navMove(key === 'ArrowDown' ? 1 : -1); return; }
  var g = t.closest && groupOf(t), it = g && itemOf(t, g);
  if (!g) return;
  if ((key === 'Enter' || key === ' ') && t.matches('[data-nav]')) {
    e.preventDefault();
    if (it) openItem(g, it, e.metaKey || e.ctrlKey); else toggleGroup(g);
  } else if (key === 'Escape' && ui.expanded.has(g.id)) {
    ui.expanded.delete(g.id); renderList();
    var h = document.querySelector('[data-gid="' + g.id + '"] .g-head'); if (h) h.focus();
  } else if ((key === 'd' || key === 'D' || key === 'Delete') && it) {
    e.preventDefault(); removeItem(g, it);
  } else if (key === 'F2') {
    e.preventDefault(); startEdit(it ? 'i:' + it.id : 'g:' + g.id);
  }
});

// ---------- גרירה ----------
document.addEventListener('dragstart', function (e) {
  var li = e.target.closest && e.target.closest('.it');
  if (!li) return;
  var g = groupOf(li);
  ui.drag = { gid: g.id, iid: li.dataset.iid };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', li.dataset.iid);
  li.classList.add('dragging');
});
function clearDrop() { document.querySelectorAll('.drop-before, .drop-into').forEach(function (n) { n.classList.remove('drop-before', 'drop-into'); }); }
document.addEventListener('dragover', function (e) {
  if (!ui.drag) return;
  var li = e.target.closest('.it'), card = e.target.closest('.group');
  if (!card) return;
  e.preventDefault();
  clearDrop();
  if (li && li.dataset.iid !== ui.drag.iid) li.classList.add('drop-before');
  else if (!li) card.classList.add('drop-into');
});
document.addEventListener('drop', function (e) {
  if (!ui.drag) return;
  var li = e.target.closest('.it'), card = e.target.closest('.group');
  var d = ui.drag;
  clearDrop();
  if (!card) return;
  e.preventDefault();
  var msg = { type: 'moveItem', id: d.gid, itemId: d.iid, toId: card.dataset.gid };
  if (li && li.dataset.iid !== d.iid) msg.beforeItemId = li.dataset.iid;
  if (msg.toId === d.gid && !msg.beforeItemId) return;
  act(msg);
});
document.addEventListener('dragend', function () { ui.drag = null; clearDrop(); document.querySelectorAll('.dragging').forEach(function (n) { n.classList.remove('dragging'); }); });

// ---------- אתחול ----------
async function refreshActive() {
  try { var tabs = await chrome.tabs.query({ active: true, currentWindow: true }); S.activeTab = tabs[0] || null; } catch (e) { S.activeTab = null; }
  renderHere();
  if (ui.view === 'list') renderList();
}
chrome.tabs.onActivated.addListener(refreshActive);
chrome.tabs.onUpdated.addListener(function (id, info) { if (S.activeTab && id === S.activeTab.id && (info.url || info.title)) refreshActive(); });
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local') return;
  if (changes.settings) { S.settings = Object.assign({}, DEFAULTS, changes.settings.newValue || {}); applyLook(); }
  if (changes.trash) {
    var before = new Set((changes.trash.oldValue || []).map(function (x) { return x.id; }));
    S.trash = changes.trash.newValue || [];
    // קבוצה שעברה לסל מעצמה (רוקנה או פורקה בכרום): מציעים לבטל
    var auto = S.trash.find(function (x) { return !before.has(x.id) && (x.reason === 'emptied' || x.reason === 'ungrouped') && Date.now() - x.deletedAt < 15000; });
    if (auto) toast((auto.group.name ? 'הקבוצה ' + auto.group.name : 'קבוצה ללא שם') + (auto.reason === 'emptied' ? ' רוקנה ועברה לסל' : ' פורקה ועברה לסל'), auto.id);
  }
  if (changes.groups) { S.groups = changes.groups.newValue || []; applyLook(); }
  renderAll();
});
mq.addEventListener('change', function () { applyLook(); cards.clear(); renderAll(); });
document.addEventListener('visibilitychange', function () { if (!document.hidden) { ui.order = null; renderAll(); } });

$('btnAdd').innerHTML = icon('plus', 18);
$('btnSettings').innerHTML = icon('sliders', 17);
$('searchIcon').innerHTML = icon('search', 15);
renderKeys();
chrome.storage.local.get(['groups', 'settings', 'trash']).then(function (r) {
  S.groups = Array.isArray(r.groups) ? r.groups : [];
  S.trash = Array.isArray(r.trash) ? r.trash : [];
  S.settings = Object.assign({}, DEFAULTS, r.settings || {});
  applyLook();
  renderAll();
  refreshActive();
  if (chrome.commands && chrome.commands.getAll) chrome.commands.getAll().then(function (cmds) {
    var c = cmds.find(function (x) { return x.name === '_execute_action'; });
    shortcutKeys = c ? c.shortcut : '';
  });
  send({ type: 'reconcile' }).catch(function () {});
});
