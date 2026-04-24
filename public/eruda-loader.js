// Mobile console: activates eruda when ?debug=1 (or #debug, or eruda=1 in localStorage).
// Extracted to a separate file so CSP can keep script-src strict (no 'unsafe-inline').
(function () {
  var wantsDebug =
    new URLSearchParams(location.search).has('debug') ||
    location.hash.includes('debug') ||
    localStorage.getItem('eruda') === '1';
  if (!wantsDebug) return;
  localStorage.setItem('eruda', '1');
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/eruda';
  s.onload = function () { if (window.eruda) window.eruda.init(); };
  document.head.appendChild(s);
})();
