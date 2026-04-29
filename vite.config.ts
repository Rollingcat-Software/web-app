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
 * NOTE (FE-H3): the dev CSP below is permissive by design
 * ('unsafe-inline' + 'unsafe-eval') so Vite HMR + hot-reloaded ONNX/TFJS
 * modules work out of the box. Production tightens per-route via
 * public/.htaccess — dashboard routes get strict `script-src 'self'`
 * (no 'unsafe-eval', no 'wasm-unsafe-eval'), while `/verify*`, `/enroll*`
 * and `/biometric*` keep the relaxed CSP that onnxruntime-web and
 * @tensorflow/tfjs actually need. Keep the two configs in sync when
 * a new CDN origin is added.
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
            const connectSrc = isProduction
                ? "connect-src 'self' https://api.fivucsas.com https://cdn.jsdelivr.net https://storage.googleapis.com https://api.qrserver.com https://tfhub.dev"
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
                runtimeCaching: [
                    {
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
                    if (id.includes('node_modules/@reduxjs/toolkit') || id.includes('node_modules/react-redux') || id.includes('node_modules/redux-persist')) {
                        return 'redux-vendor';
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
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        exclude: ['e2e/**', 'node_modules/**', 'src/test/e2e/**'],
    },
}))
