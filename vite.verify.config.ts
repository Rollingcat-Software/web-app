/**
 * Vite build configuration for the Verify App (embeddable auth widget).
 *
 * Produces: dist-verify/
 *   - index.html (minimal HTML shell)
 *   - assets/    (JS + CSS chunks)
 *
 * This is a separate entry point that only includes auth step components,
 * not the full admin dashboard. The output is designed to be loaded in an
 * iframe or WebView.
 *
 * Usage:
 *   npx vite build --config vite.verify.config.ts
 *   npx vite dev --config vite.verify.config.ts
 *
 * @see docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    root: path.resolve(__dirname, 'src/verify-app'),
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
        port: 3001,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: path.resolve(__dirname, 'dist-verify'),
        emptyOutDir: true,
        sourcemap: false,
        chunkSizeWarningLimit: 400,
        rollupOptions: {
            external: ['@tensorflow/tfjs-converter'],
            output: {
                manualChunks(id: string) {
                    if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
                        return 'react-vendor';
                    }
                    if (id.includes('node_modules/@mui/material') || id.includes('node_modules/@mui/icons-material')) {
                        return 'mui-vendor';
                    }
                },
            },
        },
    },
})
