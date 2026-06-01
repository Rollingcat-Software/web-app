// Mobile console: activates eruda when ?debug=1 (or #debug, or eruda=1 in localStorage).
// Extracted to a separate file so CSP can keep script-src strict (no 'unsafe-inline').
//
// SECURITY: this is a plain static <script> (NOT processed by Vite), so there is
// no build-time `import.meta.env.DEV` to gate on. Instead, refuse to activate on
// the production hostnames — a curious/hostile visitor must not be able to flip a
// full devtools console on app/verify/demo/fivucsas.com via ?debug=1. Localhost,
// LAN IPs, and preview hosts keep the on-demand debug console for development.
(function () {
  var host = location.hostname;
  var isProdHost =
    host === 'fivucsas.com' ||
    host === 'www.fivucsas.com' ||
    /(^|\.)fivucsas\.com$/.test(host); // app./verify./demo./*.fivucsas.com
  if (isProdHost) return;

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
