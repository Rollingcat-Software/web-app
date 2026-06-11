/**
 * embedCapturedFace — turn a captured FACE data-URL into a 512-d Facenet512
 * embedding entirely in the browser, so the raw image never leaves the device
 * (client-side Facenet512 sub-project, Phase 3).
 *
 * Input is the SAME cropped JPEG data-URL the legacy FACE path uploads (from
 * `cropFaceToDataURL` in `useFaceDetection`): a tight, mirror-corrected face
 * crop. We decode it to RGBA `ImageData` and hand it to `FacenetEmbedder.embed`,
 * which runs the production preprocess (aspect-fit 160×160, centre black-pad,
 * BGR, [0,1], NHWC) → Facenet512 ONNX (onnxruntime-web, WASM EP) → L2-normalize.
 *
 * Resilient by design: returns `null` on ANY failure (no model, ORT load error,
 * decode failure, inference error) so the FACE submit path can fall back to the
 * legacy image upload and never block a login.
 *
 * NOTE on alignment: the embedder's contract is "already-aligned RGBA crop in".
 * The production aligner (MediaPipe FaceLandmarker eye-landmark similarity
 * transform, applied BEFORE preprocess) is not yet wired here; the bbox crop is
 * used as-is. Self-consistency improves once explicit alignment lands — see the
 * Phase-0 spike report and `selfConsistency.test.ts`.
 */

import { dataURLToImageData } from '@features/auth/utils/faceCropper'
import { FacenetEmbedder, EMBEDDING_DIMENSION } from './facenetEmbedder'

/**
 * onnxruntime-web ships its runtime WASM (ort-wasm-*.wasm) separately from the
 * JS. Without `wasmPaths`, ORT resolves it against the current origin — and the
 * SPA rewrite returns index.html for any non-existent path, so the browser sees
 * HTML instead of WASM and dies. Point ORT at the pinned jsdelivr copy (the CSP
 * already allows cdn.jsdelivr.net in script-src + connect-src). Same approach as
 * `VoiceVAD`.
 */
const ORT_WASM_PATHS = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'

/**
 * Lazily-constructed singleton embedder. The ONNX session it owns is loaded once
 * (download-once SHA-verified model bytes via the cache) and reused across FACE
 * submits within a session.
 */
let embedder: FacenetEmbedder | null = null

async function getEmbedder(): Promise<FacenetEmbedder> {
    if (embedder) return embedder
    // Dynamic import keeps the ~5 MB WASM runtime out of the main bundle and
    // lets it code-split exactly like VoiceVAD / CardDetector.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — onnxruntime-web is loaded at runtime
    const ort = await import('onnxruntime-web')
    embedder = new FacenetEmbedder(ort as never, undefined, ORT_WASM_PATHS)
    return embedder
}

/**
 * Compute the client-side Facenet512 embedding for a captured FACE data-URL.
 *
 * @param imageDataUrl Cropped face JPEG data-URL (as the legacy path uploads).
 * @returns A 512-number embedding array, or `null` on any failure.
 */
export async function embedCapturedFace(imageDataUrl: string): Promise<number[] | null> {
    try {
        const imageData = await dataURLToImageData(imageDataUrl)
        if (!imageData) return null

        const instance = await getEmbedder()
        const vec = await instance.embed(imageData)
        if (!vec || vec.length !== EMBEDDING_DIMENSION) return null

        return Array.from(vec)
    } catch {
        // Resilient: never block the FACE login on a client-embedding failure.
        return null
    }
}
