/**
 * Vite library build for the `@fivucsas/auth-js` npm package.
 *
 * Builds the self-contained, zero-dependency vanilla SDK from the canonical
 * source at `src/verify-app/sdk/core.ts` into ESM + CJS bundles under
 * `packages/auth-js/dist/`. TypeScript declarations are emitted separately by
 * `tsconfig.package.json` (see `npm run build:pkg:auth-js`).
 *
 * Output:
 *   packages/auth-js/dist/index.mjs   (ESM)
 *   packages/auth-js/dist/index.cjs   (CommonJS)
 *   + .map sourcemaps
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Do NOT copy the app's public/ assets into the package tarball.
    publicDir: false,
    build: {
        lib: {
            entry: resolve(__dirname, 'src/verify-app/sdk/core.ts'),
            formats: ['es', 'cjs'],
            fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
        },
        outDir: resolve(__dirname, 'packages/auth-js/dist'),
        emptyOutDir: true,
        target: 'es2020',
        minify: false,
        sourcemap: true,
        rollupOptions: {
            // Zero runtime dependencies — nothing should be externalised.
            external: [],
        },
    },
});
