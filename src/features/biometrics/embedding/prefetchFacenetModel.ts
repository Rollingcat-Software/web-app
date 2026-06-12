/**
 * prefetchFacenetModel — warm the Facenet512 model cache BEFORE the FACE capture
 * step needs it, so by capture+submit time the ~47 MB model is already on the
 * device and the in-browser embedding is effectively instant.
 *
 * The download-once cache (`modelCache.getModel` → Cache API + IndexedDB, with
 * SHA256 re-verification on every read) means a successful prefetch makes the
 * later `embedCapturedFace` call a cache hit — no 47 MB download blocking the
 * submit (which on mobile looked like a frozen screen; see SP-A Phase-1).
 *
 * Resilient + side-effect-only by design:
 *   - It is a no-op unless the client-side-embedding flag is ON (mirrors the FACE
 *     submit path; with the flag OFF the legacy image upload is used and the model
 *     is never needed, so there is nothing to warm).
 *   - It NEVER throws and NEVER rejects to the caller (errors are swallowed). A
 *     failed prefetch is harmless — the real `embedCapturedFace` retries the
 *     download on submit, and the surface-level error handling (GPU-less
 *     enforcement) covers a genuine failure there.
 *   - It de-dupes: concurrent / repeated calls share the SAME in-flight promise,
 *     so mounting both the login surface and the FaceCaptureStep does not kick off
 *     two parallel 47 MB downloads.
 *
 * Call it fire-and-forget from a `requestIdleCallback` (fallback `setTimeout`) on
 * the login surfaces — see `scheduleFacenetPrefetch`.
 */

import { isClientSideEmbeddingEnabled } from './clientEmbeddingFlag'
import { DEFAULT_FACENET_MODEL_URL, DEFAULT_FACENET_MODEL_SHA256 } from './facenetEmbedder'
import { getModel } from './modelCache'

/** In-flight prefetch promise, so repeat/concurrent calls don't re-download. */
let inFlight: Promise<void> | null = null

/**
 * Warm the Facenet512 model cache (download-once + SHA256-verify) when the
 * client-side-embedding flag is ON. No-op when the flag is OFF. Never throws.
 *
 * @returns a promise that resolves when the warm-up settles (success OR a
 *          swallowed failure). Callers should fire-and-forget; the return value
 *          exists only for tests / explicit awaiting.
 */
export function prefetchFacenetModel(): Promise<void> {
    if (!isClientSideEmbeddingEnabled()) return Promise.resolve()
    if (inFlight) return inFlight

    inFlight = getModel(DEFAULT_FACENET_MODEL_URL, DEFAULT_FACENET_MODEL_SHA256)
        .then(() => undefined)
        .catch(() => {
            // Swallow: a failed prefetch is harmless — embedCapturedFace retries
            // the download on submit, and the GPU-less-enforcement path surfaces a
            // real failure there. Reset so a later attempt (e.g. a retry) can warm
            // the cache again.
            inFlight = null
        })

    return inFlight
}

/**
 * Schedule {@link prefetchFacenetModel} on the browser idle queue (falling back
 * to a short `setTimeout` where `requestIdleCallback` is unavailable, e.g. Safari
 * / jsdom). Returns a cleanup function that cancels the still-pending schedule —
 * wire it as a React effect cleanup so an unmount before idle does not fire a
 * stray download.
 *
 * The actual download work is in `prefetchFacenetModel` (flag-gated + de-duped),
 * so this is safe to call from every login surface's mount effect.
 */
export function scheduleFacenetPrefetch(): () => void {
    // No-op when the flag is OFF — avoid even scheduling idle work.
    if (!isClientSideEmbeddingEnabled()) return () => {}

    const win = window as Window & {
        requestIdleCallback?: (cb: () => void) => number
        cancelIdleCallback?: (handle: number) => void
    }

    if (typeof win.requestIdleCallback === 'function') {
        const handle = win.requestIdleCallback(() => {
            void prefetchFacenetModel()
        })
        return () => win.cancelIdleCallback?.(handle)
    }

    const timer = setTimeout(() => {
        void prefetchFacenetModel()
    }, 1)
    return () => clearTimeout(timer)
}
