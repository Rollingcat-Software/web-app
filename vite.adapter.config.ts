/**
 * Vite build configuration for the Auth-Test IIFE adapter bundle.
 *
 * Produces: dist-adapter/biometric-engine.iife.js
 *
 * This bundles the biometric engine core (no React hooks) into a single
 * IIFE file that sets window.FIVUCSAS for consumption by auth-test/app.js.
 *
 * Dynamic CDN imports (MediaPipe, ONNX Runtime) are preserved as-is —
 * they remain runtime imports, not bundled. Vite's @vite-ignore comments
 * in FaceDetector.ts handle this correctly.
 *
 * Usage: npm run build:adapter
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 10
 */
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib/biometric-engine/adapter/auth-test-adapter.ts'),
      name: 'FIVUCSAS',
      formats: ['iife'],
      fileName: () => 'biometric-engine.iife.js',
    },
    outDir: 'dist-adapter',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
      // onnxruntime-web is loaded via dynamic import() in EmbeddingComputer.
      // Mark it as external so Rollup doesn't try to resolve it at build time.
      // At runtime, the auth-test page loads ort.min.js via <script> tag.
      external: ['onnxruntime-web'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
