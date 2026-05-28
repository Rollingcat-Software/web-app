/**
 * Verify App Entry Point
 *
 * Standalone React app for embeddable auth verification.
 * Loaded in an iframe or WebView by third-party integrators.
 *
 * URL Parameters:
 *   - client_id:     Client application identifier
 *   - session_id:    Auth session ID to verify (required)
 *   - flow:          Auth flow name (e.g., 'login', 'step-up')
 *   - theme:         'light' | 'dark' (default: 'light')
 *   - locale:        'en' | 'tr' (default: 'en')
 *   - user_id:       User ID for the session
 *   - api_base_url:  Override API base URL
 *
 * Example:
 *   /verify/?session_id=abc123&theme=dark&locale=tr
 *
 * @see docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md
 */

import 'reflect-metadata'
import '../i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import VerifyApp from './VerifyApp'
import HostedLoginApp from './HostedLoginApp'

const rootElement = document.getElementById('verify-root')
if (!rootElement) {
    throw new Error(
        'Verify root element not found. Ensure index.html contains <div id="verify-root"></div>'
    )
}

// Hosted-first routing: top-level /login renders the full-page OIDC surface;
// a framed or parameterised widget renders VerifyApp.
const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isFramed = window.top !== window.self
const isHosted = !isFramed && (path === '/login' || path.endsWith('/login'))

// A bare, top-level visit to the root (no widget context) must NOT mount
// VerifyApp: with no session/client params it renders a "missing parameters"
// error — which is what a direct visitor to verify.fivucsas.com would see.
// In that case we leave the static landing (#verify-landing in index.html)
// visible by NOT flipping data-mounted. React is only mounted when there is a
// real surface to render: the hosted /login, an embedded (framed) widget, or a
// widget invoked with the parameters it needs.
const params = new URLSearchParams(window.location.search)
const hasWidgetContext =
    isFramed ||
    params.has('session_id') ||
    params.has('client_id') ||
    params.has('flow') ||
    params.has('user_id')

if (isHosted || hasWidgetContext) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            {isHosted ? <HostedLoginApp /> : <VerifyApp />}
        </React.StrictMode>
    )
    // Hide the static landing once React has painted (CSS rule
    // `#verify-root[data-mounted="true"] ~ #verify-landing { display:none }`).
    // rAF avoids a flash between landing-hidden and React's first paint.
    requestAnimationFrame(() => {
        rootElement.setAttribute('data-mounted', 'true')
    })
}
// else: bare direct root visit → leave #verify-landing showing; nothing to mount.
