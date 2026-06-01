import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Content Security Policy Plugin
 * SECURITY: Implements CSP headers to prevent XSS and other injection attacks
 *
 * OWASP Security Best Practices:
 * - Restricts resource loading to trusted sources
 * - Prevents inline script execution (XSS mitigation)
 * - Blocks unsafe-eval and unsafe-inline
 * - Enforces HTTPS for external resources
 *
 * NOTE (FE-H3, P3-FE-5 2026-05-04): the dev CSP below is permissive by design
 * ('unsafe-inline' + 'unsafe-eval') so Vite HMR + hot-reloaded ONNX/TFJS
 * modules work out of the box. Production CSP in public/.htaccess used to be
 * strict on dashboard routes and relaxed on /verify*, /enroll*, /biometric*,
 * but React Router does NOT reload index.html between client-side
 * navigations, so any user landing on `/` first could never load biometric
 * WASM (CSP comes from the initial response). The default route was
 * therefore unified with the biometric-permissive variant — only `/login`
 * still differs (frame-ancestors 'none' for clickjacking defense).
 * Keep the two configs in sync when a new CDN origin is added.
 */
function cspPlugin(): Plugin {
    return {
        name: 'csp-plugin',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // SECURITY: Content Security Policy headers
                // These headers prevent XSS, clickjacking, and other injection attacks.
                //
                // Per-route frame-ancestors (B9) — mirrors public/.htaccess production rule:
                //   - /login (hosted OIDC sign-in page): frame-ancestors 'none' (clickjacking defense)
                //   - All other routes (widget / dashboard): allow *.fivucsas.com embed
                const isHostedLogin = (req.url ?? '').split('?')[0].startsWith('/login')
                const frameAncestors = isHostedLogin
                    ? "frame-ancestors 'none'"
                    : "frame-ancestors 'self' https://*.fivucsas.com"

                res.setHeader(
                    'Content-Security-Policy',
                    [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-inline/eval needed for dev HMR
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: https:",
                        "connect-src 'self' http://localhost:8080 http://116.203.222.213:8080 ws://localhost:*",
                        frameAncestors,
                        "base-uri 'self'",
                        "form-action 'self'",
                    ].join('; ')
                )

                // SECURITY: Additional security headers
                res.setHeader('X-Content-Type-Options', 'nosniff')
                // X-Frame-Options removed: CSP frame-ancestors supersedes it
                res.setHeader('X-XSS-Protection', '1; mode=block')
                res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
                res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

                next()
            })
        },
        transformIndexHtml(html, ctx) {
            // SECURITY: Production CSP is strict (no unsafe-inline/eval)
            // Development CSP allows unsafe-inline/eval for HMR
            const isProduction = ctx.server === undefined
            const scriptSrc = isProduction
                ? "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
            // Sec-P0b 2026-04-29: bio.fivucsas.com removed from connect-src.
            // The browser must never reach the biometric processor directly;
            // identity-core-api proxies all biometric calls.
            // P3-FE-6 2026-05-04: tfhub.dev dropped — it was an allowlist
            // entry for TFJS Hub model loading from when MobileFaceNet was
            // shipped in-browser, but MobileFaceNet was deliberately stripped
            // (Phase L 2026-04-18) and the FaceDetector now CDN-loads
            // MediaPipe via cdn.jsdelivr.net + storage.googleapis.com.
            const connectSrc = isProduction
                ? "connect-src 'self' https://api.fivucsas.com https://cdn.jsdelivr.net https://storage.googleapis.com https://api.qrserver.com"
                : "connect-src 'self' http://localhost:8080 http://116.203.222.213:8080 ws://localhost:*"

            // Note: frame-ancestors is NOT included in meta tag because browsers ignore it there
            // frame-ancestors MUST be sent via HTTP header (configured in .htaccess for production)
            const mediaSrc = "media-src 'self' blob:"
            const workerSrc = "worker-src 'self' blob:"

            return html.replace(
                '<head>',
                `<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; ${connectSrc}; ${mediaSrc}; ${workerSrc}; base-uri 'self'; form-action 'self';">`
            )
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        cspPlugin(), // SECURITY: Add CSP headers
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
            manifest: {
                name: 'FIVUCSAS — Kimlik Doğrulama Platformu',
                short_name: 'FIVUCSAS',
                description: 'Biyometrik kimlik doğrulama ve yüz tanıma platformu',
                theme_color: '#1976d2',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: '/',
                icons: [
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                // ---------------------------------------------------------------
                // PWA APP-SHELL STRATEGY — NETWORK-FIRST NAVIGATIONS (2026-06-01)
                // ---------------------------------------------------------------
                // PROBLEM (the bug this fixes): index.html is precached, and the
                // old `navigateFallback: '/index.html'` registered a NavigationRoute
                // that served that PRECACHED shell CACHE-FIRST for every navigation.
                // Result: a fresh deploy (new index.html → new hashed JS/CSS) never
                // reached users until they hard-cleared the cache, because the SW
                // kept handing back the stale precached shell.
                //
                // FIX: route navigation requests (the HTML document / app shell)
                // through a NETWORK-FIRST handler below, instead of the cache-first
                // navigateFallback. Online users always get the freshest index.html
                // (which references the newest hashed chunks); offline users fall
                // back to the precached shell via `precacheFallback`. `navigateFallback`
                // is intentionally REMOVED — the navigation runtimeCaching route
                // supersedes it. Hashed JS/CSS/font assets stay PRECACHED and are
                // served cache-first by the precache route (fast + offline-capable
                // + immutable), so chunk loading is unaffected.
                //
                // generateSW-VALID: workbox-build's runtime-caching-converter
                // accepts a function `urlPattern` (RouteMatchCallback) and emits it
                // verbatim into sw.js via `registerRoute(<fn>, NetworkFirst, 'GET')`
                // — confirmed against workbox-build 7.4.0 / vite-plugin-pwa 1.2.0.
                //
                // Discard precache entries from prior builds when the new worker
                // activates, preventing "old chunk 404" tombstones.
                cleanupOutdatedCaches: true,
                // registerType:'autoUpdate' already implies these, but set them
                // explicitly so the new SW always skips the waiting phase and
                // claims open clients immediately (prompt activation of the
                // network-first shell, no manual reload prompt).
                skipWaiting: true,
                clientsClaim: true,
                runtimeCaching: [
                    {
                        // APP SHELL — every navigation (HTML document) request.
                        // `request.mode === 'navigate'` is the canonical, generateSW-
                        // supported way to target navigations without navigateFallback.
                        urlPattern: ({request}: {request: Request}) => request.mode === 'navigate',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'app-shell',
                            // Short timeout: if the network doesn't respond in ~3s
                            // (flaky/offline), fall back to cache so the app still
                            // boots — but online users virtually always hit network.
                            networkTimeoutSeconds: 3,
                            // Offline / cache-miss safety net: serve the precached
                            // index.html when both network AND the app-shell runtime
                            // cache miss (e.g. first offline visit to a deep route).
                            precacheFallback: {
                                fallbackURL: '/index.html'
                            }
                        }
                    },
                    {
                        // Backend API — unchanged NetworkFirst rule.
                        urlPattern: /^https:\/\/api\.fivucsas\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            networkTimeoutSeconds: 10
                        }
                    }
                ]
            }
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@pages': path.resolve(__dirname, './src/pages'),
            '@services': path.resolve(__dirname, './src/services'),
            '@store': path.resolve(__dirname, './src/store'),
            '@utils': path.resolve(__dirname, './src/utils'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@types': path.resolve(__dirname, './src/types'),
            '@core': path.resolve(__dirname, './src/core'),
            '@domain': path.resolve(__dirname, './src/domain'),
            '@features': path.resolve(__dirname, './src/features'),
            '@shared': path.resolve(__dirname, './src/shared'),
            '@app': path.resolve(__dirname, './src/app'),
            '@config': path.resolve(__dirname, './src/config'),
            '@test': path.resolve(__dirname, './src/test'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        minify: 'oxc',
        // SECURITY: Disable sourcemaps in production to prevent source code exposure
        sourcemap: false,
        // Show compressed sizes in build output for bundle analysis
        reportCompressedSize: mode === 'analyze',
        chunkSizeWarningLimit: 500,
        rollupOptions: {
            external: ['@tensorflow/tfjs-converter'],
            output: {
                minify: mode === 'production'
                    ? { compress: { dropConsole: true } }
                    : undefined,
                manualChunks(id: string) {
                    if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router-dom')) {
                        return 'react-vendor';
                    }
                    // E2 (2026-04-26): split former 555 KB mui-vendor into
                    // mui-icons (pictograms tree-shaken across all pages)
                    // and mui-core (Button/Box/Typography/Card/etc. loaded
                    // everywhere). Splitting lets the browser cache and
                    // parse them in parallel. No @mui/x-* deps as of
                    // 2026-04-26, but the rule below stays so any future
                    // DataGrid / DatePickers addition lands in its own
                    // form-pages-only chunk automatically.
                    if (id.includes('node_modules/@mui/icons-material')) {
                        return 'mui-icons';
                    }
                    if (id.includes('node_modules/@mui/material')) {
                        return 'mui-core';
                    }
                    // E2: split @mui/x-* (DataGrid, DatePickers) into its
                    // own chunk when added — only form pages need it.
                    if (id.includes('node_modules/@mui/x-')) {
                        return 'mui-data';
                    }
                    // E1 / FE-M3: Recharts + d3 live in their own chunk
                    // so dashboard routes don't pay the 395 KB cost until
                    // an analytics page is actually opened. AnalyticsPage
                    // and VerificationDashboardPage are already React.lazy'd
                    // at the route level in src/App.tsx, so this chunk is
                    // off the critical path for /, /users, /tenants, etc.
                    if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
                        return 'recharts-vendor';
                    }
                    // FE-M3: onnxruntime-web (~520 KB) only loads on
                    // /verify, /enroll, /biometric — isolate its chunk so
                    // the dashboard bundle doesn't carry it.
                    if (id.includes('node_modules/onnxruntime-web')) {
                        return 'onnx-vendor';
                    }
                    // Perf USER-BUG-7 (2026-05-01): @mediapipe/tasks-vision is
                    // only loaded by the face-capture / liveness flows. The
                    // primary FaceDetector loads MediaPipe via the CDN at
                    // runtime, but useFaceDetection.ts also imports the
                    // npm package as a fallback when BlazeFace fails.
                    // Isolating the chunk keeps it off the login critical
                    // path (saved-cost: ~100 KB gzipped from main bundle).
                    if (id.includes('node_modules/@mediapipe/tasks-vision')) {
                        return 'mediapipe-vendor';
                    }
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        exclude: ['e2e/**', 'node_modules/**', '.claude/**', 'archive/**'],
        env: {
            // Provide a stub for the boot-time guard in src/config/env.ts so tests
            // can import modules that transitively read import.meta.env.VITE_API_BASE_URL
            // without each test having to set the env var. Real prod/dev still requires it.
            VITE_API_BASE_URL: 'http://localhost:8080/api/v1',
        },
    },
}))
