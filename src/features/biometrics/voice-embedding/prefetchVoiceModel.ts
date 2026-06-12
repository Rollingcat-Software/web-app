/**
 * prefetchVoiceModel — warm the Resemblyzer voice-encoder model cache BEFORE the
 * VOICE step needs it, so by submit time the model is already on the device and
 * the in-browser embedding is fast. Mirrors `prefetchFacenetModel`.
 *
 * Flag-gated (no-op unless `VITE_CLIENT_SIDE_VOICE_EMBEDDING` is ON), de-duped
 * (concurrent calls share the in-flight promise), and never throws — a failed
 * prefetch is harmless because `embedCapturedVoice` retries the download on
 * submit (and falls back to audio upload if even that fails).
 */

import { getModel } from '@features/biometrics/embedding/modelCache'
import { isClientSideVoiceEmbeddingEnabled } from './clientVoiceEmbeddingFlag'
import { DEFAULT_VOICE_MODEL_URL, DEFAULT_VOICE_MODEL_SHA256 } from './speakerEmbedder'

/** In-flight prefetch promise, so repeat/concurrent calls don't re-download. */
let inFlight: Promise<void> | null = null

/**
 * Warm the voice-encoder model cache (download-once + SHA256-verify) when the
 * flag is ON. No-op when OFF. Never throws.
 */
export function prefetchVoiceModel(): Promise<void> {
    if (!isClientSideVoiceEmbeddingEnabled()) return Promise.resolve()
    if (inFlight) return inFlight

    inFlight = getModel(DEFAULT_VOICE_MODEL_URL, DEFAULT_VOICE_MODEL_SHA256)
        .then(() => undefined)
        .catch(() => {
            // Swallow: a failed prefetch is harmless — embedCapturedVoice retries
            // on submit. Reset so a later attempt can warm the cache again.
            inFlight = null
        })

    return inFlight
}

/**
 * Schedule {@link prefetchVoiceModel} on the browser idle queue (falling back to
 * a short `setTimeout` where `requestIdleCallback` is unavailable). Returns a
 * cleanup function that cancels a still-pending schedule — wire it as a React
 * effect cleanup so an unmount before idle does not fire a stray download.
 */
export function scheduleVoiceModelPrefetch(): () => void {
    if (!isClientSideVoiceEmbeddingEnabled()) return () => {}

    const win = window as Window & {
        requestIdleCallback?: (cb: () => void) => number
        cancelIdleCallback?: (handle: number) => void
    }

    if (typeof win.requestIdleCallback === 'function') {
        const handle = win.requestIdleCallback(() => {
            void prefetchVoiceModel()
        })
        return () => win.cancelIdleCallback?.(handle)
    }

    const timer = setTimeout(() => {
        void prefetchVoiceModel()
    }, 1)
    return () => clearTimeout(timer)
}
