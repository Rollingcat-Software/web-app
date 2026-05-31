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

// Shared suite launcher — show ONLY on the public, non-authentication surfaces:
//   • the bare product landing (verify.fivucsas.com/, no widget context), and
//   • the integrator explainer (/login reached WITHOUT OAuth params).
// NEVER during active authentication (a real `/login?client_id=…` redirect or an
// embedded/session widget) — a cross-site app-switcher mid-login is a distraction
// and a trust/embedding smell. Injected dynamically (not a static <script> in
// index.html) precisely so it can be withheld from the auth surfaces.
const isActiveAuth = hasWidgetContext            // client_id / session_id / framed / flow / user_id
const showSuiteLauncher = (isHosted && !params.has('client_id')) || (!isHosted && !isActiveAuth)
if (showSuiteLauncher) {
    const s = document.createElement('script')
    s.src = 'https://app.fivucsas.com/launcher.js?v=2026-05-29'
    s.defer = true
    document.body.appendChild(s)
}

if (isHosted || hasWidgetContext) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            {isHosted ? <HostedLoginApp /> : <VerifyApp />}
        </React.StrictMode>
    )
    // Hide the static loading screen once React has painted (CSS rule
    // `#verify-root[data-mounted="true"] ~ #verify-loading { display:none }`).
    // rAF avoids a flash between loader-hidden and React's first paint. The
    // integrator landing is now React-rendered (HostedLoginApp) on a bare-root
    // visit, so on the /login + widget surfaces the static marketing landing
    // never paints — only the loader, then the form.
    requestAnimationFrame(() => {
        rootElement.setAttribute('data-mounted', 'true')
    })
} else {
    // Bare direct root visit → no React surface to mount. Reveal the static
    // integrator landing (no-JS/crawler fallback content) and hide the loading
    // spinner, which would otherwise spin forever. The marketing landing thus
    // appears ONLY here (the bare root), never during a /login navigation.
    const loading = document.getElementById('verify-loading')
    const landing = document.getElementById('verify-landing')
    if (loading) loading.style.display = 'none'
    if (landing) landing.style.display = 'flex'
}
