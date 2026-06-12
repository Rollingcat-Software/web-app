/**
 * embedCapturedVoice — turn a captured VOICE data-URL (16 kHz mono WAV) into a
 * 256-d Resemblyzer speaker embedding entirely in the browser, so the raw audio
 * never leaves the device (audit H3, GPU-less).
 *
 * Input is the SAME base64 WAV data-URL the legacy VOICE path uploads (from
 * `VoiceStep` → `useVoiceRecorder.wav16k`). We decode it to a Float32 PCM array,
 * apply the Resemblyzer volume normalization, build mel partials and run the
 * VoiceEncoder ONNX (onnxruntime-web, WASM EP) → mean of partial embeddings →
 * L2-normalize.
 *
 * Resilient by design: returns `null` on ANY failure (no/unhosted model, ORT
 * load error, non-WAV input, inference error) so the VOICE submit path can fall
 * back to the legacy audio upload and never block a login.
 *
 * ⚠️ SCAFFOLD: the model + inference are exact, but the JS preprocessing
 * (`voicePreprocess`) is not parity-validated against the server (no WebRTC-VAD
 * trim, librosa-approximate mel). Keep `VITE_CLIENT_SIDE_VOICE_EMBEDDING` OFF
 * until validated — see biometric-processor `docs/design/VOICE_CLIENT_EMBEDDING_SPEC.md`.
 */

import { SpeakerEmbedder, VOICE_EMBEDDING_DIMENSION } from './speakerEmbedder'
import { decodeWav16kDataUrl, normalizeVolumeIncreaseOnly } from './voicePreprocess'

/**
 * onnxruntime-web ships its runtime WASM separately from the JS. Without
 * `wasmPaths`, ORT resolves it against the current origin — and the SPA rewrite
 * returns index.html for any non-existent path, so the browser sees HTML instead
 * of WASM and dies. Point ORT at the pinned jsdelivr copy (CSP already allows
 * cdn.jsdelivr.net). Same approach as `embedCapturedFace` / `VoiceVAD`.
 */
const ORT_WASM_PATHS = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'

/** Lazily-constructed singleton embedder (loads the ONNX session once, reuses). */
let embedder: SpeakerEmbedder | null = null

async function getEmbedder(): Promise<SpeakerEmbedder> {
    if (embedder) return embedder
    // Dynamic import keeps the WASM runtime out of the main bundle (code-split
    // exactly like embedCapturedFace / VoiceVAD).
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — onnxruntime-web is loaded at runtime
    const ort = await import('onnxruntime-web')
    embedder = new SpeakerEmbedder(ort as never, undefined, ORT_WASM_PATHS)
    return embedder
}

/**
 * Compute the client-side Resemblyzer speaker embedding for a captured VOICE
 * data-URL (16 kHz mono WAV).
 *
 * @param voiceDataUrl base64 WAV data-URL (as the legacy path uploads).
 * @returns A 256-number embedding array, or `null` on any failure.
 */
export async function embedCapturedVoice(voiceDataUrl: string): Promise<number[] | null> {
    try {
        const wav = decodeWav16kDataUrl(voiceDataUrl)
        if (!wav || wav.length === 0) return null

        const normalized = normalizeVolumeIncreaseOnly(wav)

        const instance = await getEmbedder()
        const vec = await instance.embed(normalized)
        if (!vec || vec.length !== VOICE_EMBEDDING_DIMENSION) return null

        return Array.from(vec)
    } catch {
        // Resilient: never block the VOICE login on a client-embedding failure.
        return null
    }
}
