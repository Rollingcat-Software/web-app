/**
 * Vite build configuration for FIVUCSAS Web Components.
 *
 * Produces: dist-elements/
 *   - fivucsas-elements.js   (UMD — for <script src="..."> usage)
 *   - fivucsas-elements.mjs  (ESM — for import / bundler usage)
 *
 * The output is a self-contained, vanilla TypeScript bundle with NO React
 * dependency. Elements wrap the verify-app in an iframe via Shadow DOM.
 *
 * Usage (script tag):
 *   <script src="https://verify.fivucsas.com/elements/fivucsas-elements.js"></script>
 *
 * Usage (ESM bundler):
 *   import { registerFivucsasElements } from '@fivucsas/elements';
 *
 * @see src/elements/index.ts
 * @see docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/elements/index.ts'),
            name: 'FivucsasElements',
            formats: ['es', 'umd'],
            fileName: (format) =>
                format === 'es' ? 'fivucsas-elements.mjs' : 'fivucsas-elements.js',
        },
        outDir: 'dist-elements',
        emptyOutDir: true,
        target: 'es2020',
        minify: 'oxc',
        sourcemap: true,
        // No externals — produce a fully self-contained bundle so it works
        // with a plain <script> tag without any module loader.
        rollupOptions: {
            external: [],
            output: {
                // Ensure UMD global is accessible as window.FivucsasElements
                extend: false,
            },
        },
    },
});
