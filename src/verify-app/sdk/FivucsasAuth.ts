/**
 * @fivucsas/auth-js — Lightweight SDK for embedding the FIVUCSAS
 * biometric authentication widget in any website or application.
 *
 * Zero dependencies. Communicates with the verify-app iframe via postMessage.
 */

// ─── Public Types ──────────────────────────────────────────────────

export interface FivucsasTheme {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
    mode?: 'light' | 'dark';
}

export interface FivucsasConfig {
    clientId: string;
    baseUrl?: string;
    apiBaseUrl?: string;
    locale?: 'en' | 'tr';
    theme?: FivucsasTheme;
}

export interface VerifyOptions {
    flow?: string;
    userId?: string;
    sessionId?: string;
    methods?: string[];
    container?: string | HTMLElement;
    onStepChange?: (step: { method: string; progress: number; total: number }) => void;
    onError?: (error: { code: string; message: string }) => void;
    onCancel?: () => void;
}

export interface LoginRedirectOptions {
    redirectUri: string;
    scope?: string;
    state?: string;
    nonce?: string;
    display?: 'page';
}

export interface VerifyResult {
    success: boolean;
    sessionId: string;
    userId?: string;
    email?: string;
    displayName?: string;
    completedMethods: string[];
    authCode?: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenType?: string;
    expiresIn?: number;
    timestamp?: number;
}

// ─── Constants ─────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://verify.fivucsas.com';
const DEFAULT_API_BASE_URL = 'https://api.fivucsas.com/api/v1';
const IFRAME_ID = 'fivucsas-verify-iframe';

const STORAGE_PKCE = 'fivucsas:pkce';
const STORAGE_STATE = 'fivucsas:state';
const STORAGE_NONCE = 'fivucsas:nonce';
const STORAGE_REDIRECT_URI = 'fivucsas:redirect_uri';

// ─── PKCE / state helpers (RFC 7636, RFC 6749 §10.12) ──────────────

function base64UrlEncode(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomUrlSafeString(byteLength = 32): string {
    const arr = new Uint8Array(byteLength);
    crypto.getRandomValues(arr);
    return base64UrlEncode(arr);
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
    const verifier = randomUrlSafeString(32);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: base64UrlEncode(new Uint8Array(hash)) };
}

// ─── CSS (injected once) ───────────────────────────────────────────

const OVERLAY_STYLES = `
.fivucsas-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: fivucsas-fade-in 0.2s ease-out;
}
.fivucsas-overlay-inner {
    position: relative;
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}
.fivucsas-close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.06);
    color: #333;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
}
.fivucsas-close-btn:hover {
    background: rgba(0, 0, 0, 0.12);
}
.fivucsas-iframe {
    display: block;
    width: 100%;
    min-height: 560px;
    height: auto;
    border: none;
}
@keyframes fivucsas-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@media (max-width: 480px) {
    .fivucsas-overlay-inner {
        max-width: 100%;
        max-height: 100vh;
        border-radius: 0;
    }
}
`;

let stylesInjected = false;

function injectStyles(): void {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);
    stylesInjected = true;
}

// ─── Main Class ────────────────────────────────────────────────────

export class FivucsasAuth {
    private config: Required<FivucsasConfig>;
    private iframe: HTMLIFrameElement | null = null;
    private overlay: HTMLElement | null = null;
    private messageHandler: ((event: MessageEvent) => void) | null = null;
    private activeReject: ((reason: Error) => void) | null = null;

    constructor(config: FivucsasConfig) {
        if (!config.clientId) {
            throw new Error('FivucsasAuth: clientId is required');
        }
        this.config = {
            clientId: config.clientId,
            baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
            apiBaseUrl: config.apiBaseUrl ?? DEFAULT_API_BASE_URL,
            locale: config.locale ?? 'en',
            theme: config.theme ?? {},
        };
    }

    // ── Public API ──────────────────────────────────────────────────

    verify(options: VerifyOptions = {}): Promise<VerifyResult> {
        // Prevent concurrent verifications
        if (this.iframe) {
            return Promise.reject(new Error('FivucsasAuth: verification already in progress'));
        }

        injectStyles();

        return new Promise<VerifyResult>((resolve, reject) => {
            this.activeReject = reject;

            // Determine mount target
            let container: HTMLElement;
            let isModal = false;

            if (options.container) {
                const el =
                    typeof options.container === 'string'
                        ? document.querySelector<HTMLElement>(options.container)
                        : options.container;
                if (!el) {
                    this.activeReject = null;
                    reject(new Error(`FivucsasAuth: container not found: ${options.container}`));
                    return;
                }
                container = el;
            } else {
                isModal = true;
                this.overlay = this.createOverlay(() => {
                    options.onCancel?.();
                    this.cleanup();
                    reject(new Error('FivucsasAuth: verification cancelled by user'));
                });
                document.body.appendChild(this.overlay);
                container = this.overlay.querySelector('.fivucsas-overlay-inner')!;
            }

            // Create iframe
            this.iframe = this.createIframe(container, options);

            // Listen for messages
            this.setupMessageListener(resolve, reject, options, isModal);
        });
    }

    destroy(): void {
        if (this.activeReject) {
            this.activeReject(new Error('FivucsasAuth: destroyed'));
            this.activeReject = null;
        }
        this.cleanup();
    }

    /**
     * Primary hosted-login entry point. Redirects the current top-level
     * browsing context to {@link https://verify.fivucsas.com/login} via the
     * identity API's OAuth 2.0 authorize endpoint with `display=page`.
     *
     * Generates PKCE (S256) + CSRF `state` + OIDC `nonce` and stores them in
     * sessionStorage for {@link handleRedirectCallback} to consume after the
     * provider redirects back to `redirectUri` with `?code=...&state=...`.
     *
     * This method navigates away — it returns a Promise that resolves only
     * once the navigation has been initiated. In practice the caller will
     * never observe the resolution because the page is unloading.
     */
    async loginRedirect(options: LoginRedirectOptions): Promise<void> {
        if (!options?.redirectUri) {
            throw new Error('FivucsasAuth: loginRedirect requires options.redirectUri');
        }
        if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
            throw new Error('FivucsasAuth: loginRedirect requires a browser with Web Crypto');
        }

        const state = options.state ?? randomUrlSafeString(32);
        const nonce = options.nonce ?? randomUrlSafeString(32);
        const { verifier, challenge } = await generatePkce();

        sessionStorage.setItem(STORAGE_PKCE, verifier);
        sessionStorage.setItem(STORAGE_STATE, state);
        sessionStorage.setItem(STORAGE_NONCE, nonce);
        sessionStorage.setItem(STORAGE_REDIRECT_URI, options.redirectUri);

        const url = new URL(`${this.apiBase()}/oauth2/authorize`);
        url.searchParams.set('client_id', this.config.clientId);
        url.searchParams.set('redirect_uri', options.redirectUri);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', options.scope ?? 'openid profile email');
        url.searchParams.set('state', state);
        url.searchParams.set('nonce', nonce);
        url.searchParams.set('code_challenge', challenge);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('display', options.display ?? 'page');

        window.location.assign(url.toString());
    }

    /**
     * Complete the hosted-login flow after the identity provider redirects
     * back to the tenant's `redirect_uri`. Validates the `state` parameter
     * against the value stored in sessionStorage, then exchanges the
     * authorization code at `/oauth2/token` using the stored PKCE verifier.
     *
     * Single-use: PKCE/state/nonce are removed from sessionStorage after
     * the call, whether or not the exchange succeeded.
     */
    async handleRedirectCallback(): Promise<VerifyResult> {
        if (typeof window === 'undefined') {
            throw new Error('FivucsasAuth: handleRedirectCallback requires a browser');
        }

        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error');
        if (oauthError) {
            this.clearPkceStorage();
            const description = params.get('error_description');
            throw new Error(`FivucsasAuth [${oauthError}]: ${description ?? 'OAuth error'}`);
        }

        const code = params.get('code');
        const state = params.get('state');

        const expectedState = sessionStorage.getItem(STORAGE_STATE);
        const verifier = sessionStorage.getItem(STORAGE_PKCE);
        const redirectUri = sessionStorage.getItem(STORAGE_REDIRECT_URI);

        if (!code) {
            this.clearPkceStorage();
            throw new Error('FivucsasAuth: missing authorization code in callback URL');
        }
        if (!expectedState || !state || state !== expectedState) {
            this.clearPkceStorage();
            throw new Error('FivucsasAuth: state mismatch — possible CSRF or expired session');
        }
        if (!verifier || !redirectUri) {
            this.clearPkceStorage();
            throw new Error('FivucsasAuth: missing PKCE verifier or redirect URI — session lost');
        }

        const body = new URLSearchParams();
        body.set('grant_type', 'authorization_code');
        body.set('code', code);
        body.set('redirect_uri', redirectUri);
        body.set('client_id', this.config.clientId);
        body.set('code_verifier', verifier);

        let response: Response;
        try {
            response = await fetch(`${this.apiBase()}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });
        } finally {
            // PKCE verifier + state are single-use — clear even on network failure
            this.clearPkceStorage();
        }

        if (!response.ok) {
            let detail = '';
            try {
                const err = await response.json();
                detail = err.error_description || err.error || '';
            } catch {
                // non-JSON body
            }
            throw new Error(
                `FivucsasAuth: token exchange failed (${response.status})${detail ? ': ' + detail : ''}`
            );
        }

        const tokens = await response.json();
        return {
            success: true,
            sessionId: '',
            completedMethods: [],
            accessToken: tokens.access_token ? String(tokens.access_token) : undefined,
            refreshToken: tokens.refresh_token ? String(tokens.refresh_token) : undefined,
            idToken: tokens.id_token ? String(tokens.id_token) : undefined,
            tokenType: tokens.token_type ? String(tokens.token_type) : undefined,
            expiresIn: typeof tokens.expires_in === 'number' ? tokens.expires_in : undefined,
            timestamp: Date.now(),
        };
    }

    // ── Private Helpers ─────────────────────────────────────────────

    private apiBase(): string {
        return this.config.apiBaseUrl.replace(/\/$/, '');
    }

    private clearPkceStorage(): void {
        try {
            sessionStorage.removeItem(STORAGE_PKCE);
            sessionStorage.removeItem(STORAGE_STATE);
            sessionStorage.removeItem(STORAGE_NONCE);
            sessionStorage.removeItem(STORAGE_REDIRECT_URI);
        } catch {
            // sessionStorage unavailable (e.g. sandboxed) — nothing to clean
        }
    }

    private createIframe(container: HTMLElement, options: VerifyOptions): HTMLIFrameElement {
        const iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.className = 'fivucsas-iframe';
        iframe.src = this.buildIframeUrl(options);
        // Permissions Policy: bare feature names delegate to the iframe's src origin
        // (verify.fivucsas.com). Quoted 'src' is NOT valid Permissions Policy syntax.
        iframe.setAttribute(
            'allow',
            'camera; microphone; publickey-credentials-get; publickey-credentials-create'
        );
        iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals');
        iframe.setAttribute('title', 'FIVUCSAS Identity Verification');
        container.appendChild(iframe);
        return iframe;
    }

    private createOverlay(onClose: () => void): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'fivucsas-overlay';

        const inner = document.createElement('div');
        inner.className = 'fivucsas-overlay-inner';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'fivucsas-close-btn';
        closeBtn.setAttribute('aria-label', 'Close verification');
        closeBtn.textContent = '\u00D7'; // multiplication sign (x)
        closeBtn.addEventListener('click', onClose);

        inner.appendChild(closeBtn);
        overlay.appendChild(inner);

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) onClose();
        });

        // Close on Escape
        const escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                onClose();
            }
        };
        document.addEventListener('keydown', escHandler);

        return overlay;
    }

    private buildIframeUrl(options: VerifyOptions): string {
        const url = new URL(this.config.baseUrl);
        // Use snake_case params to match VerifyApp's parseUrlParams()
        url.searchParams.set('client_id', this.config.clientId);

        if (options.flow) url.searchParams.set('flow', options.flow);
        if (options.userId) url.searchParams.set('user_id', options.userId);
        if (options.sessionId) {
            url.searchParams.set('session_id', options.sessionId);
            url.searchParams.set('mode', 'session');
        } else {
            // No sessionId: open in login mode
            url.searchParams.set('mode', 'login');
        }
        if (options.methods?.length) url.searchParams.set('methods', options.methods.join(','));
        if (this.config.locale) url.searchParams.set('locale', this.config.locale);
        if (this.config.apiBaseUrl) url.searchParams.set('api_base_url', this.config.apiBaseUrl);
        if (this.config.theme?.mode) url.searchParams.set('theme', this.config.theme.mode);

        return url.toString();
    }

    private setupMessageListener(
        resolve: (value: VerifyResult) => void,
        reject: (reason: Error) => void,
        options: VerifyOptions,
        _isModal: boolean
    ): void {
        this.messageHandler = (event: MessageEvent) => {
            // Validate origin
            const expectedOrigin = new URL(this.config.baseUrl).origin;
            if (event.origin !== expectedOrigin) return;

            const data = event.data;
            if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
            if (!data.type.startsWith('fivucsas:')) return;

            const payload = data.payload ?? {};

            switch (data.type) {
                case 'fivucsas:ready':
                    // Send configuration to the iframe
                    this.iframe?.contentWindow?.postMessage(
                        {
                            type: 'fivucsas:config',
                            payload: {
                                theme: this.config.theme.mode ?? 'light',
                                locale: this.config.locale,
                                apiBaseUrl: this.config.apiBaseUrl,
                                allowedOrigin: window.location.origin,
                            },
                        },
                        expectedOrigin
                    );
                    break;

                case 'fivucsas:step-change':
                    options.onStepChange?.({
                        method: String(payload.methodType ?? ''),
                        progress: Number(payload.stepIndex ?? 0) + 1,
                        total: Number(payload.totalSteps ?? 0),
                    });
                    break;

                case 'fivucsas:complete': {
                    const result: VerifyResult = {
                        success: true,
                        sessionId: String(payload.sessionId ?? ''),
                        userId: payload.userId ? String(payload.userId) : undefined,
                        email: payload.email ? String(payload.email) : undefined,
                        displayName: payload.displayName ? String(payload.displayName) : undefined,
                        completedMethods: Array.isArray(payload.completedMethods)
                            ? payload.completedMethods.map(String)
                            : [],
                        authCode: payload.authCode ? String(payload.authCode) : undefined,
                        accessToken: payload.accessToken ? String(payload.accessToken) : undefined,
                        refreshToken: payload.refreshToken ? String(payload.refreshToken) : undefined,
                        timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : undefined,
                    };
                    this.activeReject = null;
                    this.cleanup();
                    resolve(result);
                    break;
                }

                case 'fivucsas:error': {
                    const error = {
                        code: String(payload.code ?? 'UNKNOWN'),
                        message: String(payload.error ?? 'Verification failed'),
                    };
                    options.onError?.(error);
                    this.activeReject = null;
                    this.cleanup();
                    reject(new Error(`FivucsasAuth [${error.code}]: ${error.message}`));
                    break;
                }

                case 'fivucsas:cancel':
                    options.onCancel?.();
                    this.activeReject = null;
                    this.cleanup();
                    reject(new Error('FivucsasAuth: verification cancelled'));
                    break;

                case 'fivucsas:resize':
                    if (this.iframe && typeof payload.height === 'number') {
                        this.iframe.style.height = `${payload.height}px`;
                    }
                    break;
            }
        };

        window.addEventListener('message', this.messageHandler);
    }

    private cleanup(): void {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}
