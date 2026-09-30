// כרטיסיות - חלונית הצד

var STATUS_LABELS = {
  none: 'ללא סטטוס', watch: 'לצפייה', read: 'לקריאה',
  skim: 'למעבר', working: 'בעבודה', archive: 'לארכיון'
};
var CHIPS = [
  ['all', 'הכל'], ['live', 'פתוחות'], ['watch', 'לצפייה'], ['read', 'לקריאה'],
  ['skim', 'למעבר'], ['working', 'בעבודה'], ['task', 'עם משימה'], ['archive', 'ארכיון']
];
var ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  pen: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
};
function icon(name, size) {
  var s = size || 16;
  var t = document.createElement('template');
  t.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  return t.content.firstChild;
}
var STALE_DAYS = 14;
var PROMPT_LIMIT = 12000;
var DEFAULT_SETTINGS = { chatTarget: 'app', codeTarget: 'app', codeFolder: '' };

var state = { groups: [], settings: Object.assign({}, DEFAULT_SETTINGS) };
var ui = { expanded: new Set(), filter: 'all', query: '', pendingRender: false };

var $ = function (id) { return document.getElementById(id); };

function send(msg) {
  return chrome.runtime.sendMessage(msg).then(function (r) {
    if (!r || !r.ok) throw new Error((r && r.error) || 'שגיאה');
    return r;
  });
}
function act(msg) {
  return send(msg).catch(function (e) { toast(e.message); });
}

function toast(text) {
  var el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

function el(tag, attrs, children) {
  var n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  });
  (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return n;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url || ''; }
}

// כותרת לתצוגה: שם הסרטון ביוטיוב, כותרת הדף באתרים אחרים
function displayTitle(it) {
  if (it.customTitle) return it.customTitle;
  var host = hostOf(it.url);
  var t = (it.title || '').trim().replace(/^\(\d+\+?\)\s*/, '');
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) t = t.replace(/\s*[-–]\s*YouTube$/i, '');
  if (!t || t === it.url) t = host;
  return t;
}

function favicon(url) {
  return chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=32');
}

function daysSince(ts) { return Math.floor((Date.now() - ts) / 86400000); }
function ago(ts) {
  var d = daysSince(ts);
  if (d <= 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 14) return 'לפני ' + d + ' ימים';
  if (d < 60) return 'לפני ' + Math.round(d / 7) + ' שבועות';
  return 'לפני ' + Math.round(d / 30) + ' חודשים';
}

function isLive(g) { return g.chromeGroupId != null; }

function matchesFilter(g) {
  var f = ui.filter;
  if (f === 'archive') return g.status === 'archive';
  if (g.status === 'archive') return false;
  if (f === 'all') return true;
  if (f === 'live') return isLive(g);
  if (f === 'task') return !!(g.task || '').trim();
  return g.status === f;
}

// מחזיר null אם הקבוצה לא מתאימה לחיפוש, אחרת את הפריטים להצגה
function searchResult(g) {
  var q = ui.query.trim().toLowerCase();
  if (!q) return g.items;
  var hit = function (s) { return (s || '').toLowerCase().indexOf(q) >= 0; };
  if (hit(g.name) || hit(g.task) || hit(STATUS_LABELS[g.status])) return g.items;
  var items = g.items.filter(function (it) { return hit(displayTitle(it)) || hit(it.url); });
  return items.length ? items : null;
}

function buildPrompt(g) {
  var head = 'אלה הקישורים בקבוצה ' + (g.name ? '"' + g.name + '"' : 'ללא שם') +
    (g.status !== 'none' ? ' (סטטוס: ' + STATUS_LABELS[g.status] + ')' : '') + ':';
  var task = (g.task || '').trim();
  var tail = '\n\nהמשימה: ' + task;
  var lines = [head];
  var used = head.length + tail.length;
  var left = 0;
  g.items.forEach(function (it, i) {
    var line = 'פריט ' + (i + 1) + ': ' + displayTitle(it) + '\nכתובת: ' + it.url;
    if (left || used + line.length + 1 > PROMPT_LIMIT) { left++; return; }
    lines.push(line);
    used += line.length + 1;
  });
  if (left) lines.push('ועוד ' + left + ' קישורים שלא נכנסו בגלל מגבלת אורך.');
  return lines.join('\n') + (task ? tail : '\n\nהמשימה: ');
}

function openExternal(url) {
  if (/^https:/.test(url)) { chrome.tabs.create({ url: url }); return; }
  var a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openInClaude(kind, g) {
  var prompt = buildPrompt(g);
  var q = encodeURIComponent(prompt);
  var s = state.settings;
  var url;
  if (kind === 'chat') {
    url = s.chatTarget === 'web' ? 'https://claude.ai/new?q=' + q : 'claude://claude.ai/new?q=' + q;
  } else {
    url = s.codeTarget === 'web'
      ? 'https://claude.ai/code?prompt=' + q
      : 'claude://code/new?q=' + q + (s.codeFolder ? '&folder=' + encodeURIComponent(s.codeFolder) : '');
  }
  navigator.clipboard.writeText(prompt).catch(function () {});
  openExternal(url);
  send({ type: 'setTask', id: g.id, task: g.task || '' }).catch(function () {});
  toast('נפתח בקלוד. הטקסט הועתק גם ללוח, למקרה שהוא לא הופיע.');
}

function copyLinks(g) {
  var text = g.items.map(function (it) { return displayTitle(it) + '\n' + it.url; }).join('\n\n');
  navigator.clipboard.writeText(text).then(function () { toast('הקישורים הועתקו'); }, function () { toast('ההעתקה נכשלה'); });
}

// ---------- רינדור ----------

function isEditing() {
  var a = document.activeElement;
  return a && $('list').contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
}

function render() {
  if (isEditing()) { ui.pendingRender = true; return; }
  ui.pendingRender = false;
  renderChips();
  var list = $('list');
  var scroll = document.scrollingElement.scrollTop;
  list.textContent = '';

  var shown = [];
  state.groups.forEach(function (g) {
    if (!matchesFilter(g)) return;
    var items = searchResult(g);
    if (items) shown.push({ g: g, items: items });
  });

  if (!state.groups.length) {
    list.appendChild(el('div', { class: 'empty', text: 'אין קבוצות עדיין. צור קבוצת לשוניות בכרום, והיא תופיע כאן.' }));
    return;
  }
  if (!shown.length) {
    list.appendChild(el('div', { class: 'empty', text: 'אין קבוצות שמתאימות לסינון.' }));
    return;
  }

  var live = shown.filter(function (x) { return isLive(x.g); });
  var saved = shown.filter(function (x) { return !isLive(x.g); })
    .sort(function (a, b) { return b.g.lastActiveAt - a.g.lastActiveAt; });

  if (live.length) {
    list.appendChild(el('div', { class: 'sect' }, [el('span', { text: 'פתוחות בכרום' }), el('span', { text: String(live.length) })]));
    live.forEach(function (x) { list.appendChild(groupCard(x.g, x.items)); });
  }
  if (saved.length) {
    list.appendChild(el('div', { class: 'sect' }, [el('span', { text: 'שמורות' }), el('span', { text: String(saved.length) })]));
    saved.forEach(function (x) { list.appendChild(groupCard(x.g, x.items)); });
  }
  document.scrollingElement.scrollTop = scroll;
}

function groupCard(g, items) {
  var open = ui.expanded.has(g.id) || !!ui.query.trim();
  var card = el('article', { class: 'group' + (open ? ' open' : ''), 'data-id': g.id, 'data-color': g.color || 'grey' });

  var nameInput = el('input', {
    class: 'chip', type: 'text', value: g.name || '', placeholder: 'ללא שם', dir: 'auto',
    'aria-label': 'שם הקבוצה', title: 'לחיצה לשינוי השם',
    onkeydown: function (e) { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = g.name || ''; e.target.blur(); } },
    onblur: function (e) {
      var v = e.target.value.trim();
      if (v !== (g.name || '')) act({ type: 'setName', id: g.id, name: v });
      afterEdit();
    }
  });
  card.appendChild(el('header', { class: 'g-head' }, [
    nameInput,
    el('span', { class: 'g-sp' }),
    el('span', { class: 'count', text: String(g.items.length) }),
    el('button', {
      class: 'toggle', type: 'button', 'aria-expanded': open ? 'true' : 'false', 'aria-label': open ? 'סגירת הקבוצה' : 'פתיחת הקבוצה',
      onclick: function () { if (ui.expanded.has(g.id)) ui.expanded.delete(g.id); else ui.expanded.add(g.id); render(); }
    }, [icon('chevron')])
  ]));

  var status = el('select', {
    class: 'status' + (g.status === 'none' ? ' none' : ''), 'aria-label': 'סטטוס', title: 'שינוי סטטוס',
    onchange: function (e) { act({ type: 'setStatus', id: g.id, status: e.target.value }); }
  }, Object.keys(STATUS_LABELS).map(function (k) {
    return el('option', { value: k, selected: g.status === k, text: STATUS_LABELS[k] });
  }));
  var meta = el('div', { class: 'g-meta' }, [status]);
  function part(cls, text) { meta.appendChild(el('span', { class: 'sep' })); meta.appendChild(el('span', { class: cls, text: text })); }
  if (isLive(g)) part('live', 'פתוחה בכרום');
  else {
    part('', 'נשמרה ' + ago(g.updatedAt));
    if (daysSince(g.lastActiveAt) >= STALE_DAYS && g.status !== 'archive') part('stale', 'לא נפתחה ' + ago(g.lastActiveAt).replace('לפני ', ''));
  }
  card.appendChild(meta);

  if (!open) {
    var prev = el('ul', { class: 'preview' });
    items.slice(0, 3).forEach(function (it) {
      prev.appendChild(el('li', {}, [el('img', { src: favicon(it.url), alt: '' }), el('span', { dir: 'auto', text: displayTitle(it) })]));
    });
    if (items.length > 3) prev.appendChild(el('li', { class: 'more', text: 'ועוד ' + (items.length - 3) }));
    card.appendChild(prev);
    if ((g.task || '').trim()) card.appendChild(el('div', { class: 'task-note', dir: 'auto', title: g.task.trim(), text: g.task.trim() }));
    return card;
  }

  var ul = el('ul', { class: 'items' });
  items.forEach(function (it) { ul.appendChild(itemRow(g, it)); });
  card.appendChild(ul);

  var taskTimer = null;
  var taskArea = el('textarea', {
    class: 'g-task', id: 'task-' + g.id, dir: 'auto', value: g.task || '',
    placeholder: 'מה לעשות עם הקבוצה. הטקסט יודבק לקלוד.',
    oninput: function (e) {
      var v = e.target.value;
      clearTimeout(taskTimer);
      taskTimer = setTimeout(function () { act({ type: 'setTask', id: g.id, task: v }); }, 500);
    },
    onblur: function (e) {
      clearTimeout(taskTimer);
      if (e.target.value !== (g.task || '')) act({ type: 'setTask', id: g.id, task: e.target.value });
      afterEdit();
    }
  });
  card.appendChild(el('div', { class: 'task-box' }, [el('label', { for: 'task-' + g.id, text: 'משימה' }), taskArea]));

  card.appendChild(el('div', { class: 'actions' }, [
    el('div', { class: 'claude' }, [
      el('button', { class: 'btn ink', type: 'button', text: 'צ\'אט עם קלוד', onclick: function () { openInClaude('chat', currentGroup(g)); } }),
      el('button', { class: 'btn', type: 'button', text: 'קלוד קוד', onclick: function () { openInClaude('code', currentGroup(g)); } })
    ]),
    el('button', {
      class: 'tbtn', type: 'button', text: isLive(g) ? 'הצגה בכרום' : 'פתיחת הכל',
      onclick: function () { act({ type: 'openGroup', id: g.id }); }
    }),
    isLive(g) ? el('button', {
      class: 'tbtn', type: 'button', text: 'סגירה ושמירה',
      onclick: function () { act({ type: 'closeGroup', id: g.id }).then(function () { toast('הקבוצה נסגרה בכרום ונשמרה כאן'); }); }
    }) : null,
    el('button', { class: 'tbtn', type: 'button', text: 'העתקה', title: 'העתקת הכותרות והקישורים', onclick: function () { copyLinks(g); } }),
    el('span', { class: 'sp' }),
    el('button', {
      class: 'tbtn danger', type: 'button', text: 'מחיקה',
      onclick: function () {
        var msg = isLive(g) ? 'למחוק את הקבוצה? הלשוניות שלה ייסגרו גם בכרום.' : 'למחוק את הקבוצה ואת כל הפריטים שלה?';
        if (confirm(msg)) act({ type: 'deleteGroup', id: g.id });
      }
    })
  ]));
  return card;
}

function itemRow(g, it) {
  var title = displayTitle(it);
  return el('li', { class: 'item' }, [
    el('img', { src: favicon(it.url), alt: '' }),
    el('div', {
      class: 'it-text', title: it.url, role: 'button', tabindex: '0',
      onclick: function () { act({ type: 'openItem', id: g.id, itemId: it.id }); },
      onkeydown: function (e) { if (e.key === 'Enter') act({ type: 'openItem', id: g.id, itemId: it.id }); }
    }, [
      el('span', { class: 'it-title', dir: 'auto', text: title }),
      el('span', { class: 'it-host', dir: 'ltr', text: hostOf(it.url) })
    ]),
    el('button', {
      class: 'it-btn', type: 'button', title: 'שינוי כותרת', 'aria-label': 'שינוי כותרת',
      onclick: function () {
        var v = prompt('כותרת לפריט (ריק = הכותרת של הדף):', it.customTitle || title);
        if (v !== null) act({ type: 'setItemTitle', id: g.id, itemId: it.id, title: v });
      }
    }, [icon('pen')]),
    el('button', {
      class: 'it-btn del', type: 'button', title: 'הסרה מהקבוצה', 'aria-label': 'הסרה מהקבוצה',
      onclick: function () { act({ type: 'deleteItem', id: g.id, itemId: it.id }); }
    }, [icon('x')])
  ]);
}

// הנתונים העדכניים ביותר של קבוצה (למקרה שהמשימה עוד לא נשמרה)
function currentGroup(g) {
  var area = document.querySelector('.group[data-id="' + g.id + '"] .g-task');
  var fresh = state.groups.find(function (x) { return x.id === g.id; }) || g;
  return area ? Object.assign({}, fresh, { task: area.value }) : fresh;
}

function afterEdit() {
  setTimeout(function () { if (ui.pendingRender && !isEditing()) render(); }, 0);
}

function countFor(key) {
  var keep = ui.filter;
  ui.filter = key;
  var n = state.groups.filter(matchesFilter).length;
  ui.filter = keep;
  return n;
}

function renderChips() {
  var box = $('chips');
  box.textContent = '';
  CHIPS.forEach(function (c) {
    var n = countFor(c[0]);
    if (!n && c[0] !== 'all' && ui.filter !== c[0]) return;
    box.appendChild(el('button', {
      class: 'tab', type: 'button', role: 'tab', 'aria-selected': ui.filter === c[0] ? 'true' : 'false',
      onclick: function () { ui.filter = c[0]; renderChips(); render(); }
    }, [c[1], el('span', { class: 'n', text: String(n) })]));
  });
  var live = state.groups.filter(isLive).length;
  $('summary').textContent = state.groups.length ? state.groups.length + ' קבוצות, ' + live + ' פתוחות' : '';
}

function fillAddTarget() {
  var sel = $('addTarget');
  sel.textContent = '';
  sel.appendChild(el('option', { value: 'new', text: 'קבוצה חדשה בכרום' }));
  state.groups.filter(function (g) { return g.status !== 'archive'; }).forEach(function (g) {
    var label = (g.name || 'ללא שם') + ' (' + g.items.length + ')' + (isLive(g) ? ', פתוחה' : '');
    sel.appendChild(el('option', { value: g.id, text: label }));
  });
}

// ---------- אתחול ----------

function loadAll() {
  return chrome.storage.local.get(['groups', 'settings']).then(function (r) {
    state.groups = Array.isArray(r.groups) ? r.groups : [];
    state.settings = Object.assign({}, DEFAULT_SETTINGS, r.settings || {});
  });
}

function saveSettings() {
  state.settings = {
    chatTarget: $('chatTarget').value,
    codeTarget: $('codeTarget').value,
    codeFolder: $('codeFolder').value.trim()
  };
  chrome.storage.local.set({ settings: state.settings });
}

function syncDrawerButtons() {
  $('addBtn').setAttribute('aria-expanded', String(!$('addPanel').hidden));
  $('settingsBtn').setAttribute('aria-expanded', String(!$('settingsPanel').hidden));
}

function wire() {
  $('addBtn').appendChild(icon('plus', 18));
  $('settingsBtn').appendChild(icon('gear', 16));
  $('searchIcon').appendChild(icon('search', 14));
  $('addBtn').addEventListener('click', function () {
    var p = $('addPanel');
    p.hidden = !p.hidden;
    $('settingsPanel').hidden = true;
    syncDrawerButtons();
    if (!p.hidden) fillAddTarget();
  });
  $('addGo').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      var tab = tabs[0];
      if (!tab || !/^https?:/.test(tab.url || '')) { toast('אי אפשר להוסיף את הלשונית הזו'); return; }
      return act({ type: 'addTab', tabId: tab.id, target: $('addTarget').value }).then(function (r) {
        if (r) { toast('נוסף'); $('addPanel').hidden = true; syncDrawerButtons(); }
      });
    });
  });

  $('settingsBtn').addEventListener('click', function () {
    var p = $('settingsPanel');
    p.hidden = !p.hidden;
    $('addPanel').hidden = true;
    syncDrawerButtons();
    $('chatTarget').value = state.settings.chatTarget;
    $('codeTarget').value = state.settings.codeTarget;
    $('codeFolder').value = state.settings.codeFolder;
  });
  ['chatTarget', 'codeTarget'].forEach(function (id) { $(id).addEventListener('change', saveSettings); });
  $('codeFolder').addEventListener('change', saveSettings);

  $('exportBtn').addEventListener('click', function () {
    var data = JSON.stringify({ app: 'kartisiyot', version: 1, exportedAt: new Date().toISOString(), groups: state.groups }, null, 2);
    var url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    var a = el('a', { href: url, download: 'kartisiyot-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    var f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(function (txt) {
      var data = JSON.parse(txt);
      if (!confirm('הייבוא מחליף את כל הקבוצות השמורות בקבוצות מהקובץ. להמשיך?')) return;
      return act({ type: 'importData', groups: data.groups }).then(function (r) { if (r) toast('יובאו ' + r.count + ' קבוצות'); });
    }).catch(function () { toast('הקובץ לא תקין'); });
  });

  var searchTimer = null;
  $('search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { ui.query = e.target.value; render(); }, 120);
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes.groups) { state.groups = changes.groups.newValue || []; render(); }
    if (changes.settings) state.settings = Object.assign({}, DEFAULT_SETTINGS, changes.settings.newValue || {});
  });
}

wire();
loadAll().then(function () {
  render();
  send({ type: 'reconcile' }).catch(function () {});
});
