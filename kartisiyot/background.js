// כרטיסיות - סקריפט רקע
// מסנכרן את קבוצות הלשוניות של כרום עם הקבוצות השמורות בתוסף.
// כל שינוי בנתונים עובר דרך תור אחד, כדי ששני שינויים לא ידרסו זה את זה.
// מבנה הנתונים: chrome.storage.local, המפתח groups. גרסה 2 (schema) מוסיפה שדות אופציונליים בלבד:
// לקבוצה pinned, openPeak, restoreUntil, stripPos ולפריט note. נתונים מגרסה 1 משלימים ברירות מחדל ב-normGroup.

var SCHEMA = 2;
var SETTLE_MS = 1000;          // המתנה אחרי האירוע האחרון לפני סנכרון
var STARTUP_MS = 4000;         // בפתיחת הדפדפן מחכים שהלשוניות ישוחזרו
var RESTORE_MS = 120000;       // כמה זמן קבוצה שהייתה פתוחה מחכה לשחזור אחרי הפעלה מחדש
var IGNORE_MS = 10000;         // כמה זמן להתעלם מקבוצה שהתוסף סוגר בעצמו
var TRASH_DAYS = 30;
var STATUSES = ['none', 'watch', 'read', 'skim', 'working', 'archive'];
var COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

var queue = Promise.resolve();
var settleTimer = null;
var quietUntil = 0;
var ignoreChrome = new Map(); // מזהה קבוצה בכרום -> זמן תפוגה

function enqueue(fn) {
  var p = queue.then(fn, fn);
  queue = p.catch(function (e) { console.error('[כרטיסיות]', e); });
  return p;
}
// אירועים לא מקצרים את ההמתנה של ההפעלה
function schedule(ms) {
  var wait = Math.max(typeof ms === 'number' ? ms : SETTLE_MS, quietUntil - Date.now());
  clearTimeout(settleTimer);
  settleTimer = setTimeout(function () { enqueue(reconcileNow); }, wait);
}
function onEvent() { schedule(); }

function now() { return Date.now(); }
function uid() { return crypto.randomUUID(); }
function tabUrl(t) { return t.url || t.pendingUrl || ''; }
function cleanTitle(s) { return String(s || '').replace(/^\(\d+\+?\)\s*/, '').trim(); }
function isBlank(url) { return !url || url === 'about:blank' || /^chrome:\/\/(newtab|new-tab-page)\/?$/.test(url); }
// אותו דף: בלי סימן # ובלי חותמת זמן. ביוטיוב לפי מזהה הסרטון.
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

// ---------- נתונים ----------

function normItem(it) {
  it.id = it.id || uid();
  it.url = String(it.url);
  it.title = typeof it.title === 'string' ? it.title : '';
  it.customTitle = it.customTitle ? String(it.customTitle) : null;
  it.note = typeof it.note === 'string' ? it.note : '';
  it.favIconUrl = typeof it.favIconUrl === 'string' ? it.favIconUrl : '';
  if (it.tabId === undefined) it.tabId = null;
  it.addedAt = it.addedAt || now();
  return it;
}
function normGroup(g) {
  var t = now();
  g.id = g.id || uid();
  g.name = typeof g.name === 'string' ? g.name : '';
  if (COLORS.indexOf(g.color) < 0) g.color = 'grey';
  if (STATUSES.indexOf(g.status) < 0) g.status = 'none';
  g.task = typeof g.task === 'string' ? g.task : '';
  if (g.chromeGroupId === undefined) g.chromeGroupId = null;
  if (g.windowId === undefined) g.windowId = null;
  g.pinned = !!g.pinned;
  g.openPeak = g.openPeak || 0;
  g.restoreUntil = g.restoreUntil || null;
  g.createdAt = g.createdAt || t;
  g.updatedAt = g.updatedAt || t;
  g.lastActiveAt = g.lastActiveAt || g.updatedAt;
  g.items = (Array.isArray(g.items) ? g.items : []).filter(function (it) { return it && it.url; }).map(normItem);
  return g;
}
async function load() {
  var r = await chrome.storage.local.get('groups');
  return (Array.isArray(r.groups) ? r.groups : []).filter(function (g) { return g && typeof g === 'object'; }).map(normGroup);
}
async function save(groups) { await chrome.storage.local.set({ groups: groups, schema: SCHEMA }); }

function newGroup(fields) {
  return normGroup(Object.assign({ status: 'none', task: '', items: [] }, fields || {}));
}
function newItem(tab) {
  return normItem({ url: tabUrl(tab), title: cleanTitle(tab.title), favIconUrl: tab.favIconUrl || '' });
}
function unlink(g) {
  g.chromeGroupId = null; g.windowId = null;
  g.items.forEach(function (it) { it.tabId = null; });
}
function copy(x) { return JSON.parse(JSON.stringify(x)); }

async function addTrash(entries) {
  var r = await chrome.storage.local.get('trash');
  var keep = (Array.isArray(r.trash) ? r.trash : []).filter(function (e) { return now() - e.deletedAt < TRASH_DAYS * 864e5; });
  await chrome.storage.local.set({ trash: entries.concat(keep) });
}
function trashGroup(g, reason, extra) {
  var c = copy(g); unlink(c); c.openPeak = 0; c.restoreUntil = null;
  return Object.assign({ id: uid(), kind: 'group', deletedAt: now(), reason: reason, group: c }, extra || {});
}

async function snapshot() {
  var chromeGroups = await chrome.tabGroups.query({});
  var tabs = await chrome.tabs.query({});
  var byGroup = new Map(), byId = new Map();
  tabs.forEach(function (t) {
    if (t.incognito) return;
    byId.set(t.id, t);
    if (t.groupId == null || t.groupId === -1) return;
    if (!byGroup.has(t.groupId)) byGroup.set(t.groupId, []);
    byGroup.get(t.groupId).push(t);
  });
  byGroup.forEach(function (arr) { arr.sort(function (a, b) { return a.index - b.index; }); });
  return { chromeGroups: chromeGroups, byGroup: byGroup, byId: byId };
}

// פעם אחת בכל הפעלה של הדפדפן או של התוסף. אחרי טעינה מחדש של התוסף מזהי הלשוניות עדיין נכונים,
// ואז הקישור נשמר. אחרי הפעלה מחדש של הדפדפן הם משתנים, והקבוצה מחכה לשחזור.
async function ensureBoot(snap, groups) {
  var s = await chrome.storage.session.get('booted');
  if (s.booted) return false;
  await chrome.storage.session.set({ booted: true });
  var changed = false;
  groups.forEach(function (g) {
    if (g.chromeGroupId == null) return;
    var ids = new Set((snap.byGroup.get(g.chromeGroupId) || []).map(function (t) { return t.id; }));
    var open = g.items.filter(function (it) { return it.tabId != null; });
    var still = open.filter(function (it) { return ids.has(it.tabId); }).length;
    if (open.length && still * 2 >= open.length) return;
    unlink(g); g.restoreUntil = now() + RESTORE_MS; g.openPeak = 0; changed = true;
  });
  return changed;
}

// קבוצה שמורה שמתאימה לקבוצה שנפתחה בכרום. דורש אותו שם (שתי קבוצות בלי שם נחשבות אותו שם).
// קבוצה שמחכה לשחזור: מספיק ש-80% מהלשוניות שכבר חזרו נמצאות בה. אחרת: 80% חפיפה לשני הכיוונים.
function matchSaved(groups, cg, ctabs) {
  var keys = ctabs.map(function (t) { return pageKey(tabUrl(t)); });
  var title = cg.title || '';
  var t0 = now(), best = null, bestScore = 0;
  groups.forEach(function (g) {
    if (g.chromeGroupId != null || !g.items.length) return;
    var restoring = g.restoreUntil && g.restoreUntil > t0;
    if (!(g.name === title || (restoring && !title))) return;
    var gkeys = new Set(g.items.map(function (it) { return pageKey(it.url); }));
    var inter = keys.filter(function (k) { return gkeys.has(k); }).length;
    if (!inter) return;
    var ratio = inter / Math.max(keys.length, gkeys.size);
    if (restoring ? inter / keys.length < 0.8 : ratio < 0.8) return;
    var score = ratio + (restoring ? 1 : 0);
    if (score > bestScore) { best = g; bestScore = score; }
  });
  return best;
}

function itemSig(it) { return [it.id, it.url, it.title, it.favIconUrl, it.tabId, it.customTitle, it.note].join('\u0001'); }
function groupSig(g) { return [g.name, g.color, g.windowId, g.stripPos, g.openPeak].join('\u0001') + '\u0002' + g.items.map(itemSig).join('\u0002'); }

// מעדכן קבוצה לפי הלשוניות שלה בכרום. פריט בלי לשונית (לא פתוח) נשאר בקבוצה.
// פריט עם כותרת משלו או הערה נשאר צמוד לדף שלו: כשהלשונית עוברת לדף אחר, הוא נשאר כלא פתוח.
function syncGroup(g, cg, ctabs, linking, tabIndex) {
  var before = groupSig(g);
  if (!(linking && !cg.title)) g.name = cg.title || '';
  if (cg.color) g.color = cg.color;
  g.windowId = cg.windowId;
  var used = new Set(), next = [], orphans = [];
  ctabs.forEach(function (t) {
    var url = tabUrl(t);
    var it = g.items.find(function (o) { return !used.has(o.id) && o.tabId === t.id; });
    if (it && !isBlank(url) && pageKey(it.url) !== pageKey(url)) {
      if (it.customTitle || it.note) { it.tabId = null; used.add(it.id); orphans.push(it); it = null; }
      else it.title = '';
    }
    if (!it && isBlank(url)) return;
    if (!it) it = g.items.find(function (o) { return !used.has(o.id) && o.tabId == null && pageKey(o.url) === pageKey(url); });
    if (!it) {
      var from = tabIndex.get(t.id);
      if (from && from.g !== g) {
        it = from.it;
        from.g.items = from.g.items.filter(function (o) { return o !== it; });
        from.g.updatedAt = now();
      }
    }
    if (!it) it = newItem(t);
    used.add(it.id);
    it.tabId = t.id;
    if (!isBlank(url)) it.url = url;
    var title = cleanTitle(t.title);
    if (title && title !== url) it.title = title;
    if (t.favIconUrl) it.favIconUrl = t.favIconUrl;
    next.push(it);
  });
  var rest = g.items.filter(function (o) { return !used.has(o.id) && o.tabId == null; });
  g.items = next.concat(rest, orphans);
  g.openPeak = Math.max(g.openPeak || 0, next.length);
  g.stripPos = ctabs.length ? ctabs[0].index : 0;
  var changed = groupSig(g) !== before;
  if (changed) g.updatedAt = now();
  return changed;
}

async function reconcileNow() {
  var snap = await snapshot();
  var groups = await load();
  var changed = await ensureBoot(snap, groups);
  var t0 = now();
  var liveIds = new Set(snap.chromeGroups.map(function (c) { return c.id; }));
  ignoreChrome.forEach(function (exp, id) { if (exp < t0) ignoreChrome.delete(id); });
  var trashed = [];

  // קבוצה שנעלמה מכרום: נסגרה (נשמרת), פורקה (לסל), או רוקנה לשונית אחרי לשונית (לסל)
  groups.slice().forEach(function (g) {
    if (g.chromeGroupId == null || liveIds.has(g.chromeGroupId)) return;
    var open = g.items.filter(function (it) { return it.tabId != null; });
    var loose = open.filter(function (it) {
      var t = snap.byId.get(it.tabId);
      return t && (t.groupId == null || t.groupId === -1);
    }).length;
    var reason = null;
    if (open.length && loose * 2 >= open.length) reason = 'ungrouped';
    else if (open.length === 1 && g.openPeak > 1 && g.items.length === 1) reason = 'emptied';
    unlink(g); g.openPeak = 0; g.updatedAt = t0; changed = true;
    if (reason) { groups.splice(groups.indexOf(g), 1); trashed.push(trashGroup(g, reason)); }
  });
  groups.forEach(function (g) { if (g.restoreUntil && g.restoreUntil < t0) { g.restoreUntil = null; changed = true; } });

  var tabIndex = new Map();
  groups.forEach(function (g) {
    if (g.chromeGroupId == null) return;
    g.items.forEach(function (it) { if (it.tabId != null) tabIndex.set(it.tabId, { g: g, it: it }); });
  });

  for (var i = 0; i < snap.chromeGroups.length; i++) {
    var cg = snap.chromeGroups[i];
    if (ignoreChrome.has(cg.id)) continue;
    var ctabs = snap.byGroup.get(cg.id) || [];
    if (!ctabs.length) continue;
    var g = groups.find(function (x) { return x.chromeGroupId === cg.id; });
    var linking = false;
    if (!g) {
      g = matchSaved(groups, cg, ctabs);
      if (g) {
        linking = true;
        g.chromeGroupId = cg.id; g.restoreUntil = null; g.openPeak = 0; g.lastActiveAt = t0;
        if (g.name && !cg.title) { try { await chrome.tabGroups.update(cg.id, { title: g.name, color: g.color }); } catch (e) {} }
      } else {
        if (ctabs.every(function (t) { return isBlank(tabUrl(t)); })) continue;
        g = newGroup({ name: cg.title || '', color: cg.color, chromeGroupId: cg.id });
        groups.unshift(g);
      }
      changed = true;
    }
    if (syncGroup(g, cg, ctabs, linking, tabIndex)) changed = true;
  }

  var kept = groups.filter(function (g) { return g.chromeGroupId != null || g.items.length; });
  if (kept.length !== groups.length) { groups = kept; changed = true; }
  if (trashed.length) await addTrash(trashed);
  if (changed) await save(groups);
}

// ---------- פעולות מהחלונית ----------

async function withData(fn) {
  var snap = await snapshot();
  var groups = await load();
  await ensureBoot(snap, groups);
  var res = await fn(groups, snap);
  await save(groups.filter(function (x) { return x.chromeGroupId != null || x.items.length; }));
  return res;
}
function find(groups, id) {
  var g = groups.find(function (x) { return x.id === id; });
  if (!g) throw new Error('הקבוצה לא נמצאה. אולי היא נמחקה.');
  return g;
}
function findItem(g, itemId) {
  var it = g.items.find(function (x) { return x.id === itemId; });
  if (!it) throw new Error('הפריט לא נמצא. אולי הוא נמחק.');
  return it;
}
async function tabExists(tabId) {
  if (tabId == null) return null;
  try { return await chrome.tabs.get(tabId); } catch (e) { return null; }
}
async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}
async function lastWindow() {
  try { return await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch (e) { return null; }
}
// סוגר לשוניות. אם אלה כל הלשוניות של חלון, קודם פותח בו לשונית חדשה, כדי שהחלון לא ייסגר.
async function closeTabsSafely(tabIds) {
  tabIds = tabIds.filter(function (x) { return x != null; });
  if (!tabIds.length) return;
  var all = await chrome.tabs.query({});
  var closing = new Set(tabIds);
  var byWin = new Map();
  all.forEach(function (t) { if (!byWin.has(t.windowId)) byWin.set(t.windowId, []); byWin.get(t.windowId).push(t); });
  for (var entry of byWin) {
    var tabs = entry[1];
    if (tabs.every(function (t) { return closing.has(t.id); })) await chrome.tabs.create({ windowId: entry[0], active: true });
  }
  var existing = tabIds.filter(function (id) { return all.some(function (t) { return t.id === id; }); });
  if (existing.length) await chrome.tabs.remove(existing);
}
// פותח לשוניות לפריטים ומדלג על כתובות שכרום לא מאפשר לפתוח
async function openTabs(items, windowId, firstActive) {
  var opened = [], skipped = [];
  for (var i = 0; i < items.length; i++) {
    try {
      var t = await chrome.tabs.create({ windowId: windowId, url: items[i].url, active: firstActive && !opened.length });
      items[i].tabId = t.id; opened.push(t.id);
    } catch (e) { skipped.push(items[i].customTitle || items[i].title || items[i].url); }
  }
  return { opened: opened, skipped: skipped };
}

var handlers = {
  reconcile: function () { return reconcileNow(); },

  setName: function (m) {
    return withData(async function (groups) {
      var g = find(groups, m.id);
      g.name = String(m.name || '').trim(); g.updatedAt = now();
      if (g.chromeGroupId != null) { try { await chrome.tabGroups.update(g.chromeGroupId, { title: g.name }); } catch (e) {} }
    });
  },
  setStatus: function (m) {
    if (STATUSES.indexOf(m.status) < 0) throw new Error('סטטוס לא מוכר');
    return withData(function (groups) { var g = find(groups, m.id); g.status = m.status; g.updatedAt = now(); });
  },
  setTask: function (m) {
    return withData(function (groups) { var g = find(groups, m.id); g.task = String(m.task || ''); g.updatedAt = now(); });
  },
  setPinned: function (m) {
    return withData(function (groups) { var g = find(groups, m.id); g.pinned = !!m.pinned; g.updatedAt = now(); });
  },
  setItemTitle: function (m) {
    return withData(function (groups) { var it = findItem(find(groups, m.id), m.itemId); it.customTitle = String(m.title || '').trim() || null; });
  },
  setItemNote: function (m) {
    return withData(function (groups) { var it = findItem(find(groups, m.id), m.itemId); it.note = String(m.note || '').trim(); });
  },

  // "סיימתי": הפריט עובר לסל. אם זה הפריט האחרון בקבוצה שמורה, כל הקבוצה עוברת לסל.
  removeItem: function (m) {
    return withData(async function (groups) {
      var g = find(groups, m.id), it = findItem(g, m.itemId);
      var index = g.items.indexOf(it), entry;
      if (g.items.length === 1 && g.chromeGroupId == null) {
        entry = trashGroup(g, 'removed');
        groups.splice(groups.indexOf(g), 1);
      } else {
        entry = { id: uid(), kind: 'item', deletedAt: now(), reason: 'done', groupId: g.id, groupName: g.name, index: index, item: Object.assign(copy(it), { tabId: null }) };
        g.items.splice(index, 1); g.updatedAt = now();
      }
      await addTrash([entry]);
      if (g.chromeGroupId != null && it.tabId != null) await closeTabsSafely([it.tabId]);
      return { trashId: entry.id };
    });
  },

  openItem: function (m) {
    return withData(async function (groups) {
      var g = find(groups, m.id), it = findItem(g, m.itemId);
      g.lastActiveAt = now();
      var tab = await tabExists(it.tabId);
      if (tab) { if (!m.background) await focusTab(tab); return; }
      // הדף כבר פתוח בלשונית אחרת: עוברים אליה
      var key = pageKey(it.url);
      var same = (await chrome.tabs.query({})).find(function (t) { return !t.incognito && pageKey(tabUrl(t)) === key; });
      if (same) { if (!m.background) await focusTab(same); return; }
      var win = g.chromeGroupId != null ? { id: g.windowId } : await lastWindow();
      var created;
      try { created = await chrome.tabs.create(Object.assign({ url: it.url, active: !m.background }, win && win.id != null ? { windowId: win.id } : {})); }
      catch (e) { throw new Error('כרום לא מאפשר לפתוח את הכתובת הזו מתוך התוסף.'); }
      if (g.chromeGroupId != null) {
        try { await chrome.tabs.group({ groupId: g.chromeGroupId, tabIds: [created.id] }); it.tabId = created.id; } catch (e) {}
      }
    });
  },

  // פתיחת קבוצה שמורה כקבוצה בכרום, או הצגה של קבוצה פתוחה (ופתיחת הפריטים שלה שעוד לא פתוחים)
  openGroup: function (m) {
    return withData(async function (groups) {
      var g = find(groups, m.id);
      g.lastActiveAt = now();
      if (g.chromeGroupId != null) {
        var waiting = g.items.filter(function (it) { return it.tabId == null; });
        var res = await openTabs(waiting, g.windowId, false);
        if (res.opened.length) { try { await chrome.tabs.group({ groupId: g.chromeGroupId, tabIds: res.opened }); } catch (e) {} }
        try { await chrome.tabGroups.update(g.chromeGroupId, { collapsed: false }); } catch (e) {}
        var first = g.items.find(function (x) { return x.tabId != null; });
        var tab = first && await tabExists(first.tabId);
        if (tab) await focusTab(tab);
        return { skipped: res.skipped };
      }
      var win = await lastWindow();
      if (!win) win = await chrome.windows.create({});
      var r = await openTabs(g.items, win.id, true);
      if (!r.opened.length) throw new Error('לא הצלחתי לפתוח אף קישור מהקבוצה.');
      var gid = await chrome.tabs.group({ tabIds: r.opened, createProperties: { windowId: win.id } });
      try { await chrome.tabGroups.update(gid, { title: g.name || '', color: g.color, collapsed: false }); } catch (e) {}
      g.chromeGroupId = gid; g.windowId = win.id; g.openPeak = r.opened.length; g.restoreUntil = null;
      return { skipped: r.skipped };
    });
  },

  // סגירה בכרום. הקבוצה נשארת בתוסף כשמורה.
  closeGroup: function (m) {
    return withData(async function (groups, snap) {
      var g = find(groups, m.id);
      if (g.chromeGroupId == null) return;
      var cgid = g.chromeGroupId;
      var cg = snap.chromeGroups.find(function (c) { return c.id === cgid; });
      var ctabs = snap.byGroup.get(cgid) || [];
      if (cg && ctabs.length) syncGroup(g, cg, ctabs, false, new Map());
      ignoreChrome.set(cgid, now() + IGNORE_MS);
      unlink(g); g.openPeak = 0; g.updatedAt = now();
      await closeTabsSafely(ctabs.map(function (t) { return t.id; }));
    });
  },

  deleteGroup: function (m) {
    return withData(async function (groups, snap) {
      var g = find(groups, m.id);
      var cgid = g.chromeGroupId;
      var entry = trashGroup(g, 'deleted');
      groups.splice(groups.indexOf(g), 1);
      await addTrash([entry]);
      if (cgid != null) {
        ignoreChrome.set(cgid, now() + IGNORE_MS);
        await closeTabsSafely((snap.byGroup.get(cgid) || []).map(function (t) { return t.id; }));
      }
      return { trashId: entry.id };
    });
  },

  // העברת פריט לקבוצה אחרת או למקום אחר באותה קבוצה. לשונית פתוחה עוברת גם בכרום.
  moveItem: function (m) {
    return withData(async function (groups) {
      var from = find(groups, m.id), to = find(groups, m.toId), it = findItem(from, m.itemId);
      var target = typeof m.beforeItemId === 'string' ? to.items.find(function (x) { return x.id === m.beforeItemId; }) : null;
      from.items.splice(from.items.indexOf(it), 1);
      var at = target ? to.items.indexOf(target) : to.items.length;
      to.items.splice(at < 0 ? to.items.length : at, 0, it);
      from.updatedAt = to.updatedAt = now();
      var tab = await tabExists(it.tabId);
      if (!tab) { it.tabId = null; return; }
      if (to.chromeGroupId != null) {
        if (from !== to) await chrome.tabs.group({ groupId: to.chromeGroupId, tabIds: [tab.id] });
        var ref = target && await tabExists(target.tabId);
        if (ref) await chrome.tabs.move(tab.id, { index: ref.index > tab.index && from === to ? ref.index - 1 : ref.index });
      } else {
        it.tabId = null;
        await closeTabsSafely([tab.id]);
      }
    });
  },

  // מיזוג: כל הפריטים עוברים לקבוצה השנייה, והקבוצה הריקה נשמרת בסל כדי שאפשר יהיה לבטל
  mergeGroups: function (m) {
    return withData(async function (groups) {
      var from = find(groups, m.id), to = find(groups, m.intoId);
      if (from === to) return;
      var keys = new Set(to.items.map(function (x) { return pageKey(x.url); }));
      var moving = from.items.filter(function (x) { return !keys.has(pageKey(x.url)); });
      var entry = trashGroup(from, 'merged', { mergedInto: to.id, itemIds: moving.map(function (x) { return x.id; }) });
      var openTabIds = [];
      moving.forEach(function (x) { to.items.push(x); if (x.tabId != null) openTabIds.push(x.tabId); });
      var dupTabs = from.items.filter(function (x) { return keys.has(pageKey(x.url)) && x.tabId != null; }).map(function (x) { return x.tabId; });
      groups.splice(groups.indexOf(from), 1);
      to.updatedAt = now();
      if (from.chromeGroupId != null) ignoreChrome.set(from.chromeGroupId, now() + IGNORE_MS);
      if (to.chromeGroupId != null && openTabIds.length) await chrome.tabs.group({ groupId: to.chromeGroupId, tabIds: openTabIds });
      else if (openTabIds.length) { moving.forEach(function (x) { x.tabId = null; }); await closeTabsSafely(openTabIds); }
      if (dupTabs.length) await closeTabsSafely(dupTabs);
      await addTrash([entry]);
      return { trashId: entry.id };
    });
  },

  // הוספת הלשונית הנוכחית. target: מזהה קבוצה או 'new'
  addTab: async function (m) {
    var tab = await chrome.tabs.get(m.tabId);
    if (!/^(https?|file):/.test(tabUrl(tab))) throw new Error('אי אפשר לשמור את הלשונית הזו.');
    if (m.target === 'new') { await chrome.tabs.group({ tabIds: [tab.id] }); schedule(); return {}; }
    return withData(async function (groups) {
      var g = find(groups, m.target);
      g.lastActiveAt = now();
      if (g.chromeGroupId != null) { await chrome.tabs.group({ groupId: g.chromeGroupId, tabIds: [tab.id] }); schedule(); return {}; }
      if (g.items.some(function (x) { return pageKey(x.url) === pageKey(tabUrl(tab)); })) return { already: true };
      g.items.push(newItem(tab)); g.updatedAt = now();
      return {};
    });
  },
  // קישור מתפריט הלחיצה הימנית. בקבוצה פתוחה הוא נכנס כפריט לא פתוח.
  addLink: function (m) {
    if (!/^(https?|file):/.test(m.url || '')) throw new Error('אי אפשר לשמור את הקישור הזה.');
    return withData(function (groups) {
      var g = m.target === 'new' ? null : find(groups, m.target);
      if (!g) { g = newGroup({}); groups.unshift(g); }
      if (g.items.some(function (x) { return pageKey(x.url) === pageKey(m.url); })) return { already: true };
      g.items.push(normItem({ url: m.url, title: cleanTitle(m.title) })); g.updatedAt = now();
      return {};
    });
  },
  // כל הלשוניות שלא בקבוצה בחלון הופכות לקבוצה חדשה בכרום
  saveWindow: async function (m) {
    var tabs = (await chrome.tabs.query({ windowId: m.windowId })).filter(function (t) {
      return !t.pinned && (t.groupId == null || t.groupId === -1) && /^(https?|file):/.test(tabUrl(t));
    });
    if (!tabs.length) throw new Error('אין בחלון לשוניות שלא בקבוצה.');
    await chrome.tabs.group({ tabIds: tabs.map(function (t) { return t.id; }), createProperties: { windowId: m.windowId } });
    schedule();
    return { count: tabs.length };
  },

  restore: async function (m) {
    var r = await chrome.storage.local.get('trash');
    var trash = Array.isArray(r.trash) ? r.trash : [];
    var e = trash.find(function (x) { return x.id === m.trashId; });
    if (!e) throw new Error('הפריט כבר לא בסל.');
    await withData(function (groups) {
      if (e.kind === 'snapshot') {
        var live = groups.filter(function (g) { return g.chromeGroupId != null; });
        var liveIds = new Set(live.map(function (g) { return g.id; }));
        groups.splice(0, groups.length);
        live.concat(e.groups.map(normGroup).filter(function (g) { return !liveIds.has(g.id); })).forEach(function (g) { groups.push(g); });
        return;
      }
      if (e.kind === 'item') {
        var g = groups.find(function (x) { return x.id === e.groupId; });
        if (!g) { g = newGroup({ name: e.groupName || '' }); groups.unshift(g); }
        g.items.splice(Math.min(e.index, g.items.length), 0, normItem(copy(e.item)));
        g.updatedAt = now();
        return;
      }
      if (e.mergedInto) {
        var into = groups.find(function (x) { return x.id === e.mergedInto; });
        if (into) into.items = into.items.filter(function (x) { return e.itemIds.indexOf(x.id) < 0; });
      }
      if (!groups.some(function (x) { return x.id === e.group.id; })) groups.unshift(normGroup(copy(e.group)));
    });
    await chrome.storage.local.set({ trash: trash.filter(function (x) { return x !== e; }) });
    schedule();
    return {};
  },
  purgeTrash: async function (m) {
    var r = await chrome.storage.local.get('trash');
    var trash = Array.isArray(r.trash) ? r.trash : [];
    await chrome.storage.local.set({ trash: m.trashId ? trash.filter(function (x) { return x.id !== m.trashId; }) : [] });
    return {};
  },

  // ייבוא. "merge" מוסיף, "replace" מחליף את השמורות (והמצב הקודם נשמר בסל).
  // קבוצה שפתוחה עכשיו בכרום לא נמחקת: קבוצה מהקובץ עם אותו שם וחפיפה של חצי לפחות מתמזגת לתוכה.
  importData: function (m) {
    if (!Array.isArray(m.groups)) throw new Error('הקובץ לא תקין. צריך קובץ שנוצר ב"ייצוא".');
    var incoming = m.groups.filter(function (g) { return g && Array.isArray(g.items); }).map(function (g) {
      var ng = normGroup({
        name: String(g.name || ''), color: g.color, status: g.status, task: String(g.task || ''), pinned: !!g.pinned,
        createdAt: g.createdAt, lastActiveAt: g.lastActiveAt, updatedAt: g.updatedAt,
        items: g.items.filter(function (it) { return it && /^(https?|file):/.test(String(it.url || '')); }).map(function (it) {
          return { url: it.url, title: it.title, customTitle: it.customTitle, note: it.note, favIconUrl: it.favIconUrl, addedAt: it.addedAt };
        })
      });
      return ng;
    }).filter(function (g) { return g.items.length; });
    return withData(async function (groups) {
      if (m.mode === 'replace') {
        var saved = groups.filter(function (g) { return g.chromeGroupId == null; });
        await addTrash([{ id: uid(), kind: 'snapshot', deletedAt: now(), reason: 'import', groups: copy(saved) }]);
        for (var i = groups.length - 1; i >= 0; i--) if (groups[i].chromeGroupId == null) groups.splice(i, 1);
      }
      var added = 0, joined = 0;
      incoming.forEach(function (ng) {
        var keys = new Set(ng.items.map(function (x) { return pageKey(x.url); }));
        var same = groups.find(function (g) {
          if (g.name !== ng.name) return false;
          var inter = g.items.filter(function (x) { return keys.has(pageKey(x.url)); }).length;
          return inter * 2 >= Math.max(keys.size, g.items.length);
        });
        if (!same) { groups.push(ng); added++; return; }
        joined++;
        if (same.status === 'none') same.status = ng.status;
        if (!same.task) same.task = ng.task;
        same.pinned = same.pinned || ng.pinned;
        ng.items.forEach(function (x) {
          var mine = same.items.find(function (y) { return pageKey(y.url) === pageKey(x.url); });
          if (!mine) { x.tabId = null; same.items.push(x); return; }
          if (!mine.customTitle && x.customTitle) mine.customTitle = x.customTitle;
          if (!mine.note && x.note) mine.note = x.note;
        });
      });
      return { added: added, joined: joined };
    });
  }
};

chrome.runtime.onMessage.addListener(function (msg, sender, send) {
  var h = handlers[msg && msg.type];
  if (!h) { send({ ok: false, error: 'פעולה לא מוכרת' }); return; }
  enqueue(function () { return h(msg); }).then(
    function (r) { send(Object.assign({ ok: true }, r || {})); },
    function (e) {
      var text = String((e && e.message) || e);
      // שגיאות של כרום מגיעות באנגלית. החלונית מציגה רק עברית.
      send({ ok: false, error: /[֐-׿]/.test(text) ? text : 'הפעולה נכשלה. נסה שוב.', detail: text });
    }
  );
  return true;
});

// ---------- תפריט לחיצה ימנית ----------
var menuTimer = null;
function buildMenus() {
  clearTimeout(menuTimer);
  menuTimer = setTimeout(async function () {
    if (!chrome.contextMenus) return;
    var groups = await load();
    var list = groups.filter(function (g) { return g.status !== 'archive'; }).sort(function (a, b) {
      return (b.chromeGroupId != null) - (a.chromeGroupId != null) || b.pinned - a.pinned || b.lastActiveAt - a.lastActiveAt;
    }).slice(0, 12);
    chrome.contextMenus.removeAll(function () {
      var ctx = ['page', 'link'];
      chrome.contextMenus.create({ id: 'k', title: 'שמירה בכרטיסיות', contexts: ctx });
      chrome.contextMenus.create({ id: 'k:new', parentId: 'k', title: 'קבוצה חדשה', contexts: ctx });
      if (list.length) chrome.contextMenus.create({ id: 'k:sep', parentId: 'k', type: 'separator', contexts: ctx });
      list.forEach(function (g) {
        var host = '';
        try { host = new URL(g.items[0].url).hostname.replace(/^www\./, ''); } catch (e) {}
        chrome.contextMenus.create({ id: 'k:' + g.id, parentId: 'k', title: g.name || ('ללא שם, ' + host), contexts: ctx });
      });
    });
  }, 1500);
}
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(function (info, tab) {
    var id = String(info.menuItemId);
    if (id.indexOf('k:') !== 0 || id === 'k:sep') return;
    var target = id === 'k:new' ? 'new' : id.slice(2);
    var msg = info.linkUrl
      ? { type: 'addLink', url: info.linkUrl, title: info.selectionText || '', target: target }
      : { type: 'addTab', tabId: tab && tab.id, target: target };
    enqueue(function () { return handlers[msg.type](msg); }).catch(function (e) { console.warn('[כרטיסיות]', e); });
  });
}
chrome.storage.onChanged.addListener(function (changes, area) { if (area === 'local' && changes.groups) buildMenus(); });

// ---------- אירועים ----------
var TAB_KEYS = ['title', 'url', 'groupId', 'favIconUrl', 'pinned'];
chrome.tabs.onUpdated.addListener(function (id, info) {
  if (TAB_KEYS.some(function (k) { return k in info; }) || info.status === 'complete') schedule();
});
chrome.tabs.onCreated.addListener(onEvent);
chrome.tabs.onRemoved.addListener(onEvent);
chrome.tabs.onMoved.addListener(onEvent);
chrome.tabs.onAttached.addListener(onEvent);
chrome.tabs.onDetached.addListener(onEvent);
chrome.tabs.onReplaced.addListener(onEvent);
chrome.tabGroups.onCreated.addListener(onEvent);
chrome.tabGroups.onUpdated.addListener(onEvent);
chrome.tabGroups.onRemoved.addListener(onEvent);
chrome.tabGroups.onMoved.addListener(onEvent);
chrome.runtime.onInstalled.addListener(function () { schedule(); buildMenus(); });
chrome.runtime.onStartup.addListener(function () { quietUntil = now() + STARTUP_MS; schedule(STARTUP_MS); buildMenus(); });

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
}
schedule(STARTUP_MS);
