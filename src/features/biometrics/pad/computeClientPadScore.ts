/**
 * computeClientPadScore — run the in-repo passive PAD (Presentation Attack
 * Detection) analyzer on a captured FACE frame to produce an ADVISORY
 * live-confidence score, entirely in the browser (SP-D, defense-in-depth).
 *
 * The analyzer is the existing `PassiveLivenessDetector` from the biometric
 * engine: a 5-component passive scorer (texture / colour / skin-tone / moiré /
 * local-variance) — the same passive-analyzer family the amispoof browser tester
 * ships (Texture / Moire / etc.). It is pure canvas/ImageData maths: no model
 * download, no MediaPipe, no ONNX, so it is cheap enough to run on the single
 * captured frame at submit time.
 *
 * UNTRUSTED-CLIENT CAVEAT: the returned score is ADVISORY ONLY. Callers MUST NOT
 * use it to block or allow a login — it is a display value + a defense-in-depth
 * signal forwarded to the (authoritative) server. See SP-D / D2.
 *
 * Resilient by design: returns `null` on ANY failure (analyzer unavailable,
 * decode failure, degenerate crop, exception) so the FACE capture proceeds
 * normally and a login is NEVER blocked by a missing/failed PAD score.
 *
 * @see lib/biometric-engine/core/PassiveLivenessDetector.ts
 */

import { dataURLToImageData } from '@features/auth/utils/faceCropper'
import { BiometricEngine } from '@/lib/biometric-engine/core/BiometricEngine'

/**
 * Advisory PAD result for a single captured frame.
 *
 * `score` is a 0..1 live-confidence (1 = most live-like), normalised from the
 * detector's 0..100 internal scale so the wire/display value is a clean
 * probability-shaped number. `breakdown` carries the per-analyzer 0..1 detail
 * for optional display / server-side logging.
 */
export interface ClientPadScore {
    /** Live-confidence in [0, 1]. Higher = more live-like. ADVISORY ONLY. */
    score: number
    /** Per-component live-confidence sub-scores, each in [0, 1]. */
    breakdown: {
        texture: number
        color: number
        skinTone: number
        moire: number
        localVariance: number
    }
}

/** Clamp a 0..100 detector value into a 0..1 confidence, rounded to 4 dp. */
function to01(value0to100: number): number {
    const clamped = Math.min(100, Math.max(0, value0to100))
    return Math.round((clamped / 100) * 1e4) / 1e4
}

/**
 * Compute the advisory client-side PAD score for a captured FACE data-URL.
 *
 * @param imageDataUrl Cropped face JPEG data-URL (as the legacy FACE path uploads).
 * @returns A {@link ClientPadScore} (score + per-component breakdown), or `null`
 *          on any failure. NEVER throws.
 */
export async function computeClientPadScore(
    imageDataUrl: string,
): Promise<ClientPadScore | null> {
    try {
        const detector = BiometricEngine.getInstance().livenessDetector
        if (!detector || !detector.isAvailable()) return null

        const imageData = await dataURLToImageData(imageDataUrl)
        if (!imageData || imageData.width <= 2 || imageData.height <= 2) return null

        const result = detector.check(imageData)
        return {
            score: to01(result.score),
            breakdown: {
                texture: to01(result.breakdown.texture),
                color: to01(result.breakdown.color),
                skinTone: to01(result.breakdown.skinTone),
                moire: to01(result.breakdown.moire),
                localVariance: to01(result.breakdown.localVariance),
            },
        }
    } catch {
        // Resilient: never block the FACE capture on a PAD-score failure.
        return null
    }
}
