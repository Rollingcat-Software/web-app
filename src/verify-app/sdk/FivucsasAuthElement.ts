/**
 * <fivucsas-verify> Web Component
 *
 * Wraps FivucsasAuth into a declarative custom element.
 *
 * Usage:
 *   <fivucsas-verify
 *     client-id="my-app"
 *     flow="login"
 *     locale="en"
 *     theme='{"mode":"dark"}'
 *     auto-verify
 *   ></fivucsas-verify>
 *
 * Events: fivucsas-complete, fivucsas-error, fivucsas-cancel, fivucsas-step-change
 */

import { FivucsasAuth } from './FivucsasAuth';
import type { FivucsasConfig, FivucsasTheme, VerifyOptions, VerifyResult } from './FivucsasAuth';

// ─── Styles ────────────────────────────────────────────────────────

const ELEMENT_STYLES = `
:host {
    display: inline-block;
}
.fivucsas-trigger-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: #1a73e8;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
}
.fivucsas-trigger-btn:hover {
    background: #1557b0;
}
.fivucsas-trigger-btn:active {
    transform: scale(0.98);
}
.fivucsas-trigger-btn .icon {
    width: 18px;
    height: 18px;
}
.fivucsas-inline-container {
    width: 100%;
    min-height: 200px;
}
`;

// ─── Element ───────────────────────────────────────────────────────

export class FivucsasVerifyElement extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['client-id', 'flow', 'user-id', 'theme', 'locale', 'api-base-url', 'base-url'];
    }

    private auth: FivucsasAuth | null = null;
    private shadow: ShadowRoot;
    private verifying = false;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback(): void {
        this.render();

        if (this.hasAttribute('auto-verify')) {
            this.startVerification();
        }
    }

    disconnectedCallback(): void {
        this.auth?.destroy();
        this.auth = null;
    }

    attributeChangedCallback(): void {
        // Recreate the auth instance on attribute change
        this.auth?.destroy();
        this.auth = null;
    }

    // ── Public ──────────────────────────────────────────────────────

    async startVerification(): Promise<VerifyResult | undefined> {
        if (this.verifying) return undefined;
        this.verifying = true;

        try {
            const config = this.buildConfig();
            this.auth = new FivucsasAuth(config);

            const options = this.buildOptions();
            const result = await this.auth.verify(options);

            this.dispatchEvent(
                new CustomEvent('fivucsas-complete', { detail: result, bubbles: true, composed: true })
            );
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('cancelled')) {
                this.dispatchEvent(
                    new CustomEvent('fivucsas-cancel', { bubbles: true, composed: true })
                );
            } else {
                this.dispatchEvent(
                    new CustomEvent('fivucsas-error', {
                        detail: { message },
                        bubbles: true,
                        composed: true,
                    })
                );
            }
            return undefined;
        } finally {
            this.verifying = false;
        }
    }

    // ── Private ─────────────────────────────────────────────────────

    private render(): void {
        const style = document.createElement('style');
        style.textContent = ELEMENT_STYLES;

        const btn = document.createElement('button');
        btn.className = 'fivucsas-trigger-btn';

        // Build icon with safe DOM methods (no innerHTML)
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'currentColor');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute(
            'd',
            'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z'
        );
        icon.appendChild(path);

        const label = document.createElement('span');
        label.textContent = 'Verify with FIVUCSAS';

        btn.appendChild(icon);
        btn.appendChild(label);
        btn.addEventListener('click', () => this.startVerification());

        // Clear and populate shadow root using safe DOM methods
        while (this.shadow.firstChild) {
            this.shadow.removeChild(this.shadow.firstChild);
        }
        this.shadow.appendChild(style);
        this.shadow.appendChild(btn);
    }

    private buildConfig(): FivucsasConfig {
        const clientId = this.getAttribute('client-id') ?? '';
        if (!clientId) {
            throw new Error('<fivucsas-verify>: client-id attribute is required');
        }

        let theme: FivucsasTheme | undefined;
        const themeAttr = this.getAttribute('theme');
        if (themeAttr) {
            try {
                theme = JSON.parse(themeAttr) as FivucsasTheme;
            } catch {
                // Ignore invalid JSON
            }
        }

        return {
            clientId,
            baseUrl: this.getAttribute('base-url') ?? undefined,
            apiBaseUrl: this.getAttribute('api-base-url') ?? undefined,
            locale: (this.getAttribute('locale') as 'en' | 'tr') ?? undefined,
            theme,
        };
    }

    private buildOptions(): VerifyOptions {
        return {
            flow: this.getAttribute('flow') ?? undefined,
            userId: this.getAttribute('user-id') ?? undefined,
            onStepChange: (step) => {
                this.dispatchEvent(
                    new CustomEvent('fivucsas-step-change', {
                        detail: step,
                        bubbles: true,
                        composed: true,
                    })
                );
            },
            onError: (error) => {
                this.dispatchEvent(
                    new CustomEvent('fivucsas-error', {
                        detail: error,
                        bubbles: true,
                        composed: true,
                    })
                );
            },
            onCancel: () => {
                this.dispatchEvent(
                    new CustomEvent('fivucsas-cancel', { bubbles: true, composed: true })
                );
            },
        };
    }
}

customElements.define('fivucsas-verify', FivucsasVerifyElement);
