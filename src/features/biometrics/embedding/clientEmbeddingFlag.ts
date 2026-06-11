/**
 * clientEmbeddingFlag — client gate for the "upload the embedding, not the image"
 * FACE login path (client-side Facenet512 sub-project, Phase 3).
 *
 * Mirrors the server flag name `app.auth.client-side-embedding`. Default OFF:
 * when off, the FACE capture submit uploads the cropped image exactly as it
 * always has (byte-identical legacy behaviour). When on, the browser computes
 * the 512-d embedding locally and uploads only the vector — the raw image never
 * leaves the device.
 *
 * This is a build-time env flag ONLY (`VITE_CLIENT_SIDE_EMBEDDING`), baked at
 * build time; it is not driven from login-config. Driving it per-tenant from
 * login-config is a future Phase-6 item and is NOT implemented yet.
 *
 * Read via a function (not a module-load constant) so the value is injectable /
 * mockable in tests and so it is evaluated at call time rather than frozen at
 * import.
 */

/**
 * True when the client-side-embedding FACE path is enabled for this build.
 * Controlled by `VITE_CLIENT_SIDE_EMBEDDING` (string `'true'` to enable).
 */
export function isClientSideEmbeddingEnabled(): boolean {
    return import.meta.env.VITE_CLIENT_SIDE_EMBEDDING === 'true'
}
