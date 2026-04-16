/**
 * <fivucsas-button> — "FIVUCSAS ile Giriş Yap" button.
 *
 * Opens a modal containing <fivucsas-verify> on click. All auth-related
 * attributes are forwarded to the inner <fivucsas-verify> element.
 * Events fired by <fivucsas-verify> bubble up through Shadow DOM (composed: true)
 * so the host page can listen on document or any ancestor.
 *
 * @attr tenant-id    - forwarded to <fivucsas-verify>
 * @attr client-id    - forwarded to <fivucsas-verify>
 * @attr redirect-uri - forwarded to <fivucsas-verify>
 * @attr scope        - forwarded to <fivucsas-verify>
 * @attr theme        - forwarded to <fivucsas-verify> (default: "light")
 * @attr lang         - forwarded to <fivucsas-verify> (default: "tr")
 * @attr verify-url   - forwarded to <fivucsas-verify>
 * @attr label        - Button text (default: "FIVUCSAS ile Giriş Yap")
 *
 * @fires fivucsas:complete - bubbles up from inner verify element
 * @fires fivucsas:error    - bubbles up from inner verify element
 * @fires fivucsas:ready    - bubbles up from inner verify element
 * @fires fivucsas:cancel   - bubbles up; also closes the modal
 */
export class FivucsasButton extends HTMLElement {
    static get observedAttributes() {
        return [
            'tenant-id', 'client-id', 'redirect-uri', 'scope',
            'theme', 'lang', 'verify-url', 'label',
        ];
    }

    private shadow: ShadowRoot;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this._render();
    }

    attributeChangedCallback() {
        if (this.isConnected) this._render();
    }

    private _attr(name: string, fallback = ''): string {
        return this.getAttribute(name) ?? fallback;
    }

    private _render(): void {
        const label = this._attr('label', 'FIVUCSAS ile Giriş Yap');

        this.shadow.innerHTML = `
      <style>
        button.login-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #1a73e8;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s;
        }
        button.login-btn:hover { background: #1557b0; }
        button.login-btn:focus-visible {
          outline: 3px solid #1a73e8;
          outline-offset: 2px;
        }
        .modal-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 9999;
          align-items: center;
          justify-content: center;
        }
        .modal-overlay.open { display: flex; }
        .modal-box { position: relative; }
        button.modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          line-height: 1;
          padding: 4px;
        }
        button.modal-close:hover { color: #000; }
      </style>

      <button class="login-btn" type="button">${label}</button>

      <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="${label}">
        <div class="modal-box">
          <button class="modal-close" type="button" aria-label="Kapat">&#x2715;</button>
          <fivucsas-verify
            tenant-id="${this._attr('tenant-id')}"
            client-id="${this._attr('client-id')}"
            redirect-uri="${this._attr('redirect-uri')}"
            scope="${this._attr('scope', 'openid profile')}"
            theme="${this._attr('theme', 'light')}"
            lang="${this._attr('lang', 'tr')}"
            verify-url="${this._attr('verify-url', 'https://verify.fivucsas.com')}">
          </fivucsas-verify>
        </div>
      </div>
    `;

        const overlay = this.shadow.querySelector('.modal-overlay')!;

        this.shadow.querySelector('button.login-btn')!.addEventListener('click', () => {
            overlay.classList.add('open');
        });

        this.shadow.querySelector('button.modal-close')!.addEventListener('click', () => {
            overlay.classList.remove('open');
        });

        // Close on backdrop click (but not on modal-box click)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
            }
        });

        // Auto-close on successful auth or cancel
        this.shadow.querySelector('fivucsas-verify')!.addEventListener('fivucsas:complete', () => {
            overlay.classList.remove('open');
        });
        this.shadow.querySelector('fivucsas-verify')!.addEventListener('fivucsas:cancel', () => {
            overlay.classList.remove('open');
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
            }
        });
    }
}
