/*!
 * <fivucsas-launcher> — shared floating cross-site navigation web component.
 *
 * Single source of truth for the FIVUCSAS suite's cross-site navigation. A
 * self-contained, dependency-free vanilla custom element using Shadow DOM so
 * that neither its styles leak out nor host-page styles leak in. Drop the
 * tag <fivucsas-launcher> anywhere — or just load this script, which
 * auto-appends one to <body>.
 *
 *   <script src="https://app.fivucsas.com/launcher.js" defer></script>
 *
 * Hosted at https://app.fivucsas.com/launcher.js (copied from public/ → dist/
 * by `npm run build`). This is step one: build + host. Rolling it out to the
 * other suite sites (and removing their duplicated navbars) is a follow-up.
 *
 * Behaviour
 *   - Collapsed: 56px circular app-switcher button, fixed bottom-right, 16px
 *     inset. A grid glyph + hover/focus tooltip ("FIVUCSAS · switch app") makes
 *     it self-explain. Soft glow + lift on hover, gentle idle pulse ring.
 *   - Expanded: ~300px card panel that scales + fades up from the button on a
 *     spring-ish ease, with a clear "FIVUCSAS Suite" header, the 6 suite links
 *     — each an icon + name + one-line description, staggered into view — and
 *     an EN|TR toggle. Tasteful indigo/violet gradient, soft shadow, blur.
 *   - Active site highlighted by comparing location.hostname.
 *   - Language toggle drives the HOST page, not just the launcher's own labels:
 *     it writes document.documentElement[data-lang] and [lang] (values
 *     'tr' | 'en') — the pattern the static suite sites key their CSS off — AND
 *       · persists the choice in localStorage['fivucsas-lang'] so it sticks
 *         across reloads and (on sites that honour it) across the whole suite;
 *       · re-applies a stored choice to the document on load, after the host's
 *         own inline lang script has run, so the picked language wins the race;
 *       · dispatches a 'languagechange' event (window) and a documented
 *         'fivucsas:languagechange' CustomEvent (detail {lang, source}) so any
 *         JS-driven host page can re-localise / sync its own toggle button;
 *       · stays in sync with the host via a MutationObserver on [data-lang].
 *   - Auto-hides on amispoof.* (that site needs the full viewport for webcam).
 *   - A11y: aria-label, keyboard navigable, Esc closes, focus trap into the
 *     panel on open / back to the button on close, prefers-reduced-motion
 *     respected, full-width panel under 768px.
 *
 * Zero dependencies. Pure browser APIs.
 */
(function () {
  'use strict';

  var TAG = 'fivucsas-launcher';

  // Persist the chosen language across the whole suite. localStorage is
  // per-origin, but every suite site shares this same key + value scheme, so
  // each site that honours it on load starts in the language the visitor last
  // picked anywhere in the suite. Stored value is 'tr' | 'en'.
  var STORAGE_KEY = 'fivucsas-lang';

  // Namespaced custom event the launcher fires after it changes the document
  // language. Host pages can hook this (or the standard `languagechange`
  // event, also dispatched) to re-run JS-driven localisation / sync their own
  // button state. detail = { lang: 'tr' | 'en', source: 'fivucsas-launcher' }.
  var LANG_EVENT = 'fivucsas:languagechange';

  // Don't double-define if the script is included more than once across sites.
  if (typeof window === 'undefined' || window.customElements == null) return;
  if (window.customElements.get(TAG)) return;

  // ---- Inline SVG icon glyphs (24x24, stroked, currentColor) ------------
  // Self-contained art — no external fonts/images. Each value is the *inner*
  // markup of an SVG; the wrapper (viewBox/stroke attrs) is added in _render.
  var ICONS = {
    // home — a roof + door
    home: '<path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10v10h14V10"></path><path d="M10 20v-6h4v6"></path>',
    // dashboard — analytics tiles
    dashboard: '<rect x="3" y="3" width="8" height="9" rx="1.4"></rect><rect x="13" y="3" width="8" height="5" rx="1.4"></rect><rect x="13" y="11" width="8" height="10" rx="1.4"></rect><rect x="3" y="15" width="8" height="6" rx="1.4"></rect>',
    // auth widget — shield with a check (embeddable login)
    widget: '<path d="M12 3 5 6v5c0 4.2 2.9 7.5 7 9 4.1-1.5 7-4.8 7-9V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path>',
    // demo — a play triangle in a rounded frame
    demo: '<rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M10 9.2v5.6l5-2.8-5-2.8Z"></path>',
    // amispoof — face scan / anti-spoof brackets
    amispoof: '<path d="M4 8V6a2 2 0 0 1 2-2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M20 16v2a2 2 0 0 1-2 2h-2"></path><path d="M8 20H6a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="11" r="2.2"></circle><path d="M8.5 16.2c.7-1.4 2-2.2 3.5-2.2s2.8.8 3.5 2.2"></path>',
    // docs — open book / guides
    docs: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5v-12Z"></path><path d="M20 5.5C20 4.7 19.3 4 18.5 4H13v15h5.5c.8 0 1.5-.7 1.5-1.5v-12Z"></path>'
  };

  // ---- Single source of truth: the suite's sites ------------------------
  // `key` is used both for i18n lookup and as a stable identifier. `dEn`/`dTr`
  // are the one-line descriptions shown under each name in the panel.
  var SITES = [
    { key: 'home',      href: 'https://fivucsas.com',          host: 'fivucsas.com',          icon: ICONS.home,      en: 'Home',        tr: 'Ana Sayfa',        dEn: 'Product home',          dTr: 'Ürün ana sayfası' },
    { key: 'dashboard', href: 'https://app.fivucsas.com',      host: 'app.fivucsas.com',      icon: ICONS.dashboard, en: 'Dashboard',   tr: 'Panel',            dEn: 'Manage tenants & auth', dTr: 'Kiracı ve kimlik yönetimi' },
    { key: 'widget',    href: 'https://verify.fivucsas.com',   host: 'verify.fivucsas.com',   icon: ICONS.widget,    en: 'Auth Widget', tr: 'Doğrulama Aracı',  dEn: 'Embeddable login',      dTr: 'Gömülebilir giriş' },
    { key: 'demo',      href: 'https://demo.fivucsas.com',     host: 'demo.fivucsas.com',     icon: ICONS.demo,      en: 'Demo',        tr: 'Demo',             dEn: 'Try it live',           dTr: 'Canlı dene' },
    { key: 'amispoof',  href: 'https://amispoof.fivucsas.com', host: 'amispoof.fivucsas.com', icon: ICONS.amispoof,  en: 'Am I Spoof?', tr: 'Am I Spoof?',      dEn: 'Anti-spoof tester',     dTr: 'Sahtelik test aracı' },
    { key: 'docs',      href: 'https://docs.fivucsas.com',     host: 'docs.fivucsas.com',     icon: ICONS.docs,      en: 'Docs',        tr: 'Belgeler',         dEn: 'Guides & API',          dTr: 'Kılavuzlar ve API' }
  ];

  // UI strings (everything that isn't a site label).
  //   open      — button aria-label / tooltip (self-explaining hint)
  //   suiteTitle — the panel header
  //   tagline   — short sub-header line under the title
  var STRINGS = {
    en: {
      open: 'FIVUCSAS · switch app', close: 'Close', title: 'FIVUCSAS', langLabel: 'Language',
      suiteTitle: 'FIVUCSAS Suite', tagline: 'Switch between suite apps'
    },
    tr: {
      open: 'FIVUCSAS · uygulama değiştir', close: 'Kapat', title: 'FIVUCSAS', langLabel: 'Dil',
      suiteTitle: 'FIVUCSAS Paketi', tagline: 'Uygulamalar arasında geçiş yap'
    }
  };

  // ---- Helpers ----------------------------------------------------------
  function currentHostname() {
    try { return (window.location.hostname || '').toLowerCase(); } catch (e) { return ''; }
  }

  // Match the active site by hostname. Compare suffix-wise so that
  // www.fivucsas.com / fivucsas.com.tr style aliases still light up "Home".
  function isActiveSite(site, host) {
    if (!host) return false;
    if (host === site.host) return true;
    // bare apex (Home) — also match www. and any sub that ends in the apex
    // but only when no more-specific subdomain site matched. We approximate
    // by exact-or-suffix on the site host's own label.
    return host === 'www.' + site.host;
  }

  function resolveActiveKey(host) {
    // Prefer the most specific (longest host) match so app./verify./demo./
    // docs./amispoof. win over the bare apex "Home".
    var best = null;
    for (var i = 0; i < SITES.length; i++) {
      var s = SITES[i];
      if (isActiveSite(s, host)) {
        if (!best || s.host.length > best.host.length) best = s;
      }
    }
    // Fall back: if we're on *.fivucsas.com but matched nothing, treat the
    // apex as home only when the host literally is the apex.
    return best ? best.key : null;
  }

  function normalizeLang(v) {
    v = String(v == null ? '' : v).toLowerCase().slice(0, 2);
    return v === 'tr' ? 'tr' : 'en';
  }

  // The persisted suite-wide choice, if any. Returns 'tr' | 'en' | null.
  function readStoredLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      if (v == null) return null;
      v = String(v).toLowerCase();
      return v === 'tr' || v === 'en' ? v : null;
    } catch (e) { return null; }
  }

  function storeLang(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* no-op */ }
  }

  // Read the document's current language from the <html> attributes,
  // defaulting to 'en'. (The launcher's own state; the stored preference is
  // resolved separately in resolveInitialLang.)
  function readLang() {
    try {
      var el = document.documentElement;
      return normalizeLang(el.getAttribute('data-lang') || el.getAttribute('lang') || 'en');
    } catch (e) { return 'en'; }
  }

  // What the launcher should start in: a previously stored suite-wide choice
  // wins (so the picked language sticks across reloads and across sites that
  // honour the event/storage); otherwise mirror whatever the host page already
  // rendered. This is what keeps the toggle and the page consistent on load.
  function resolveInitialLang() {
    var stored = readStoredLang();
    return stored || readLang();
  }

  // Write language using the exact pattern the static suite sites use
  // (html[data-lang] + [lang] — their CSS keys content visibility off it),
  // persist the choice suite-wide, and announce it so cooperating pages can
  // re-run JS-driven localisation or sync their own toggle button.
  function writeLang(lang) {
    lang = normalizeLang(lang);
    try {
      var el = document.documentElement;
      el.setAttribute('data-lang', lang);
      el.setAttribute('lang', lang);
    } catch (e) { /* no-op */ }
    storeLang(lang);
    dispatchLangEvent(lang);
  }

  // Fire both a namespaced custom event (documented, carries detail) and the
  // standard `languagechange` event so host pages have a hook regardless of
  // which they listen for. Wrapped defensively — never let a listener throw
  // back into the launcher.
  function dispatchLangEvent(lang) {
    var detail = { lang: lang, source: 'fivucsas-launcher' };
    try {
      var ev = new CustomEvent(LANG_EVENT, { detail: detail, bubbles: true });
      (document || window).dispatchEvent(ev);
    } catch (e) { /* CustomEvent unsupported — fine */ }
    try {
      // Standard event name (e.g. used by i18n libs). Attach detail too.
      var std = new Event('languagechange');
      try { std.detail = detail; } catch (e2) { /* read-only in some engines */ }
      window.dispatchEvent(std);
    } catch (e) { /* no-op */ }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  // ---- The element ------------------------------------------------------
  var FivucsasLauncher = (function () {
    function define() {
      var Base = window.HTMLElement;

      function Ctor() {
        var self = Reflect.construct(Base, [], Ctor);
        self._open = false;
        self._lang = 'en';
        return self;
      }
      Ctor.prototype = Object.create(Base.prototype);
      Ctor.prototype.constructor = Ctor;

      Ctor.prototype.connectedCallback = function () {
        // Auto-hide on amispoof — it owns the full viewport for webcam work.
        if (currentHostname().indexOf('amispoof') === 0) {
          this.style.display = 'none';
          return;
        }
        if (this._built) return;
        this._built = true;
        // Start in the suite-wide stored choice if there is one, else mirror
        // the language the host page already rendered.
        this._lang = resolveInitialLang();
        this._render();
        this._bind();
        this._syncStoredLangToDocument();
      };

      // If the visitor previously picked a language anywhere in the suite,
      // apply it to this page's document too — even if the host's own inline
      // script defaulted the page to a different language. We re-apply after
      // the current task so we win the race against host scripts that run
      // their apply(initial) on DOMContentLoaded / at end of <body>.
      Ctor.prototype._syncStoredLangToDocument = function () {
        var stored = readStoredLang();
        if (!stored) return;
        var self = this;
        var reapply = function () {
          if (readLang() !== stored) {
            // writeLang persists + dispatches the event so cooperating host
            // pages re-localise; _applyLang keeps our own labels in step.
            writeLang(stored);
            self._applyLang(stored);
          }
        };
        // Once now (covers already-applied host state) and once deferred
        // (covers host scripts that apply their default slightly later).
        reapply();
        try {
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function () { reapply(); });
          } else {
            window.setTimeout(reapply, 0);
          }
        } catch (e) { /* no-op */ }
      };

      Ctor.prototype.disconnectedCallback = function () {
        document.removeEventListener('keydown', this._onDocKeydown, true);
      };

      // ---- DOM construction (Shadow DOM) ----
      Ctor.prototype._render = function () {
        var root = this.shadowRoot || this.attachShadow({ mode: 'open' });
        var reduced = prefersReducedMotion();

        var style = document.createElement('style');
        style.textContent = [
          ':host{all:initial;}',
          '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}',

          /* --- design tokens (kept inline so the component is portable) --- */
          ':host{--fv-accent:#6366f1;--fv-accent-2:#8b5cf6;--fv-ring:#818cf8;',
          '--fv-ink:#e8ebf5;--fv-ink-dim:#aab3c9;--fv-ink-faint:#7d879e;',
          '--fv-panel:rgba(17,20,32,0.86);--fv-line:rgba(255,255,255,0.08);}',

          /* container is just a fixed anchor; pointer-events pass through gaps */
          '.wrap{position:fixed;right:16px;bottom:16px;z-index:2147483000;pointer-events:none;}',

          /* ---- collapsed circular app-switcher button ---- */
          /* sits in a relatively-positioned shell so the tooltip + pulse ring
             can be absolutely placed around it. */
          '.fab{position:relative;margin-left:auto;width:56px;height:56px;pointer-events:auto;}',
          '.btn{position:relative;z-index:2;width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,255,255,0.16);',
          '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;outline:none;',
          'background:linear-gradient(145deg,var(--fv-accent) 0%,var(--fv-accent-2) 100%);',
          'color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;',
          'box-shadow:0 8px 22px rgba(79,70,229,0.42),0 2px 6px rgba(0,0,0,0.35);',
          'transition:transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease, filter .22s ease;}',
          '.btn:hover{transform:translateY(-3px) scale(1.04);filter:brightness(1.07);',
          'box-shadow:0 14px 32px rgba(79,70,229,0.55),0 0 0 4px rgba(129,140,248,0.18);}',
          '.btn:active{transform:translateY(-1px) scale(.98);}',
          '.btn:focus-visible{outline:2px solid var(--fv-ring);outline-offset:3px;}',
          '.btn svg{width:24px;height:24px;display:block;',
          'transition:transform .3s cubic-bezier(.34,1.56,.64,1);}',
          /* glyph nudges to a "close" feel when open */
          '.fab.is-open .btn{transform:scale(.96);box-shadow:0 6px 18px rgba(79,70,229,0.4);}',
          '.fab.is-open .btn svg{transform:rotate(45deg);}',

          /* idle pulse ring — a gentle "I'm here / I'm clickable" affordance */
          reduced
            ? '.pulse{display:none;}'
            : '.pulse{position:absolute;inset:0;border-radius:50%;z-index:1;pointer-events:none;' +
              'box-shadow:0 0 0 0 rgba(129,140,248,0.45);animation:fvPulse 3.2s ease-out infinite;}',
          reduced ? '' : '.fab:hover .pulse,.fab.is-open .pulse{animation-play-state:paused;opacity:0;}',
          reduced ? '' : '@keyframes fvPulse{0%{box-shadow:0 0 0 0 rgba(129,140,248,0.45);}' +
            '70%{box-shadow:0 0 0 12px rgba(129,140,248,0);}100%{box-shadow:0 0 0 0 rgba(129,140,248,0);}}',

          /* hover/focus tooltip — the self-explaining label */
          '.tip{position:absolute;right:66px;top:50%;transform:translateY(-50%) translateX(6px);',
          'white-space:nowrap;background:rgba(17,20,32,0.95);color:var(--fv-ink);font-size:12px;font-weight:600;',
          'padding:6px 10px;border-radius:8px;border:1px solid var(--fv-line);',
          'box-shadow:0 6px 18px rgba(0,0,0,0.4);pointer-events:none;opacity:0;',
          'transition:opacity .18s ease, transform .18s ease;}',
          '.tip::after{content:"";position:absolute;right:-5px;top:50%;transform:translateY(-50%) rotate(45deg);',
          'width:8px;height:8px;background:rgba(17,20,32,0.95);border-right:1px solid var(--fv-line);border-top:1px solid var(--fv-line);}',
          /* show on hover/focus of the button, but hide once the panel is open */
          '.fab:not(.is-open):hover .tip,.btn:focus-visible + .tip{opacity:1;transform:translateY(-50%) translateX(0);}',
          '@media (max-width:767px){.tip{display:none;}}',

          /* ---- expanded panel ---- */
          '.panel{pointer-events:auto;position:absolute;right:0;bottom:70px;width:300px;max-width:calc(100vw - 32px);',
          'background:var(--fv-panel);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);',
          'border:1px solid rgba(255,255,255,0.14);border-radius:18px;color:var(--fv-ink);',
          'box-shadow:0 24px 60px rgba(0,0,0,0.55),0 2px 0 rgba(255,255,255,0.05) inset;overflow:hidden;',
          'transform-origin:bottom right;}',
          /* a faint accent glow bleeding from the top edge — "art" */
          '.panel::before{content:"";position:absolute;top:-40%;right:-20%;width:80%;height:80%;pointer-events:none;',
          'background:radial-gradient(closest-side,rgba(99,102,241,0.28),rgba(99,102,241,0) 70%);}',
          reduced
            ? '.panel{opacity:0;visibility:hidden;}'
            : '.panel{opacity:0;visibility:hidden;transform:translateY(14px) scale(.94);' +
              'transition:opacity .26s ease, transform .34s cubic-bezier(.16,1,.3,1), visibility .26s;}',
          '.panel.is-open{opacity:1;visibility:visible;' + (reduced ? '' : 'transform:translateY(0) scale(1);') + '}',

          /* ---- header ---- */
          '.hd{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 14px 12px;',
          'border-bottom:1px solid var(--fv-line);}',
          '.hd .brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;}',
          '.logo{flex:0 0 auto;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;',
          'background:linear-gradient(145deg,var(--fv-accent),var(--fv-accent-2));color:#fff;',
          'box-shadow:0 4px 12px rgba(79,70,229,0.45);}',
          '.logo svg{width:17px;height:17px;display:block;}',
          '.titles{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;}',
          '.titles .t1{font-weight:700;font-size:14px;letter-spacing:.01em;color:#fff;line-height:1.2;',
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
          '.titles .t2{font-size:11px;color:var(--fv-ink-faint);line-height:1.3;margin-top:1px;',
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
          '.x{flex:0 0 auto;appearance:none;background:transparent;border:0;color:var(--fv-ink-dim);cursor:pointer;font-size:20px;',
          'line-height:1;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;',
          'transition:background .14s ease, color .14s ease, transform .14s ease;}',
          '.x:hover{background:rgba(255,255,255,0.09);color:#fff;transform:rotate(90deg);}',
          '.x:focus-visible{outline:2px solid var(--fv-ring);outline-offset:1px;}',

          /* ---- links (icon + name + description cards) ---- */
          '.links{list-style:none;margin:0;padding:8px;position:relative;}',
          '.links li{margin:0;}',
          '.links a{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--fv-ink-dim);',
          'padding:9px 10px;border-radius:12px;border:1px solid transparent;position:relative;',
          'transition:background .16s ease, color .16s ease, border-color .16s ease, transform .12s ease;}',
          /* staggered entrance — each row fades/slides in once the panel opens */
          reduced
            ? ''
            : '.panel .links a{opacity:0;transform:translateX(8px);}' +
              '.panel.is-open .links a{animation:fvRow .42s cubic-bezier(.16,1,.3,1) forwards;animation-delay:var(--d,0ms);}' +
              '@keyframes fvRow{to{opacity:1;transform:translateX(0);}}',
          '.links a:hover{background:rgba(129,140,248,0.14);color:#fff;border-color:rgba(129,140,248,0.22);transform:translateX(2px);}',
          '.links a:focus-visible{outline:2px solid var(--fv-ring);outline-offset:-1px;}',
          '.links a[aria-current="page"]{background:linear-gradient(100deg,rgba(99,102,241,0.22),rgba(139,92,246,0.16));',
          'color:#fff;border-color:rgba(129,140,248,0.4);}',

          /* row icon chip */
          '.ic{flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;',
          'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:var(--fv-ink-dim);',
          'transition:background .16s ease, color .16s ease, border-color .16s ease;}',
          '.ic svg{width:18px;height:18px;display:block;}',
          '.links a:hover .ic{background:rgba(129,140,248,0.2);color:#fff;border-color:rgba(129,140,248,0.3);}',
          '.links a[aria-current="page"] .ic{background:linear-gradient(145deg,var(--fv-accent),var(--fv-accent-2));',
          'color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(79,70,229,0.4);}',

          /* row text */
          '.txt{min-width:0;flex:1 1 auto;}',
          '.nm{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;color:var(--fv-ink);line-height:1.25;',
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
          '.links a[aria-current="page"] .nm{color:#fff;}',
          '.desc{font-size:11.5px;color:var(--fv-ink-faint);line-height:1.3;margin-top:1px;',
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
          '.links a:hover .desc,.links a[aria-current="page"] .desc{color:var(--fv-ink-dim);}',
          /* "current" pill on the active row */
          '.badge{flex:0 0 auto;font-size:10px;font-weight:700;letter-spacing:.01em;',
          'color:#c7ccff;background:rgba(129,140,248,0.22);border:1px solid rgba(129,140,248,0.4);',
          'padding:2px 6px;border-radius:999px;display:none;}',
          '.links a[aria-current="page"] .badge{display:inline-block;}',

          /* ---- footer / language toggle ---- */
          '.ft{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;',
          'border-top:1px solid var(--fv-line);background:rgba(255,255,255,0.02);}',
          '.ft .lbl{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--fv-ink-faint);}',
          '.seg{display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:9px;overflow:hidden;',
          'background:rgba(255,255,255,0.04);}',
          '.seg button{appearance:none;background:transparent;border:0;color:var(--fv-ink-dim);cursor:pointer;',
          'font-size:12px;font-weight:700;padding:5px 13px;transition:background .16s ease, color .16s ease;}',
          '.seg button + button{border-left:1px solid rgba(255,255,255,0.12);}',
          '.seg button:hover{color:#fff;}',
          '.seg button[aria-pressed="true"]{background:linear-gradient(145deg,var(--fv-accent),var(--fv-accent-2));color:#fff;}',
          '.seg button:focus-visible{outline:2px solid var(--fv-ring);outline-offset:-2px;}',

          /* mobile: full-width minus 16px margins each side */
          '@media (max-width:767px){.panel{width:calc(100vw - 32px);right:0;}}'
        ].join('');

        var wrap = document.createElement('div');
        wrap.className = 'wrap';

        // Build a stroked <svg> wrapper around inner icon markup. Decorative,
        // so aria-hidden. strokeWidth defaults to 1.8 (matches the brand glyph).
        function svg(inner, sw) {
          return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
            (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            inner + '</svg>';
        }
        // The 2x2 grid glyph used both as the brand mark and the FAB icon.
        var GRID =
          '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect>' +
          '<rect x="14" y="3" width="7" height="7" rx="1.5"></rect>' +
          '<rect x="3" y="14" width="7" height="7" rx="1.5"></rect>' +
          '<rect x="14" y="14" width="7" height="7" rx="1.5"></rect>';

        // ---- panel (built first so the button's aria-controls resolves) ----
        var panel = document.createElement('div');
        panel.className = 'panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-label', 'FIVUCSAS');
        panel.setAttribute('aria-labelledby', 'fivucsas-launcher-title');
        panel.id = 'fivucsas-launcher-panel';

        // header: brand mark + title + tagline, and a close button
        var hd = document.createElement('div');
        hd.className = 'hd';
        var brand = document.createElement('span');
        brand.className = 'brand';
        var logo = document.createElement('span');
        logo.className = 'logo';
        logo.setAttribute('aria-hidden', 'true');
        logo.innerHTML = svg(GRID, 2);
        var titles = document.createElement('span');
        titles.className = 'titles';
        var t1 = document.createElement('span');
        t1.className = 't1';
        t1.id = 'fivucsas-launcher-title';
        var t2 = document.createElement('span');
        t2.className = 't2';
        titles.appendChild(t1);
        titles.appendChild(t2);
        brand.appendChild(logo);
        brand.appendChild(titles);
        var closeBtn = document.createElement('button');
        closeBtn.className = 'x';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '&times;';
        hd.appendChild(brand);
        hd.appendChild(closeBtn);

        // links — each row is an icon chip + (name + one-line description)
        var host = currentHostname();
        var activeKey = resolveActiveKey(host);
        var ul = document.createElement('ul');
        ul.className = 'links';
        var linkEls = [];
        for (var i = 0; i < SITES.length; i++) {
          var s = SITES[i];
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = s.href;
          a.rel = 'noopener';
          a.setAttribute('data-key', s.key);
          // staggered entrance delay (CSS reads --d); harmless under reduced motion.
          a.style.setProperty('--d', (i * 45) + 'ms');
          if (s.key === activeKey) {
            a.setAttribute('aria-current', 'page');
            // active site link points to itself — keep it in the same tab
          } else {
            a.target = '_top';
          }
          var ic = document.createElement('span');
          ic.className = 'ic';
          ic.setAttribute('aria-hidden', 'true');
          ic.innerHTML = svg(s.icon);
          var txt = document.createElement('span');
          txt.className = 'txt';
          var nm = document.createElement('span');
          nm.className = 'nm';
          var label = document.createElement('span');
          label.className = 'lk';
          var badge = document.createElement('span');
          badge.className = 'badge';
          nm.appendChild(label);
          nm.appendChild(badge);
          var desc = document.createElement('span');
          desc.className = 'desc';
          txt.appendChild(nm);
          txt.appendChild(desc);
          a.appendChild(ic);
          a.appendChild(txt);
          li.appendChild(a);
          ul.appendChild(li);
          linkEls.push({ a: a, label: label, desc: desc, badge: badge, site: s });
        }

        // footer / language toggle
        var ft = document.createElement('div');
        ft.className = 'ft';
        var lbl = document.createElement('span');
        lbl.className = 'lbl';
        var seg = document.createElement('div');
        seg.className = 'seg';
        seg.setAttribute('role', 'group');
        var enBtn = document.createElement('button');
        enBtn.type = 'button'; enBtn.textContent = 'EN'; enBtn.setAttribute('data-set', 'en');
        var trBtn = document.createElement('button');
        trBtn.type = 'button'; trBtn.textContent = 'TR'; trBtn.setAttribute('data-set', 'tr');
        seg.appendChild(enBtn);
        seg.appendChild(trBtn);
        ft.appendChild(lbl);
        ft.appendChild(seg);

        panel.appendChild(hd);
        panel.appendChild(ul);
        panel.appendChild(ft);

        // ---- collapsed button (app-switcher) in its FAB shell ----
        var fab = document.createElement('div');
        fab.className = 'fab';
        var btn = document.createElement('button');
        btn.className = 'btn';
        btn.type = 'button';
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panel.id);
        btn.innerHTML = svg(GRID);
        // idle pulse ring (decorative; CSS hides it under reduced-motion)
        var pulse = document.createElement('span');
        pulse.className = 'pulse';
        pulse.setAttribute('aria-hidden', 'true');
        // self-explaining tooltip label
        var tip = document.createElement('span');
        tip.className = 'tip';
        tip.setAttribute('aria-hidden', 'true');
        fab.appendChild(pulse);
        fab.appendChild(btn);
        fab.appendChild(tip);

        wrap.appendChild(panel);
        wrap.appendChild(fab);

        root.appendChild(style);
        root.appendChild(wrap);

        // stash refs
        this._els = {
          wrap: wrap, fab: fab, btn: btn, panel: panel, closeBtn: closeBtn,
          t1: t1, t2: t2, tip: tip, lbl: lbl, enBtn: enBtn, trBtn: trBtn,
          links: linkEls
        };

        this._applyLang(this._lang);
      };

      // ---- i18n application ----
      Ctor.prototype._applyLang = function (lang) {
        lang = lang === 'tr' ? 'tr' : 'en';
        this._lang = lang;
        var t = STRINGS[lang];
        var e = this._els;
        // collapsed button — aria-label, native title, and the visual tooltip
        // all carry the self-explaining "switch app" hint.
        e.btn.setAttribute('aria-label', t.open);
        e.btn.title = t.open;
        e.tip.textContent = t.open;
        e.closeBtn.setAttribute('aria-label', t.close);
        e.closeBtn.title = t.close;
        // panel header
        e.t1.textContent = t.suiteTitle;
        e.t2.textContent = t.tagline;
        // language toggle label
        e.lbl.textContent = t.langLabel;
        // per-site name + one-line description (and the active-row badge)
        for (var i = 0; i < e.links.length; i++) {
          var li = e.links[i];
          li.label.textContent = li.site[lang];
          li.desc.textContent = lang === 'tr' ? li.site.dTr : li.site.dEn;
          li.badge.textContent = lang === 'tr' ? 'Şimdi' : 'Now';
        }
        e.enBtn.setAttribute('aria-pressed', String(lang === 'en'));
        e.trBtn.setAttribute('aria-pressed', String(lang === 'tr'));
      };

      // ---- events ----
      Ctor.prototype._bind = function () {
        var self = this;
        var e = this._els;

        e.btn.addEventListener('click', function () { self.toggle(); });
        e.closeBtn.addEventListener('click', function () { self.close(); });

        e.enBtn.addEventListener('click', function () { self._setLang('en'); });
        e.trBtn.addEventListener('click', function () { self._setLang('tr'); });

        // Esc closes; document-level so it fires regardless of focus position.
        this._onDocKeydown = function (ev) {
          if (!self._open) return;
          if (ev.key === 'Escape' || ev.key === 'Esc') {
            ev.preventDefault();
            self.close();
          } else if (ev.key === 'Tab') {
            self._trapFocus(ev);
          }
        };
        document.addEventListener('keydown', this._onDocKeydown, true);

        // Keep the toggle in sync if the host page changes language elsewhere.
        try {
          this._langObserver = new MutationObserver(function () {
            var l = readLang();
            if (l !== self._lang) self._applyLang(l);
          });
          this._langObserver.observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-lang', 'lang']
          });
        } catch (err) { /* MutationObserver unsupported — fine */ }
      };

      Ctor.prototype._setLang = function (lang) {
        // Write to the document (the suite's shared pattern) and reflect locally.
        writeLang(lang);
        this._applyLang(lang);
      };

      // ---- focus trap within the panel while open ----
      Ctor.prototype._focusables = function () {
        var e = this._els;
        var list = [e.closeBtn];
        for (var i = 0; i < e.links.length; i++) list.push(e.links[i].a);
        list.push(e.enBtn, e.trBtn);
        return list;
      };

      Ctor.prototype._trapFocus = function (ev) {
        var f = this._focusables();
        if (!f.length) return;
        var first = f[0];
        var last = f[f.length - 1];
        var root = this.shadowRoot;
        var active = root.activeElement;
        if (ev.shiftKey) {
          if (active === first || !root.contains(active)) {
            ev.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !root.contains(active)) {
            ev.preventDefault();
            first.focus();
          }
        }
      };

      // ---- public open/close/toggle ----
      Ctor.prototype.open = function () {
        if (this._open) return;
        this._open = true;
        var e = this._els;
        e.panel.classList.add('is-open');
        // .is-open on the FAB shell morphs the glyph, pauses the idle pulse and
        // suppresses the tooltip while the panel is showing.
        if (e.fab) e.fab.classList.add('is-open');
        e.btn.setAttribute('aria-expanded', 'true');
        // move focus into the panel (first focusable link).
        var f = this._focusables();
        var target = (e.links[0] && e.links[0].a) || f[0];
        if (target) target.focus();
      };

      Ctor.prototype.close = function () {
        if (!this._open) return;
        this._open = false;
        var e = this._els;
        e.panel.classList.remove('is-open');
        if (e.fab) e.fab.classList.remove('is-open');
        e.btn.setAttribute('aria-expanded', 'false');
        // return focus to the launcher button.
        e.btn.focus();
      };

      Ctor.prototype.toggle = function () {
        if (this._open) this.close(); else this.open();
      };

      window.customElements.define(TAG, Ctor);
      return Ctor;
    }

    return define();
  })();

  // ---- auto-instantiate on load ----
  function autoMount() {
    if (document.querySelector(TAG)) return;
    var el = document.createElement(TAG);
    (document.body || document.documentElement).appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    autoMount();
  }

  // Expose for explicit use if a host page prefers manual control.
  try { window.FivucsasLauncher = FivucsasLauncher; } catch (e) { /* no-op */ }
})();
