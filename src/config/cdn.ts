/**
 * Centralized MediaPipe CDN URLs.
 *
 * Copilot post-merge round 8 (PR #60): `index.html` prefetches
 * @mediapipe/tasks-vision pinned to a specific version, but runtime
 * loaders (FaceDetector, HandGestureDetector, useFaceDetection,
 * useHandLandmarker) were still using `@latest`. When jsdelivr publishes
 * a new "latest" tag, the prefetched bundle and the runtime bundle no
 * longer match — the prefetch is wasted, the runtime pays a fresh fetch,
 * and the two builds may have subtly different ML behaviour.
 *
 * Pin everything here. Bump in lockstep with `package.json`'s
 * `@mediapipe/tasks-vision` version.
 */

/** Pinned MediaPipe Tasks Vision version. Must match package.json. */
export const MEDIAPIPE_VERSION = '0.10.18';

/**
 * Base URL for the MediaPipe Tasks Vision package on jsdelivr.
 * Used by both the dynamic-import path (vision_bundle.mjs) and the
 * FilesetResolver WASM lookup (`/wasm` subpath).
 */
export const MEDIAPIPE_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;

/** Full URL to the MediaPipe vision JS bundle (dynamic import). */
export const MEDIAPIPE_VISION_BUNDLE_URL = `${MEDIAPIPE_BASE}/vision_bundle.mjs`;

/** Base URL for the MediaPipe WASM fileset (FilesetResolver root). */
export const MEDIAPIPE_WASM_URL = `${MEDIAPIPE_BASE}/wasm`;
