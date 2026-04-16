/**
 * <fivucsas-verify> Custom Element
 *
 * Embeds the FIVUCSAS biometric authentication flow as a standard Web Component.
 * Uses Shadow DOM to isolate styles. Wraps verify-app in an iframe and bridges
 * postMessage events as CustomEvents on the host element.
 *
 * The postMessage bridge (postMessageBridge.ts) sends messages with types prefixed
 * 'fivucsas:' (e.g. 'fivucsas:ready', 'fivucsas:complete'). This element forwards
 * those directly as DOM CustomEvents so host apps can listen with addEventListener.
 *
 * @attr tenant-id  - Tenant identifier (required)
 * @attr client-id  - OAuth client ID (required)
 * @attr redirect-uri - OAuth redirect URI (required)
 * @attr scope      - Space-separated OAuth scopes (default: "openid profile")
 * @attr theme      - Color theme: "light" | "dark" (default: "light")
 * @attr lang       - Language: "tr" | "en" (default: "tr")
 * @attr verify-url - Base URL of verify app (default: "https://verify.fivucsas.com")
 * @attr width      - Iframe width (default: "400px")
 * @attr height     - Iframe height (default: "600px")
 *
 * @fires fivucsas:ready
 * @fires fivucsas:complete  - detail: {accessToken, refreshToken, userId, sessionId, email}
 * @fires fivucsas:error     - detail: {error, code, timestamp}
 * @fires fivucsas:step-change - detail: {stepIndex, methodType, totalSteps}
 * @fires fivucsas:cancel    - detail: {sessionId, timestamp}
 * @fires fivucsas:resize    - detail: {height}
 *
 * @example
 * <fivucsas-verify
 *   tenant-id="marmara"
 *   client-id="my-app"
 *   redirect-uri="https://myapp.com/callback"
 *   theme="light"
 *   lang="tr">
 * </fivucsas-verify>
 */

const OBSERVED_ATTRS = [
    'tenant-id', 'client-id', 'redirect-uri', 'scope',
    'theme', 'lang', 'verify-url', 'width', 'height',
] as const;

/**
 * Message types emitted by postMessageBridge.ts (fivucsas: prefix, lowercase).
 * These are forwarded 1-to-1 as CustomEvents on the host element.
 */
const FORWARDED_EVENTS = new Set([
    'fivucsas:ready',
    'fivucsas:complete',
    'fivucsas:error',
    'fivucsas:step-change',
    'fivucsas:cancel',
    'fivucsas:resize',
]);

export class FivucsasVerify extends HTMLElement {
    static get observedAttributes() { return OBSERVED_ATTRS; }

    private shadow: ShadowRoot;
    private messageHandler: ((e: MessageEvent) => void) | null = null;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this._render();
        this._attachMessageListener();
    }

    disconnectedCallback() {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
    }

    attributeChangedCallback() {
        if (this.isConnected) this._render();
    }

    private _attr(name: string, fallback = ''): string {
        return this.getAttribute(name) ?? fallback;
    }

    private _buildSrc(): string {
        const base = this._attr('verify-url', 'https://verify.fivucsas.com');
        const params = new URLSearchParams({
            tenantId: this._attr('tenant-id'),
            clientId: this._attr('client-id'),
            redirectUri: this._attr('redirect-uri'),
            scope: this._attr('scope', 'openid profile'),
            theme: this._attr('theme', 'light'),
            lang: this._attr('lang', 'tr'),
            embed: '1',
        });
        return `${base}?${params}`;
    }

    private _render(): void {
        const w = this._attr('width', '400px');
        const h = this._attr('height', '600px');

        this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        iframe {
          border: none;
          border-radius: 12px;
          width: ${w};
          height: ${h};
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
        }
      </style>
      <iframe
        src="${this._buildSrc()}"
        allow="camera;microphone"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="FIVUCSAS Kimlik Doğrulama">
      </iframe>
    `;
    }

    private _attachMessageListener(): void {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
        }

        this.messageHandler = (event: MessageEvent) => {
            // Only accept messages from the configured verify-app origin
            const verifyOrigin = new URL(
                this._attr('verify-url', 'https://verify.fivucsas.com')
            ).origin;

            if (
                event.origin !== verifyOrigin &&
                event.origin !== window.location.origin
            ) {
                return;
            }

            if (!event.data || typeof event.data !== 'object') return;

            // postMessageBridge.ts sends { type: 'fivucsas:*', payload: {...} }
            const { type, payload } = event.data as { type: string; payload?: unknown };

            if (typeof type !== 'string' || !FORWARDED_EVENTS.has(type)) return;

            this.dispatchEvent(
                new CustomEvent(type, {
                    detail: payload,
                    bubbles: true,
                    composed: true,
                })
            );
        };

        window.addEventListener('message', this.messageHandler);
    }
}
