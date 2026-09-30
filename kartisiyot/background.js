// כרטיסיות - סקריפט רקע
// מסנכרן את קבוצות הלשוניות של כרום עם הקבוצות השמורות בתוסף.
// כל שינוי בנתונים עובר דרך תור אחד, כדי ששני שינויים לא ידרסו זה את זה.

var SETTLE_MS = 1000;          // המתנה אחרי האירוע האחרון לפני סנכרון
var IGNORE_MS = 10000;         // כמה זמן להתעלם מקבוצה שהתוסף סוגר בעצמו
var STATUSES = ['none', 'watch', 'read', 'skim', 'working', 'archive'];

var queue = Promise.resolve();
var settleTimer = null;
var ignoreChrome = new Map(); // מזהה קבוצה בכרום -> זמן תפוגה

function enqueue(fn) {
  var p = queue.then(fn, fn);
  queue = p.catch(function (e) { console.error('[כרטיסיות]', e); });
  return p;
}

var STARTUP_MS = 4000;         // בפתיחת הדפדפן מחכים שכל הלשוניות ישוחזרו

function schedule(ms) {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(function () { enqueue(reconcileNow); }, typeof ms === 'number' ? ms : SETTLE_MS);
}
function onEvent() { schedule(); }

function now() { return Date.now(); }
function uid() { return crypto.randomUUID(); }
function tabUrl(t) { return t.url || t.pendingUrl || ''; }

async function load() {
  var r = await chrome.storage.local.get('groups');
  return Array.isArray(r.groups) ? r.groups : [];
}
async function save(groups) { await chrome.storage.local.set({ groups: groups }); }

function newGroup(fields) {
  var t = now();
  return Object.assign({
    id: uid(), name: '', color: 'grey', status: 'none', task: '',
    chromeGroupId: null, windowId: null,
    createdAt: t, updatedAt: t, lastActiveAt: t, items: []
  }, fields || {});
}
function newItem(tab) {
  return {
    id: uid(), url: tabUrl(tab), title: tab.title || '', customTitle: null,
    favIconUrl: tab.favIconUrl || '', tabId: null, addedAt: now()
  };
}

// אחרי הפעלה מחדש של הדפדפן המזהים של הקבוצות משתנים. מנתקים כל קבוצה שהמזהה שלה
// כבר לא מצביע על אותן לשוניות, והיא תחובר מחדש לפי התאמת כתובות.
async function ensureBoot(snap) {
  var s = await chrome.storage.session.get('booted');
  if (s.booted) return;
  await chrome.storage.session.set({ booted: true });
  var groups = await load();
  var changed = false;
  groups.forEach(function (g) {
    if (g.chromeGroupId == null) return;
    var ctabs = snap.byGroup.get(g.chromeGroupId) || [];
    var urls = new Set(ctabs.map(tabUrl));
    var inter = g.items.filter(function (it) { return urls.has(it.url); }).length;
    var same = ctabs.length && inter / Math.max(g.items.length, urls.size) >= 0.5;
    if (same) return;
    g.chromeGroupId = null; g.windowId = null; changed = true;
    g.items.forEach(function (it) { it.tabId = null; });
  });
  if (changed) await save(groups);
}

// חיפוש קבוצה שמורה שמתאימה לקבוצה שנפתחה בכרום (אחרי הפעלה מחדש או פתיחה מהשמורות של כרום)
function matchClosed(groups, cg, ctabs) {
  var urls = new Set(ctabs.map(tabUrl));
  var best = null, bestScore = 0;
  groups.forEach(function (g) {
    if (g.chromeGroupId != null || !g.items.length) return;
    var inter = 0;
    g.items.forEach(function (it) { if (urls.has(it.url)) inter++; });
    if (!inter) return;
    var ratio = inter / Math.max(g.items.length, urls.size);
    var titleOk = !!g.name && (cg.title || '') === g.name;
    if (!((titleOk && ratio >= 0.5) || ratio >= 0.8)) return;
    var score = ratio + (titleOk ? 1 : 0);
    if (score > bestScore) { best = g; bestScore = score; }
  });
  return best;
}

function itemSig(it) { return [it.id, it.url, it.title, it.favIconUrl, it.tabId].join('\u0001'); }

// מעדכן קבוצה שמורה לפי המצב שלה בכרום. מחזיר אמת אם משהו השתנה.
function syncGroup(g, cg, ctabs) {
  var changed = false;
  var name = cg.title || '';
  if (g.name !== name) { g.name = name; changed = true; }
  if (g.color !== cg.color) { g.color = cg.color; changed = true; }
  if (g.windowId !== cg.windowId) { g.windowId = cg.windowId; }

  var before = g.items.map(itemSig).join('\u0002');
  var used = new Set();
  var next = ctabs.map(function (t) {
    var it = g.items.find(function (o) { return !used.has(o.id) && o.tabId === t.id; }) ||
             g.items.find(function (o) { return !used.has(o.id) && o.url === tabUrl(t); });
    if (!it) it = newItem(t);
    used.add(it.id);
    it.tabId = t.id;
    it.url = tabUrl(t) || it.url;
    if (t.title) it.title = t.title;
    if (t.favIconUrl) it.favIconUrl = t.favIconUrl;
    return it;
  });
  g.items = next;
  if (next.map(itemSig).join('\u0002') !== before) changed = true;
  if (changed) { g.updatedAt = now(); g.lastActiveAt = now(); }
  return changed;
}

async function snapshot() {
  var chromeGroups = await chrome.tabGroups.query({});
  var tabs = await chrome.tabs.query({});
  var byGroup = new Map();
  tabs.forEach(function (t) {
    if (t.incognito || t.groupId == null || t.groupId === -1) return;
    if (!byGroup.has(t.groupId)) byGroup.set(t.groupId, []);
    byGroup.get(t.groupId).push(t);
  });
  byGroup.forEach(function (arr) { arr.sort(function (a, b) { return a.index - b.index; }); });
  return { chromeGroups: chromeGroups, byGroup: byGroup };
}

async function reconcileNow() {
  var snap = await snapshot();
  await ensureBoot(snap);
  var groups = await load();
  var liveIds = new Set(snap.chromeGroups.map(function (c) { return c.id; }));
  var t0 = now();
  var changed = false;
  ignoreChrome.forEach(function (exp, id) { if (exp < t0) ignoreChrome.delete(id); });

  // קבוצה שנסגרה בכרום נשארת בתוסף כקבוצה שמורה, עם הפריטים שהיו בה
  groups.forEach(function (g) {
    if (g.chromeGroupId != null && !liveIds.has(g.chromeGroupId)) {
      g.chromeGroupId = null; g.windowId = null;
      g.items.forEach(function (it) { it.tabId = null; });
      g.updatedAt = t0; changed = true;
    }
  });
  var kept = groups.filter(function (g) { return g.chromeGroupId != null || g.items.length > 0; });
  if (kept.length !== groups.length) { groups = kept; changed = true; }

  snap.chromeGroups.forEach(function (cg) {
    if (ignoreChrome.has(cg.id)) return;
    var ctabs = snap.byGroup.get(cg.id) || [];
    if (!ctabs.length) return;
    var g = groups.find(function (x) { return x.chromeGroupId === cg.id; });
    if (!g) {
      g = matchClosed(groups, cg, ctabs);
      if (!g) { g = newGroup({ name: cg.title || '', color: cg.color }); groups.unshift(g); }
      g.chromeGroupId = cg.id;
      changed = true;
    }
    if (syncGroup(g, cg, ctabs)) changed = true;
  });

  if (changed) await save(groups);
}

async function mutate(id, fn) {
  await ensureBoot(await snapshot());
  var groups = await load();
  var g = groups.find(function (x) { return x.id === id; });
  if (!g) throw new Error('הקבוצה לא נמצאה');
  var res = await fn(g, groups);
  var kept = groups.filter(function (x) { return x.chromeGroupId != null || x.items.length > 0; });
  await save(kept);
  return res;
}

async function tabExists(tabId) {
  if (tabId == null) return false;
  try { await chrome.tabs.get(tabId); return true; } catch (e) { return false; }
}

var handlers = {
  reconcile: function () { return reconcileNow(); },

  setName: function (m) {
    return mutate(m.id, async function (g) {
      g.name = (m.name || '').trim();
      g.updatedAt = now();
      if (g.chromeGroupId != null) {
        try { await chrome.tabGroups.update(g.chromeGroupId, { title: g.name }); } catch (e) {}
      }
    });
  },

  setStatus: function (m) {
    if (STATUSES.indexOf(m.status) < 0) throw new Error('סטטוס לא מוכר');
    return mutate(m.id, function (g) { g.status = m.status; g.updatedAt = now(); g.lastActiveAt = now(); });
  },

  setTask: function (m) {
    return mutate(m.id, function (g) { g.task = m.task || ''; g.updatedAt = now(); g.lastActiveAt = now(); });
  },

  setItemTitle: function (m) {
    return mutate(m.id, function (g) {
      var it = g.items.find(function (x) { return x.id === m.itemId; });
      if (it) it.customTitle = (m.title || '').trim() || null;
    });
  },

  deleteItem: function (m) {
    return mutate(m.id, async function (g) {
      var it = g.items.find(function (x) { return x.id === m.itemId; });
      if (!it) return;
      g.items = g.items.filter(function (x) { return x.id !== m.itemId; });
      g.updatedAt = now();
      if (g.chromeGroupId != null && await tabExists(it.tabId)) {
        await chrome.tabs.remove(it.tabId);
      }
    });
  },

  openItem: function (m) {
    return mutate(m.id, async function (g) {
      var it = g.items.find(function (x) { return x.id === m.itemId; });
      if (!it) return;
      g.lastActiveAt = now();
      if (await tabExists(it.tabId)) {
        var tab = await chrome.tabs.update(it.tabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } else {
        var win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(function () { return null; });
        await chrome.tabs.create(win ? { url: it.url, windowId: win.id } : { url: it.url });
      }
    });
  },

  // פתיחת קבוצה שמורה כקבוצה בכרום, או הצגה של קבוצה שכבר פתוחה
  openGroup: function (m) {
    return mutate(m.id, async function (g) {
      g.lastActiveAt = now();
      if (g.chromeGroupId != null) {
        var first = g.items.find(function (x) { return x.tabId != null; });
        try { await chrome.tabGroups.update(g.chromeGroupId, { collapsed: false }); } catch (e) {}
        if (first && await tabExists(first.tabId)) {
          var tab = await chrome.tabs.update(first.tabId, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        return;
      }
      var win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(function () { return null; });
      if (!win) win = await chrome.windows.create({});
      var tabIds = [];
      for (var i = 0; i < g.items.length; i++) {
        var t = await chrome.tabs.create({ windowId: win.id, url: g.items[i].url, active: i === 0 });
        g.items[i].tabId = t.id;
        tabIds.push(t.id);
      }
      if (!tabIds.length) return;
      var gid = await chrome.tabs.group({ tabIds: tabIds, createProperties: { windowId: win.id } });
      await chrome.tabGroups.update(gid, { title: g.name || '', color: g.color || 'grey', collapsed: false });
      g.chromeGroupId = gid;
      g.windowId = win.id;
    });
  },

  // סגירת קבוצה פתוחה בכרום. היא נשארת בתוסף כשמורה.
  closeGroup: function (m) {
    return mutate(m.id, async function (g) {
      if (g.chromeGroupId == null) return;
      var cgid = g.chromeGroupId;
      var snap = await snapshot();
      var cg = snap.chromeGroups.find(function (c) { return c.id === cgid; });
      var ctabs = snap.byGroup.get(cgid) || [];
      if (cg && ctabs.length) syncGroup(g, cg, ctabs);
      ignoreChrome.set(cgid, now() + IGNORE_MS);
      g.chromeGroupId = null; g.windowId = null;
      g.items.forEach(function (it) { it.tabId = null; });
      g.updatedAt = now();
      if (ctabs.length) await chrome.tabs.remove(ctabs.map(function (t) { return t.id; }));
    });
  },

  deleteGroup: function (m) {
    return mutate(m.id, async function (g, groups) {
      var cgid = g.chromeGroupId;
      g.items = [];
      g.chromeGroupId = null;
      var idx = groups.indexOf(g);
      if (idx >= 0) groups.splice(idx, 1);
      if (cgid != null) {
        ignoreChrome.set(cgid, now() + IGNORE_MS);
        var tabs = await chrome.tabs.query({ groupId: cgid });
        if (tabs.length) await chrome.tabs.remove(tabs.map(function (t) { return t.id; }));
      }
    });
  },

  // הוספת הלשונית הנוכחית לקבוצה. target: מזהה קבוצה או 'new'
  addTab: async function (m) {
    var tab = await chrome.tabs.get(m.tabId);
    if (m.target === 'new') {
      await chrome.tabs.group({ tabIds: [tab.id] });
      schedule();
      return;
    }
    return mutate(m.target, async function (g) {
      g.lastActiveAt = now();
      if (g.chromeGroupId != null) {
        await chrome.tabs.group({ groupId: g.chromeGroupId, tabIds: [tab.id] });
        schedule();
      } else {
        if (g.items.some(function (x) { return x.url === tabUrl(tab); })) return;
        g.items.push(newItem(tab));
        g.updatedAt = now();
      }
    });
  },

  importData: async function (m) {
    if (!Array.isArray(m.groups)) throw new Error('הקובץ לא תקין');
    var groups = m.groups.filter(function (g) { return g && Array.isArray(g.items); }).map(function (g) {
      var ng = newGroup({
        name: String(g.name || ''), color: g.color || 'grey',
        status: STATUSES.indexOf(g.status) >= 0 ? g.status : 'none',
        task: String(g.task || ''), createdAt: g.createdAt || now(),
        lastActiveAt: g.lastActiveAt || now()
      });
      ng.items = g.items.filter(function (it) { return it && it.url; }).map(function (it) {
        return {
          id: uid(), url: String(it.url), title: String(it.title || ''),
          customTitle: it.customTitle || null, favIconUrl: it.favIconUrl || '',
          tabId: null, addedAt: it.addedAt || now()
        };
      });
      return ng;
    }).filter(function (g) { return g.items.length; });
    await save(groups);
    await reconcileNow();
    return { count: groups.length };
  }
};

chrome.runtime.onMessage.addListener(function (msg, sender, send) {
  var h = handlers[msg && msg.type];
  if (!h) { send({ ok: false, error: 'פעולה לא מוכרת' }); return; }
  enqueue(function () { return h(msg); }).then(
    function (r) { send(Object.assign({ ok: true }, r || {})); },
    function (e) { send({ ok: false, error: String((e && e.message) || e) }); }
  );
  return true;
});

var TAB_KEYS = ['title', 'url', 'groupId', 'favIconUrl', 'pinned'];
chrome.tabs.onUpdated.addListener(function (id, info) {
  if (TAB_KEYS.some(function (k) { return k in info; }) || info.status === 'complete') schedule();
});
chrome.tabs.onRemoved.addListener(onEvent);
chrome.tabs.onMoved.addListener(onEvent);
chrome.tabs.onAttached.addListener(onEvent);
chrome.tabs.onDetached.addListener(onEvent);
chrome.tabGroups.onCreated.addListener(onEvent);
chrome.tabGroups.onUpdated.addListener(onEvent);
chrome.tabGroups.onRemoved.addListener(onEvent);
chrome.tabGroups.onMoved.addListener(onEvent);
chrome.runtime.onInstalled.addListener(onEvent);
chrome.runtime.onStartup.addListener(function () { schedule(STARTUP_MS); });

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
}
schedule(STARTUP_MS);
