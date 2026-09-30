// A small fake Chrome for testing background.js in Node. Tabs, tab groups, windows and storage
// behave like the real APIs closely enough for the sync logic. Timers are recorded, not run.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'kartisiyot', 'background.js');
const SRC = fs.readFileSync(process.env.BG_FILE || FILE, 'utf8');
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function createBrowser(opts = {}) {
  const st = {
    local: clone(opts.local) || {}, session: {}, tabs: [], groups: [],
    nextTabId: opts.firstTabId || 1, nextGroupId: opts.firstGroupId || 1000, nextWinId: 2,
    windows: [{ id: 1, type: 'normal' }], writes: 0, timers: [], menus: [],
  };
  const L = {};
  const ev = (name) => { L[name] = []; return { addListener: (fn) => L[name].push(fn) }; };
  const fire = (name, ...a) => (L[name] || []).forEach((fn) => fn(...a));
  const pick = (obj, keys) => {
    if (keys == null) return clone(obj);
    const out = {};
    (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in obj) out[k] = clone(obj[k]); });
    return out;
  };
  const reindex = () => {
    st.windows.forEach((w) => st.tabs.filter((t) => t.windowId === w.id).forEach((t, i) => { t.index = i; }));
  };
  const dropEmpty = () => {
    st.groups = st.groups.filter((g) => {
      const alive = st.tabs.some((t) => t.groupId === g.id);
      if (!alive) fire('tabGroups.onRemoved', clone(g));
      return alive;
    });
    st.windows = st.windows.filter((w) => st.tabs.some((t) => t.windowId === w.id) || w.keep);
  };
  const tab = (id) => { const t = st.tabs.find((x) => x.id === id); if (!t) throw new Error('No tab with id: ' + id + '.'); return t; };
  const makeTab = (url, windowId, groupId, title) => {
    const t = { id: st.nextTabId++, url, title: title == null ? 'Title of ' + url : title, favIconUrl: '', groupId: groupId == null ? -1 : groupId, windowId: windowId || 1, index: 0, incognito: false, pinned: false };
    st.tabs.push(t);
    if (!st.windows.some((w) => w.id === t.windowId)) st.windows.push({ id: t.windowId, type: 'normal' });
    reindex();
    return t;
  };

  const chrome = {
    storage: {
      local: {
        get: async (k) => pick(st.local, k),
        set: async (o) => {
          st.writes++;
          const changes = {};
          Object.keys(o).forEach((k) => { changes[k] = { oldValue: clone(st.local[k]), newValue: clone(o[k]) }; });
          Object.assign(st.local, clone(o));
          fire('storage.onChanged', changes, 'local');
        },
      },
      session: { get: async (k) => pick(st.session, k), set: async (o) => { Object.assign(st.session, clone(o)); } },
      onChanged: ev('storage.onChanged'),
    },
    tabGroups: {
      query: async () => clone(st.groups),
      update: async (id, p) => {
        const g = st.groups.find((x) => x.id === id);
        if (!g) throw new Error('No group with id: ' + id + '.');
        if (p.color && !['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'].includes(p.color)) throw new Error('Invalid color');
        Object.assign(g, p); fire('tabGroups.onUpdated', clone(g)); return clone(g);
      },
      onCreated: ev('tabGroups.onCreated'), onUpdated: ev('tabGroups.onUpdated'), onRemoved: ev('tabGroups.onRemoved'), onMoved: ev('tabGroups.onMoved'),
    },
    tabs: {
      query: async (q = {}) => clone(st.tabs.filter((t) =>
        (q.groupId == null || t.groupId === q.groupId) && (q.windowId == null || t.windowId === q.windowId) &&
        (!q.active || t.id === st.activeTabId))),
      get: async (id) => clone(tab(id)),
      create: async (p) => {
        if (/^(chrome:\/\/kill|javascript:)/.test(p.url || '')) throw new Error('Cannot navigate to ' + p.url);
        const t = makeTab(p.url || 'chrome://newtab/', p.windowId, -1, p.url ? undefined : 'New Tab');
        if (p.active) st.activeTabId = t.id;
        fire('tabs.onCreated', clone(t));
        return clone(t);
      },
      update: async (id, p) => { const t = tab(id); Object.assign(t, p); if (p.active) st.activeTabId = id; return clone(t); },
      remove: async (ids) => {
        (Array.isArray(ids) ? ids : [ids]).forEach((id) => {
          tab(id);
          st.tabs = st.tabs.filter((x) => x.id !== id);
          fire('tabs.onRemoved', id, { windowId: 1, isWindowClosing: false });
        });
        reindex(); dropEmpty();
      },
      group: async (p) => {
        let gid = p.groupId;
        if (gid == null) {
          gid = st.nextGroupId++;
          const win = (p.createProperties && p.createProperties.windowId) || tab(p.tabIds[0]).windowId;
          st.groups.push({ id: gid, title: '', color: 'grey', collapsed: false, windowId: win });
          fire('tabGroups.onCreated', { id: gid });
        }
        const g = st.groups.find((x) => x.id === gid);
        if (!g) throw new Error('No group with id: ' + gid + '.');
        p.tabIds.forEach((id) => { const t = tab(id); t.groupId = gid; t.windowId = g.windowId; });
        reindex(); dropEmpty();
        return gid;
      },
      ungroup: async (ids) => { ids.forEach((id) => { tab(id).groupId = -1; }); dropEmpty(); },
      move: async (id, p) => {
        const t = tab(id);
        const same = st.tabs.filter((x) => x.windowId === t.windowId && x !== t);
        same.splice(Math.min(p.index, same.length), 0, t);
        st.tabs = st.tabs.filter((x) => x.windowId !== t.windowId).concat(same);
        reindex(); return clone(t);
      },
      onUpdated: ev('tabs.onUpdated'), onCreated: ev('tabs.onCreated'), onRemoved: ev('tabs.onRemoved'), onMoved: ev('tabs.onMoved'),
      onAttached: ev('tabs.onAttached'), onDetached: ev('tabs.onDetached'), onReplaced: ev('tabs.onReplaced'),
    },
    windows: {
      getLastFocused: async () => clone(st.windows[0]),
      getCurrent: async () => clone(st.windows[0]),
      update: async (id) => clone(st.windows.find((w) => w.id === id) || st.windows[0]),
      create: async () => { const w = { id: st.nextWinId++, type: 'normal', keep: true }; st.windows.push(w); return clone(w); },
    },
    runtime: {
      onMessage: ev('runtime.onMessage'), onInstalled: ev('runtime.onInstalled'), onStartup: ev('runtime.onStartup'),
      getManifest: () => ({ version: '2.0.0' }),
    },
    contextMenus: {
      create: (o) => { st.menus.push(o); }, removeAll: (cb) => { st.menus = []; if (cb) cb(); }, onClicked: ev('contextMenus.onClicked'),
    },
    sidePanel: { setPanelBehavior: async () => {} },
  };
  const ctx = vm.createContext({
    chrome, crypto: globalThis.crypto, console: { log() {}, warn() {}, error() {} }, URL, Promise, Map, Set, Date, JSON, Math, Object, Array, String, Error, Number, Boolean,
    setTimeout: (fn, ms) => { const t = { fn, ms, done: false }; st.timers.push(t); return t; },
    clearTimeout: (t) => { if (t) t.done = true; },
  });
  vm.runInContext(SRC, ctx, { filename: 'background.js' });

  const api = {
    st, chrome, fire,
    send: (msg) => new Promise((resolve) => L['runtime.onMessage'][0](msg, {}, resolve)),
    async ok(msg) { const r = await api.send(msg); if (!r.ok) throw new Error(msg.type + ' failed: ' + r.error + ' / ' + r.detail); return r; },
    reconcile: () => api.ok({ type: 'reconcile' }),
    groups: () => clone(st.local.groups || []),
    trash: () => clone(st.local.trash || []),
    byName: (name) => api.groups().filter((g) => g.name === name),
    pendingTimers: () => st.timers.filter((t) => !t.done).map((t) => t.ms),
    // Opens a Chrome tab group with these URLs. Returns the Chrome group id.
    openGroup(title, urls, color = 'blue', windowId = 1) {
      const gid = st.nextGroupId++;
      st.groups.push({ id: gid, title, color, collapsed: false, windowId });
      urls.forEach((u) => makeTab(u, windowId, gid));
      return gid;
    },
    addTab: (gid, url) => makeTab(url, (st.groups.find((g) => g.id === gid) || {}).windowId || 1, gid).id,
    looseTab: (url, windowId = 1) => makeTab(url, windowId, -1).id,
    tabsIn: (gid) => st.tabs.filter((t) => t.groupId === gid),
    closeTab: (id) => chrome.tabs.remove(id),
    // Browser restart: same saved data, empty session storage, new tab and group ids.
    restart: () => createBrowser({ local: st.local, firstTabId: st.nextTabId + 500, firstGroupId: st.nextGroupId + 500 }),
    // Extension reload: Chrome keeps its tabs and groups, the extension starts fresh.
    reloadExtension() {
      const b = createBrowser({ local: st.local });
      b.st.tabs = st.tabs; b.st.groups = st.groups; b.st.windows = st.windows;
      b.st.nextTabId = st.nextTabId; b.st.nextGroupId = st.nextGroupId;
      return b;
    },
  };
  return api;
}

module.exports = { createBrowser, clone };
