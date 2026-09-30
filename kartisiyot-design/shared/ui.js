// One panel markup for every theme. The themes differ only in CSS.
// URL: panel.html?theme=drawer|console|glass&mode=light|dark&view=list|settings
(function () {
  var params = new URLSearchParams(location.search);
  var theme = params.get('theme') || 'drawer';
  var mode = params.get('mode') || 'light';
  var view = params.get('view') || 'list';
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  var dark = mode === 'dark';

  function gc(g) { return GROUP_COLORS[g.color][dark ? 1 : 0]; }
  var live = SAMPLE.groups.filter(function (g) { return g.live; });
  var saved = SAMPLE.groups.filter(function (g) { return !g.live; });
  // The glass theme tints its background with the colors of the open groups.
  root.style.setProperty('--amb-1', live[0] ? gc(live[0]) : '#8a8f99');
  root.style.setProperty('--amb-2', live[1] ? gc(live[1]) : '#8a8f99');

  var FILTER_ICONS = { watch: 'eye', read: 'book', skim: 'bolt', working: 'half', task: 'note', old: 'clock', archive: 'box' };

  function header() {
    var h = '<header class="top"><div class="bar">' +
      '<div class="brand"><h1>כרטיסיות</h1><span class="summary">6 קבוצות · 2 פתוחות</span></div>' +
      '<div class="tools">' +
      '<button class="ibtn" title="הוספת הלשונית הנוכחית">' + icon('plus', 18) + '</button>' +
      '<button class="ibtn" title="' + (dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה') + '">' + icon(dark ? 'sun' : 'moon', 17) + '</button>' +
      '<button class="ibtn' + (view === 'settings' ? ' on' : '') + '" title="הגדרות">' + icon('sliders', 17) + '</button>' +
      '</div></div>';
    if (view === 'list') {
      h += '<label class="search">' + icon('search', 15) + '<input type="search" placeholder="חיפוש בקבוצות, בכותרות ובמשימות"><kbd>/</kbd></label>';
      h += '<nav class="filters">' + FILTERS.map(function (f, i) {
        var ic = FILTER_ICONS[f.key];
        return '<button class="f' + (i === 0 ? ' on' : '') + (f.n ? '' : ' zero') + (i >= 4 ? ' extra' : '') + (ic ? ' ico' : '') + '" title="' + f.label + '">' +
          (ic ? '<span class="f-ic">' + icon(ic, 13) + '</span>' : '') + '<span class="f-l">' + f.label + '</span><span class="f-n">' + f.n + '</span></button>';
      }).join('') + '<button class="f more" title="עוד מסננים"><span class="f-l">עוד</span>' + icon('chevronDown', 12) + '</button></nav>';
      var g1 = live[0];
      h += '<div class="here"><span class="here-mark" style="--gc:' + gc(g1) + '"></span><span>הלשונית הפעילה כבר בקבוצה</span><b dir="auto">' + esc(g1.name) + '</b></div>';
    }
    return h + '</header>';
  }

  function item(it) {
    var cls = 'it' + (it.active ? ' active' : '') + (it.notOpen ? ' notopen' : '') + (it.hover ? ' hover' : '');
    return '<li class="' + cls + '">' +
      '<span class="it-fav">' + fav(it.url, 16) + '</span>' +
      '<span class="it-main"><span class="t" dir="auto">' + esc(displayTitle(it)) + '</span>' +
      (it.notOpen ? '<span class="h">לא פתוח</span>' : '<span class="h" dir="ltr">' + esc(hostOf(it.url)) + '</span>') + '</span>' +
      (it.active ? '<span class="it-now">הלשונית הפעילה</span>' : '') +
      '<span class="acts"><button title="שינוי כותרת">' + icon('pencil', 14) + '</button><button title="הערה">' + icon('note', 14) + '</button>' +
      '<button title="העברה לקבוצה אחרת">' + icon('move', 14) + '</button><button title="סיימתי">' + icon('check', 15) + '</button></span>' +
      (it.note ? '<div class="note">' + icon('note', 13) + '<span>' + esc(it.note) + '</span></div>' : '') +
      '</li>';
  }

  function body(g) {
    return '<div class="g-body">' +
      '<div class="g-meta2"><button class="pick">' + icon(statusIcon(g.status), 13) + '<span>' + STATUS[g.status] + '</span>' + icon('chevronDown', 11) + '</button>' +
      '<span class="live">פתוחה בכרום</span><span class="sp"></span><span class="nopen">5 מתוך 6 פתוחים</span></div>' +
      '<ul class="items">' + g.items.map(item).join('') + '</ul>' +
      '<label class="taskin"><span class="k">משימה</span><input placeholder="מה לעשות עם הקבוצה. יישלח לקלוד עם הקישורים"></label>' +
      '<div class="claude"><button class="btn pri">' + icon('chat', 15) + '<span>צ׳אט עם קלוד</span></button>' +
      '<button class="btn sec">' + icon('terminal', 15) + '<span>קלוד קוד</span></button></div>' +
      '<div class="gacts">' +
      '<button class="ga" title="הצגה בכרום">' + icon('window', 15) + '<span>הצגה בכרום</span></button>' +
      '<button class="ga" title="סגירה ושמירה">' + icon('closeSave', 15) + '<span>סגירה ושמירה</span></button>' +
      '<button class="ga" title="העתקת הקישורים">' + icon('copy', 15) + '<span>העתקה</span></button>' +
      '<button class="ga" title="עוד פעולות">' + icon('more', 15) + '<span>עוד</span></button>' +
      '</div></div>';
  }

  function group(g, open, cursor) {
    var stale = isStale(g);
    var cls = 'group' + (open ? ' open' : '') + (cursor ? ' cursor' : '') + (stale ? ' stale' : '') +
      (g.live ? ' live' : '') + (g.name ? '' : ' unnamed') + (g.pinned ? ' pinned' : '');
    var name = g.name
      ? '<span class="g-name" dir="auto">' + esc(g.name) + '</span>'
      : '<span class="g-un">ללא שם</span><span class="g-hosts" dir="ltr">' + esc(topHosts(g).join(', ')) + '</span>';
    var age = g.live ? 'פתוחה' : stale ? Math.round(g.days / 7) + ' שבועות' : ageText(g.days).replace('לפני ', '');
    var head = '<div class="g-head"><span class="g-mark"></span>' +
      '<div class="g-tab"><span class="g-chev">' + icon('chevronDown', 13) + '</span>' +
      (g.pinned ? '<span class="g-pin" title="נעוצה">' + icon('pin', 12) + '</span>' : '') + name + '</div>' +
      '<div class="g-info"><span class="g-st st-' + g.status + '" title="' + STATUS[g.status] + '">' + icon(statusIcon(g.status), 14) + '</span>' +
      (g.status !== 'none' ? '<span class="g-status">' + STATUS[g.status] + '</span>' : '') +
      '<span class="g-count">' + g.items.length + '</span>' +
      '<span class="g-age">' + (stale ? icon('clock', 12) : '') + '<span>' + age + '</span></span></div></div>';
    var card = '<div class="g-card">' +
      '<div class="g-line"><p class="g-preview">' + runon(g) + '</p><span class="g-meta">' +
      (g.status !== 'none' ? '<span>' + STATUS[g.status] + '</span>' : '') + '<b>' + g.items.length + '</b></span></div>' +
      (g.task ? '<p class="g-task">' + icon('note', 13) + '<span class="k">משימה</span><span class="t" dir="auto">' + esc(g.task) + '</span></p>' : '') +
      (stale ? '<p class="g-stale">' + icon('clock', 12) + '<span>' + staleText(g.days) + '</span></p>' : '') +
      (open ? body(g) : '') + '</div>';
    return '<article class="' + cls + '" style="--gc:' + gc(g) + '">' + head + card + '</article>';
  }

  function list() {
    return '<div class="cols"><span>קבוצה</span><span>פריטים</span><span>פעילות</span></div><main class="list">' +
      '<section class="sect"><h2 class="sect-h"><span>פתוחות בכרום</span><span class="n">' + live.length + '</span></h2><div class="stack">' +
      live.map(function (g, i) { return group(g, i === 0, false); }).join('') + '</div></section>' +
      '<section class="sect"><h2 class="sect-h"><span>שמורות</span><span class="n">' + saved.length + '</span></h2><div class="stack">' +
      saved.map(function (g) { return group(g, false, g.id === 'g5'); }).join('') + '</div></section></main>' +
      '<footer class="keys"><span>ניווט <span class="kseq" dir="ltr"><kbd>' + icon('arrowUp', 10) + '</kbd><kbd>' + icon('arrowDown', 10) + '</kbd></span></span>' +
      '<span>פתיחה <kbd>' + icon('enter', 10) + '</kbd></span><span>חיפוש <kbd>/</kbd></span><span>סיימתי <kbd>D</kbd></span>' +
      '<span>ביטול <span class="kseq" dir="ltr"><kbd>' + icon('cmd', 10) + '</kbd><kbd>Z</kbd></span></span></footer>';
  }

  // ---------- settings ----------
  function seg(opts, on) {
    return '<div class="seg">' + opts.map(function (o, i) { return '<button class="' + (i === on ? 'on' : '') + '">' + o + '</button>'; }).join('') + '</div>';
  }
  function row(label, hint, control, cls) {
    return '<div class="s-row' + (cls ? ' ' + cls : '') + '"><div class="s-lbl"><span class="s-l">' + label + '</span>' +
      (hint ? '<span class="s-hint">' + hint + '</span>' : '') + '</div><div class="s-ctl">' + control + '</div></div>';
  }
  function sec(title, rows) {
    return '<div class="s-sec"><h3 class="s-t">' + title + '</h3><div class="s-rows">' + rows + '</div></div>';
  }
  function themes() {
    return '<div class="themes">' + [['drawer', 'מגירה'], ['console', 'מסוף'], ['glass', 'זכוכית']].map(function (t) {
      return '<button class="th' + (t[0] === theme ? ' on' : '') + '"><span class="th-pv pv-' + t[0] + '"><i></i><i></i><i></i></span><span class="th-l">' + t[1] + '</span></button>';
    }).join('') + '</div>';
  }
  function settings() {
    return '<section class="settings">' +
      '<div class="s-head"><button class="ibtn back" title="חזרה לקבוצות">' + icon('back', 18) + '</button><h2>הגדרות</h2></div>' +
      sec('מראה',
        row('עיצוב', '', themes(), 'col') +
        row('מצב תצוגה', 'הכפתור למעלה מחליף בין בהיר לכהה', seg(['לפי המערכת', 'בהיר', 'כהה'], 0), 'col')) +
      sec('קלוד',
        row('צ׳אט עם קלוד נפתח', '', seg(['באפליקציה', 'באתר'], 0)) +
        row('קלוד קוד נפתח', '', seg(['באפליקציה', 'באתר'], 0)) +
        row('תיקיית עבודה לקלוד קוד', 'לא חובה. רק באפליקציה, והיא תבקש אישור לפני שימוש.', '<input class="path" dir="ltr" placeholder="/Users/guy/Projects">', 'col') +
        row('בדיקת קישור', 'פותח את קלוד עם המילה "בדיקה". שום דבר לא נשלח.', '<button class="btn sm">' + icon('external', 14) + '<span>בדיקה</span></button>')) +
      sec('קבוצות',
        row('קבוצה נחשבת ישנה אחרי', '', '<span class="num"><input value="14" dir="ltr"><span>ימים</span></span>') +
        row('קיצור מקלדת לחלונית', '', '<span class="keys-set"><span class="kseq" dir="ltr"><kbd>' + icon('optKey', 12) + '</kbd><kbd>' + icon('shiftKey', 12) + '</kbd><kbd>K</kbd></span><button class="lnk">שינוי</button></span>')) +
      sec('נתונים',
        row('גיבוי', 'הייצוא האחרון היה לפני 12 ימים', '<button class="btn sm">' + icon('download', 14) + '<span>ייצוא</span></button>') +
        row('ייבוא מקובץ', 'להוסיף לקבוצות הקיימות, או להחליף אותן', '<button class="btn sm">' + icon('upload', 14) + '<span>ייבוא</span></button>') +
        row('סל המחזור', '3 פריטים. נמחקים לתמיד אחרי 30 יום.', '<button class="btn sm">' + icon('trash', 14) + '<span>פתיחה</span></button>')) +
      '<p class="s-foot">גרסה 2.0. הנתונים נשמרים רק בכרום, במחשב הזה.</p></section>';
  }

  document.body.innerHTML = '<div class="ambient" aria-hidden="true"></div><div class="app view-' + view + '">' +
    header() + (view === 'settings' ? settings() : list()) + '</div>';
})();
