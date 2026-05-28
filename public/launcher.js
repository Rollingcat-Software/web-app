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
 *   - Collapsed: 56px circular button, fixed bottom-right, 16px inset.
 *   - Expanded: ~280px panel sliding up with the 6 suite links + EN|TR toggle.
 *   - Active site highlighted by comparing location.hostname.
 *   - Language toggle mirrors the static sites' pattern: it reads/writes
 *     document.documentElement[data-lang] and [lang] (values 'tr' | 'en').
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

  // Don't double-define if the script is included more than once across sites.
  if (typeof window === 'undefined' || window.customElements == null) return;
  if (window.customElements.get(TAG)) return;

  // ---- Single source of truth: the suite's sites ------------------------
  // `key` is used both for i18n lookup and as a stable identifier.
  var SITES = [
    { key: 'home',      href: 'https://fivucsas.com',          host: 'fivucsas.com',          en: 'Home',        tr: 'Ana Sayfa' },
    { key: 'dashboard', href: 'https://app.fivucsas.com',      host: 'app.fivucsas.com',      en: 'Dashboard',   tr: 'Panel' },
    { key: 'widget',    href: 'https://verify.fivucsas.com',   host: 'verify.fivucsas.com',   en: 'Auth Widget', tr: 'Doğrulama Aracı' },
    { key: 'demo',      href: 'https://demo.fivucsas.com',     host: 'demo.fivucsas.com',     en: 'Demo',        tr: 'Demo' },
    { key: 'amispoof',  href: 'https://amispoof.fivucsas.com', host: 'amispoof.fivucsas.com', en: 'amispoof',    tr: 'amispoof' },
    { key: 'docs',      href: 'https://docs.fivucsas.com',     host: 'docs.fivucsas.com',     en: 'Docs',        tr: 'Belgeler' }
  ];

  // UI strings (everything that isn't a site label).
  var STRINGS = {
    en: { open: 'Open FIVUCSAS navigation', close: 'Close', title: 'FIVUCSAS', langLabel: 'Language' },
    tr: { open: 'FIVUCSAS gezinmesini aç',  close: 'Kapat', title: 'FIVUCSAS', langLabel: 'Dil' }
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

  // Read the current language from the document, defaulting to 'en'.
  function readLang() {
    try {
      var el = document.documentElement;
      var v = el.getAttribute('data-lang') || el.getAttribute('lang') || 'en';
      v = String(v).toLowerCase().slice(0, 2);
      return v === 'tr' ? 'tr' : 'en';
    } catch (e) { return 'en'; }
  }

  // Write language using the exact pattern the static suite sites use:
  //   html.setAttribute('data-lang', lang); html.setAttribute('lang', lang);
  function writeLang(lang) {
    try {
      var el = document.documentElement;
      el.setAttribute('data-lang', lang);
      el.setAttribute('lang', lang);
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
        this._lang = readLang();
        this._render();
        this._bind();
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
          '*{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}',

          /* container is just a fixed anchor; pointer-events pass through gaps */
          '.wrap{position:fixed;right:16px;bottom:16px;z-index:2147483000;pointer-events:none;}',

          /* collapsed circular button */
          '.btn{pointer-events:auto;width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,255,255,0.14);',
          'background:rgba(15,18,28,0.62);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
          'color:#e5e9f0;display:flex;align-items:center;justify-content:center;cursor:pointer;',
          'box-shadow:0 6px 22px rgba(0,0,0,0.38);margin-left:auto;',
          'transition:transform .18s ease, box-shadow .18s ease, background .18s ease;}',
          '.btn:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,0.48);background:rgba(20,24,36,0.78);}',
          '.btn:focus-visible{outline:2px solid #818cf8;outline-offset:3px;}',
          '.btn svg{width:24px;height:24px;display:block;}',

          /* expanded panel */
          '.panel{pointer-events:auto;position:absolute;right:0;bottom:68px;width:280px;max-width:calc(100vw - 32px);',
          'background:rgba(12,15,23,0.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
          'border:1px solid rgba(255,255,255,0.12);border-radius:14px;color:#e5e9f0;',
          'box-shadow:0 16px 48px rgba(0,0,0,0.55);overflow:hidden;',
          'transform-origin:bottom right;}',
          reduced
            ? '.panel{opacity:0;visibility:hidden;}'
            : '.panel{opacity:0;visibility:hidden;transform:translateY(10px) scale(.98);transition:opacity .2s ease, transform .2s ease, visibility .2s;}',
          '.panel.is-open{opacity:1;visibility:visible;' + (reduced ? '' : 'transform:translateY(0) scale(1);') + '}',

          /* header */
          '.hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;',
          'border-bottom:1px solid rgba(255,255,255,0.09);}',
          '.hd .brand{font-weight:700;font-size:14px;letter-spacing:.04em;color:#c7d0e0;}',
          '.x{appearance:none;background:transparent;border:0;color:#9aa4b8;cursor:pointer;font-size:18px;',
          'line-height:1;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;}',
          '.x:hover{background:rgba(255,255,255,0.08);color:#e5e9f0;}',
          '.x:focus-visible{outline:2px solid #818cf8;outline-offset:1px;}',

          /* links */
          '.links{list-style:none;margin:0;padding:6px;}',
          '.links li{margin:0;}',
          '.links a{display:flex;align-items:center;gap:8px;text-decoration:none;color:#cbd5e1;',
          'padding:9px 10px;border-radius:9px;font-size:13.5px;transition:background .14s ease, color .14s ease;}',
          '.links a:hover{background:rgba(129,140,248,0.12);color:#fff;}',
          '.links a:focus-visible{outline:2px solid #818cf8;outline-offset:-2px;}',
          '.links a[aria-current="page"]{background:rgba(129,140,248,0.16);color:#fff;font-weight:600;}',
          '.dot{width:6px;height:6px;border-radius:50%;background:transparent;flex:0 0 auto;}',
          '.links a[aria-current="page"] .dot{background:#818cf8;}',

          /* footer / language toggle */
          '.ft{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;',
          'border-top:1px solid rgba(255,255,255,0.09);}',
          '.ft .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7b859a;}',
          '.seg{display:inline-flex;border:1px solid rgba(255,255,255,0.14);border-radius:8px;overflow:hidden;}',
          '.seg button{appearance:none;background:transparent;border:0;color:#9aa4b8;cursor:pointer;',
          'font-size:12px;font-weight:600;padding:5px 12px;transition:background .14s ease, color .14s ease;}',
          '.seg button + button{border-left:1px solid rgba(255,255,255,0.14);}',
          '.seg button:hover{color:#e5e9f0;}',
          '.seg button[aria-pressed="true"]{background:#6366f1;color:#fff;}',
          '.seg button:focus-visible{outline:2px solid #818cf8;outline-offset:-2px;}',

          /* mobile: full-width minus 16px margins each side */
          '@media (max-width:767px){.panel{width:calc(100vw - 32px);right:0;}}'
        ].join('');

        var wrap = document.createElement('div');
        wrap.className = 'wrap';

        // ---- panel (built first so the button's aria-controls resolves) ----
        var panel = document.createElement('div');
        panel.className = 'panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-label', 'FIVUCSAS');
        panel.id = 'fivucsas-launcher-panel';

        // header
        var hd = document.createElement('div');
        hd.className = 'hd';
        var brand = document.createElement('span');
        brand.className = 'brand';
        brand.textContent = STRINGS.en.title; // brand is constant across langs
        var closeBtn = document.createElement('button');
        closeBtn.className = 'x';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '&times;';
        hd.appendChild(brand);
        hd.appendChild(closeBtn);

        // links
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
          if (s.key === activeKey) {
            a.setAttribute('aria-current', 'page');
            // active site link points to itself — keep it in the same tab
          } else {
            a.target = '_top';
          }
          var dot = document.createElement('span');
          dot.className = 'dot';
          dot.setAttribute('aria-hidden', 'true');
          var label = document.createElement('span');
          label.className = 'lk';
          a.appendChild(dot);
          a.appendChild(label);
          li.appendChild(a);
          ul.appendChild(li);
          linkEls.push({ a: a, label: label, site: s });
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

        // ---- collapsed button ----
        var btn = document.createElement('button');
        btn.className = 'btn';
        btn.type = 'button';
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panel.id);
        // "⊞" grid/compass icon
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect>' +
          '<rect x="14" y="3" width="7" height="7" rx="1.5"></rect>' +
          '<rect x="3" y="14" width="7" height="7" rx="1.5"></rect>' +
          '<rect x="14" y="14" width="7" height="7" rx="1.5"></rect>' +
          '</svg>';

        wrap.appendChild(panel);
        wrap.appendChild(btn);

        root.appendChild(style);
        root.appendChild(wrap);

        // stash refs
        this._els = {
          wrap: wrap, btn: btn, panel: panel, closeBtn: closeBtn,
          brand: brand, lbl: lbl, enBtn: enBtn, trBtn: trBtn,
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
        e.btn.setAttribute('aria-label', t.open);
        e.btn.title = t.open;
        e.closeBtn.setAttribute('aria-label', t.close);
        e.closeBtn.title = t.close;
        e.lbl.textContent = t.langLabel;
        for (var i = 0; i < e.links.length; i++) {
          e.links[i].label.textContent = e.links[i].site[lang];
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
    // Skip entirely on amispoof — full viewport reserved for webcam analysis.
    if (currentHostname().indexOf('amispoof') === 0) return;
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
