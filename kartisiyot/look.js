// קובע את העיצוב האחרון לפני שהדף מצויר, כדי שלא יהבהב. ההגדרה עצמה נשמרת ב-chrome.storage.
(function () {
  try {
    var l = JSON.parse(localStorage.getItem('look') || 'null');
    if (l && l.theme) { document.documentElement.dataset.theme = l.theme; document.documentElement.dataset.mode = l.mode; }
  } catch (e) {}
})();
