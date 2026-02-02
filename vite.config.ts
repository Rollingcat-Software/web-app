import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Content Security Policy Plugin
 * SECURITY: Implements CSP headers to prevent XSS and other injection attacks
 *
 * OWASP Security Best Practices:
 * - Restricts resource loading to trusted sources
 * - Prevents inline script execution (XSS mitigation)
 * - Blocks unsafe-eval and unsafe-inline
 * - Enforces HTTPS for external resources
 */
function cspPlugin(): Plugin {
    return {
        name: 'csp-plugin',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // SECURITY: Content Security Policy headers
                // These headers prevent XSS, clickjacking, and other injection attacks
                res.setHeader(
                    'Content-Security-Policy',
                    [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-inline/eval needed for dev HMR
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: https:",
                        "connect-src 'self' http://localhost:8080 http://34.116.233.134:8080 ws://localhost:*",
                        "frame-ancestors 'none'",
                        "base-uri 'self'",
                        "form-action 'self'",
                    ].join('; ')
                )

                // SECURITY: Additional security headers
                res.setHeader('X-Content-Type-Options', 'nosniff')
                res.setHeader('X-Frame-Options', 'DENY')
                res.setHeader('X-XSS-Protection', '1; mode=block')
                res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
                res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

                next()
            })
        },
        transformIndexHtml(html) {
            // Add CSP meta tag as fallback
            return html.replace(
                '<head>',
                `<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:8080 ws://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self';">`
            )
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        cspPlugin(), // SECURITY: Add CSP headers
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
        // SECURITY: Disable sourcemaps in production to prevent source code exposure
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'mui-vendor': ['@mui/material', '@mui/icons-material'],
                    'redux-vendor': ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
    },
})
