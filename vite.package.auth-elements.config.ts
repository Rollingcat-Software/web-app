/**
 * Vite library build for the `@fivucsas/auth-elements` npm package.
 *
 * Builds the `<fivucsas-verify>` custom element from the canonical source at
 * `src/verify-app/sdk/elements.ts` into ESM + CJS bundles (for bundler/ESM
 * consumers) plus an IIFE bundle (for plain `<script>` tags) under
 * `packages/auth-elements/dist/`. Self-contained, zero runtime dependencies.
 *
 * Output:
 *   packages/auth-elements/dist/index.mjs      (ESM)
 *   packages/auth-elements/dist/index.cjs      (CommonJS)
 *   packages/auth-elements/dist/index.global.js (IIFE / <script>)
 *   + .map sourcemaps
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Do NOT copy the app's public/ assets into the package tarball.
    publicDir: false,
    build: {
        lib: {
            entry: resolve(__dirname, 'src/verify-app/sdk/elements.ts'),
            name: 'FivucsasElements',
            formats: ['es', 'cjs', 'iife'],
            fileName: (format) => {
                if (format === 'es') return 'index.mjs';
                if (format === 'cjs') return 'index.cjs';
                return 'index.global.js';
            },
        },
        outDir: resolve(__dirname, 'packages/auth-elements/dist'),
        emptyOutDir: true,
        target: 'es2020',
        minify: false,
        sourcemap: true,
        rollupOptions: {
            external: [],
        },
    },
});
