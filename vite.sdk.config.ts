import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/verify-app/sdk/index.ts'),
            name: 'FivucsasAuth',
            formats: ['es', 'iife'],
            fileName: (format) =>
                format === 'es' ? 'fivucsas-auth.esm.js' : 'fivucsas-auth.js',
        },
        outDir: 'dist-sdk',
        emptyOutDir: true,
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: true,
        rollupOptions: {
            output: {
                // Ensure the IIFE exposes FivucsasAuth at the top level
                extend: true,
            },
        },
    },
});
