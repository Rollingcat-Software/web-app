/**
 * Head-turn geometry helper.
 *
 * HISTORY (2026-06-01): this file used to host a self-contained
 * `useLivenessPuzzle` hook with its OWN divergent gesture detectors —
 * a non-canonical 2-point EAR blink (`<0.18`), a smile metric based on a raw
 * `mouthWidth/mouthHeight > 2.8` ratio, an open-mouth `>0.08` test, etc. None
 * of those matched the canonical engine detectors (FaceMetricsCalculator EAR +
 * the close→re-open BlinkTransitionTracker, SMILE corner-raise+width, MAR open
 * mouth), and the hook itself was DEAD — no component ever called `startPuzzle`
 * or `setLandmarker`. It has been removed to leave ONE correct gesture
 * implementation in the codebase (the biometric-engine detectors).
 *
 * The only live consumer of this module is `useBankEnrollment`, which imports
 * `detectHeadTurn` — a simple nose-vs-face-contour geometry helper (NOT one of
 * the divergent EAR/smile detectors), so it is retained here.
 */

interface Landmark {
    x: number
    y: number
    z?: number
}

/**
 * Detect horizontal head turn from nose offset relative to the face contour.
 *
 * Uses landmark 1 (nose tip) vs 234/454 (left/right face contour). Returns a
 * normalized offset and a coarse direction. This is a head-pose geometry helper,
 * not a facial-action (blink/smile) detector, so it is independent of the
 * canonical EAR/MAR thresholds.
 */
export function detectHeadTurn(landmarks: Landmark[]): { direction: 'left' | 'right' | 'center'; offset: number } {
    const noseX = landmarks[1].x
    const leftRef = landmarks[234].x
    const rightRef = landmarks[454].x
    const faceCenter = (leftRef + rightRef) / 2
    const faceWidth = Math.abs(rightRef - leftRef)
    const offset = (noseX - faceCenter) / (faceWidth || 0.001)
    if (offset > 0.12) return { direction: 'left', offset }
    if (offset < -0.12) return { direction: 'right', offset }
    return { direction: 'center', offset }
}
