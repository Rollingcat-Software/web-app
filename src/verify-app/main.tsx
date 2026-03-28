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

const rootElement = document.getElementById('verify-root')
if (!rootElement) {
    throw new Error(
        'Verify root element not found. Ensure index.html contains <div id="verify-root"></div>'
    )
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <VerifyApp />
    </React.StrictMode>
)
