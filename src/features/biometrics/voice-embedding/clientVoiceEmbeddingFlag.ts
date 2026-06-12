/**
 * clientVoiceEmbeddingFlag — client gate for the GPU-less "upload the speaker
 * embedding, not the audio" VOICE login path (audit H3).
 *
 * Mirrors the server flag `app.auth.client-side-voice-embedding`. Default OFF:
 * when off, the VOICE submit uploads the recorded audio exactly as it always has
 * (byte-identical legacy behaviour). When on, the browser computes the 256-d
 * Resemblyzer speaker embedding locally and uploads only the vector — the raw
 * audio never leaves the device.
 *
 * Build-time env flag ONLY (`VITE_CLIENT_SIDE_VOICE_EMBEDDING`), baked at build
 * time; it is not driven from login-config (a future per-tenant item).
 *
 * Read via a function (not a module-load constant) so the value is injectable /
 * mockable in tests and is evaluated at call time rather than frozen at import.
 *
 * ⚠️ SCAFFOLD CAVEAT: the browser audio preprocessing (Resemblyzer
 * `preprocess_wav` WebRTC-VAD silence trim + librosa power-mel) is NOT yet
 * validated to parity with the server. Keep this OFF until the mel + VAD are
 * validated — see biometric-processor `docs/design/VOICE_CLIENT_EMBEDDING_SPEC.md`.
 */

/**
 * True when the client-side-voice-embedding path is enabled for this build.
 * Controlled by `VITE_CLIENT_SIDE_VOICE_EMBEDDING` (string `'true'` to enable).
 */
export function isClientSideVoiceEmbeddingEnabled(): boolean {
    return import.meta.env.VITE_CLIENT_SIDE_VOICE_EMBEDDING === 'true'
}
