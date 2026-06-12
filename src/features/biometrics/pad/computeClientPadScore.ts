/**
 * computeClientPadScore — produce an ADVISORY live-confidence (Presentation
 * Attack Detection) score for a captured FACE frame, entirely in the browser
 * (SP-D, defense-in-depth).
 *
 * PRIMARY analyzer (SP-D Phase-1B): the **real MiniFASNet single-frame** model
 * (UniFace MiniFASNetV2 ONNX, ported in `MiniFasNetPadAnalyzer.ts`) — the
 * investigation's recommendation (measured AUC 0.945) over the light in-repo
 * detector (no published numbers + suppressed heuristics). It runs the model on
 * the captured crop and returns a 0..1 live-confidence.
 *
 * FALLBACK analyzer: the existing `PassiveLivenessDetector` from the biometric
 * engine (a 5-component passive scorer: texture / colour / skin-tone / moiré /
 * local-variance — pure canvas/ImageData maths, no model). Used ONLY when
 * MiniFASNet is unavailable (model not hosted yet / fetch / WebGPU / inference
 * failure). This is the lower-accuracy but always-available signal that keeps
 * the advisory chip populated while the MiniFASNet model rollout (Phase-2
 * hosting at app.fivucsas.com/models) is pending.
 *
 * UNTRUSTED-CLIENT CAVEAT: the returned score is ADVISORY ONLY. Callers MUST NOT
 * use it to block or allow a login — it is a display value + a defense-in-depth
 * signal forwarded to the (authoritative) server. See SP-D / D2.
 *
 * Resilient by design: returns `null` on ANY failure of BOTH analyzers (model
 * fetch/WebGPU/inference, analyzer unavailable, decode failure, degenerate crop,
 * exception) so the FACE capture proceeds normally and a login is NEVER blocked
 * by a missing/failed PAD score.
 *
 * @see MiniFasNetPadAnalyzer.ts (primary, real MiniFASNet single-frame)
 * @see lib/biometric-engine/core/PassiveLivenessDetector.ts (fallback, light)
 */

import { dataURLToImageData } from '@features/auth/utils/faceCropper'
import { BiometricEngine } from '@/lib/biometric-engine/core/BiometricEngine'
import { MiniFasNetPadAnalyzer } from './MiniFasNetPadAnalyzer'

/**
 * Advisory PAD result for a single captured frame.
 *
 * `score` is a 0..1 live-confidence (1 = most live-like). `source` records which
 * analyzer produced it (`'minifasnet'` = the real model, `'passive'` = the light
 * fallback). `breakdown` carries the light analyzer's per-component 0..1 detail
 * when the fallback ran; it is absent for the MiniFASNet path (the model emits a
 * single real/spoof probability, no per-heuristic components).
 */
export interface ClientPadScore {
    /** Live-confidence in [0, 1]. Higher = more live-like. ADVISORY ONLY. */
    score: number
    /** Which analyzer produced the score. */
    source: 'minifasnet' | 'passive'
    /** Per-component live-confidence sub-scores (light fallback only), each in [0, 1]. */
    breakdown?: {
        texture: number
        color: number
        skinTone: number
        moire: number
        localVariance: number
    }
}

/**
 * Process-wide singleton MiniFASNet analyzer so the ONNX session is created
 * once and reused across captures (warmup cost paid only on the first capture
 * after the advisory flag turns on).
 */
let miniFasNet: MiniFasNetPadAnalyzer | null = null
function getMiniFasNet(): MiniFasNetPadAnalyzer {
    if (!miniFasNet) miniFasNet = new MiniFasNetPadAnalyzer()
    return miniFasNet
}

/** Clamp a 0..100 detector value into a 0..1 confidence, rounded to 4 dp. */
function to01(value0to100: number): number {
    const clamped = Math.min(100, Math.max(0, value0to100))
    return Math.round((clamped / 100) * 1e4) / 1e4
}

/**
 * Run the light `PassiveLivenessDetector` fallback. Returns a {@link ClientPadScore}
 * (with `breakdown`) or `null` when the detector is unavailable / fails.
 */
function computeWithLightDetector(imageData: ImageData): ClientPadScore | null {
    try {
        const detector = BiometricEngine.getInstance().livenessDetector
        if (!detector || !detector.isAvailable()) return null
        const result = detector.check(imageData)
        return {
            score: to01(result.score),
            source: 'passive',
            breakdown: {
                texture: to01(result.breakdown.texture),
                color: to01(result.breakdown.color),
                skinTone: to01(result.breakdown.skinTone),
                moire: to01(result.breakdown.moire),
                localVariance: to01(result.breakdown.localVariance),
            },
        }
    } catch {
        return null
    }
}

/**
 * Compute the advisory client-side PAD score for a captured FACE data-URL.
 *
 * Tries the **real MiniFASNet** model first; on ANY MiniFASNet failure falls
 * back to the **light passive detector**; returns `null` if both are
 * unavailable. NEVER throws — the FACE capture is never blocked by a PAD-score
 * failure.
 *
 * @param imageDataUrl Cropped face JPEG data-URL (as the legacy FACE path uploads).
 * @returns A {@link ClientPadScore}, or `null` on any failure.
 */
export async function computeClientPadScore(
    imageDataUrl: string,
): Promise<ClientPadScore | null> {
    try {
        const imageData = await dataURLToImageData(imageDataUrl)
        if (!imageData || imageData.width <= 2 || imageData.height <= 2) return null

        // PRIMARY: real MiniFASNet single-frame analyzer. `scoreFace` is
        // designed to return null (never throw) on model-fetch/WebGPU/inference
        // failure; the extra try/catch is belt-and-suspenders so that even an
        // unexpected throw degrades to the light fallback rather than to null.
        let miniScore: number | null = null
        try {
            miniScore = await getMiniFasNet().scoreFace(imageData)
        } catch {
            miniScore = null
        }
        if (miniScore !== null) {
            return { score: miniScore, source: 'minifasnet' }
        }

        // FALLBACK: light passive detector (kept). Lower accuracy, always
        // available (pure ImageData maths) while MiniFASNet hosting is pending.
        return computeWithLightDetector(imageData)
    } catch {
        // Resilient: never block the FACE capture on a PAD-score failure.
        return null
    }
}
