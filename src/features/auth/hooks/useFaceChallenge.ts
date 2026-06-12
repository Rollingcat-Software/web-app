import { useState, useCallback, useRef } from 'react'
import { FaceDetectionState } from './useFaceDetection'
import { BiometricEngine } from '../../../lib/biometric-engine/core/BiometricEngine'
import { BlinkTransitionTracker } from '../../../lib/biometric-engine/core/challenges'
import { dataURLToImageData } from '../utils/faceCropper'
import type { NormalizedLandmark } from '../../../lib/biometric-engine/types'

/**
 * Client-side passive liveness pre-filter threshold.
 * Captures scoring below this value are discarded and the challenge resets.
 * This is a client-side guard only — the server still makes the auth decision (D2).
 *
 * @see BIOMETRIC_ROADMAP_2026-04-28.md Faz 2 — passive liveness client pre-filter
 */
const PASSIVE_LIVENESS_THRESHOLD = 0.45

/**
 * Minimum overall QualityAssessor score (0-100) required to accept an
 * enrollment capture. Below this the frame is rejected and the user is
 * re-prompted to improve framing / lighting / sharpness rather than enrolling
 * a blurry, dark, or too-small face. Matches the engine's ENROLLMENT_QUALITY_MIN.
 *
 * @see lib/biometric-engine/core/constants.ts ENROLLMENT_QUALITY_MIN
 */
const ENROLLMENT_QUALITY_MIN = 65

/**
 * Assess the quality of the current face ROI synchronously from the live video
 * frame, bounded by the normalized detection bbox. Returns the QualityAssessor
 * report, or null when no usable ROI / assessor is available.
 */
function assessCurrentQuality(
    boundingBox: { x: number; y: number; width: number; height: number } | null,
): import('../../../lib/biometric-engine/types').QualityReport | null {
    try {
        const engine = BiometricEngine.getInstance()
        const assessor = engine.qualityAssessor
        if (!assessor || !assessor.isAvailable() || !boundingBox) return null
        const video = document.querySelector('video') as HTMLVideoElement | null
        if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return null
        const vw = video.videoWidth
        const vh = video.videoHeight
        const px = Math.max(0, Math.round(boundingBox.x * vw))
        const py = Math.max(0, Math.round(boundingBox.y * vh))
        const pw = Math.min(vw - px, Math.round(boundingBox.width * vw))
        const ph = Math.min(vh - py, Math.round(boundingBox.height * vh))
        if (pw <= 2 || ph <= 2) return null
        const offscreen = document.createElement('canvas')
        offscreen.width = pw
        offscreen.height = ph
        const ctx2d = offscreen.getContext('2d')
        if (!ctx2d) return null
        ctx2d.drawImage(video, px, py, pw, ph, 0, 0, pw, ph)
        const roi = ctx2d.getImageData(0, 0, pw, ph)
        return assessor.assess(roi)
    } catch {
        return null
    }
}

export type ChallengeStage =
    | 'position'      // Center face in oval
    | 'frontal'       // Look straight
    | 'turn_left'     // Turn head left
    | 'turn_right'    // Turn head right
    | 'blink'         // Blink naturally
    | 'capture'       // Capturing...
    | 'complete'      // Done

export type VerificationStage =
    | 'position'      // Position face
    | 'hold'          // Hold still (capturing)
    | 'verifying'     // Sending to backend
    | 'success'       // Verified
    | 'failure'       // Failed

export interface ChallengeState {
    stage: ChallengeStage
    stageIndex: number
    totalStages: number
    progress: number           // 0-1, overall enrollment progress
    stageProgress: number      // 0-1, current stage hold progress
    instruction: string
    captures: string[]         // base64 images captured at each stage
    clientEmbeddings: (number[] | null)[]  // 512-dim landmark-geometry embedding per capture (null if landmarks unavailable); log-only per D2
    captureLandmarks: (NormalizedLandmark[] | null)[]  // 478-pt mesh snapshotted WITH each capture, for the client-side embedder's aligner (null when the active backend lacks dense landmarks, e.g. BlazeFace fallback)
}

export interface VerificationState {
    stage: VerificationStage
    progress: number
    instruction: string
    capturedImage: string | null
}

/**
 * `softTimeoutAllowed` controls whether the soft STAGE_TIMEOUT_MS auto-pass
 * applies to a stage.
 *
 *   • `position` / `frontal` — passive "hold still" stages. A soft timeout is
 *     acceptable here: the user is already facing the camera, head-pose / centering
 *     estimation is just noisy, so capturing after STAGE_TIMEOUT_MS does NOT skip a
 *     deliberate action — the user IS doing what was asked.
 *
 *   • `turn_left` / `turn_right` / `blink` — MANDATORY active gestures. These MUST
 *     be performed; a soft timeout here would silently auto-pass a gesture the user
 *     never made, defeating the liveness intent. So these require `conditionMet`
 *     and NEVER capture on a timeout alone (owner-approved decision, 2026-06-03 —
 *     gestures are mandatory, no silent auto-skip).
 */
const ENROLLMENT_STAGES: { stage: ChallengeStage; instructionKey: string; holdMs: number; softTimeoutAllowed: boolean }[] = [
    // 'position' captures the centered, well-framed FRONTAL image (it gates on
    // centered + correct distance). The old separate 'frontal' step was a
    // near-duplicate "look at the camera" capture and was removed (2026-06-03) —
    // it confused users ("how many times do I look?") with no quality benefit.
    { stage: 'position', instructionKey: 'faceChallenge.positionOval', holdMs: 300, softTimeoutAllowed: true },
    { stage: 'turn_left', instructionKey: 'faceChallenge.turnLeft', holdMs: 300, softTimeoutAllowed: false },
    { stage: 'turn_right', instructionKey: 'faceChallenge.turnRight', holdMs: 300, softTimeoutAllowed: false },
    // NOTE: the 'blink' stage was removed (2026-06-03). Client-side blink detection
    // proved unreliable across devices (it depends on sampling the ~50–100ms eye-closed
    // phase, which low/variable camera FPS misses). The server runs the authoritative
    // passive-liveness check on the captured frames, and the two head-turns provide an
    // active "live person" gesture, so the client blink added fragility with no real
    // anti-spoof value. The blink detection machinery below is retained but unreferenced.
]

const HEAD_TURN_THRESHOLD = 0.06 // relaxed for mobile front cameras
// Soft timeout: ONLY for stages with `softTimeoutAllowed === true` (position +
// frontal). For those, if a face IS detected but the centering/pose isn't yet
// satisfied for this long, we capture anyway with a shortened hold — forgiving
// of mobile front-camera quirks where detection is noisy.
//
// The 3 mandatory gestures (turn_left/turn_right/blink) have
// `softTimeoutAllowed === false`: they NEVER auto-capture on a timeout, so a
// gesture the user never performed is never silently accepted.
//
// IMPORTANT: even for soft-timeout stages, timeouts must NEVER fire while
// `detection.detected === false`. Pointing the camera at the ceiling (or
// anywhere with no face) must NOT advance the flow — the server rejects an
// empty descriptor at pgvector insert time and the user only sees the failure
// at save. See USER-BUG-1.
const STAGE_TIMEOUT_MS = 6000

// Blink-specific timeouts. A blink is only DETECTABLE when the active backend
// exposes eye landmarks (avgEAR != null — the MediaPipe 478-pt FaceLandmarker,
// NOT the BlazeFace fallback, which has no eye landmarks). When eyes are NOT
// detectable, requiring a blink would trap the user, so we capture after a SHORT
// timeout. When eyes ARE detectable, blink stays mandatory but a GENEROUS safety
// timeout still prevents a permanent stuck if a real blink never registers.
// (turn_left/turn_right stay strictly mandatory — bbox-based, always detectable.)
const BLINK_SAFETY_TIMEOUT_MS = 12000
const BLINK_NO_EYES_TIMEOUT_MS = 4000

// After this long waiting on a MANDATORY gesture stage (where the soft timeout
// never auto-passes), surface a gentle "still waiting for the gesture" hint so
// the user understands the flow is waiting on THEM, not stuck. This is a UI
// nudge ONLY — it never captures and never advances the stage.
const GESTURE_HINT_MS = 6000

export function useFaceChallenge() {
    const [challengeState, setChallengeState] = useState<ChallengeState>({
        stage: 'position',
        stageIndex: 0,
        totalStages: ENROLLMENT_STAGES.length,
        // Progress = COMPLETED stages / total, so it reads 0% at Step 1/5 and
        // 100% at completion — the % and the "Step n/5" counter now agree.
        progress: 0,
        stageProgress: 0,
        instruction: ENROLLMENT_STAGES[0].instructionKey,
        captures: [],
        clientEmbeddings: [],
        captureLandmarks: [],
    })

    const holdStartRef = useRef<number | null>(null)
    const stageIndexRef = useRef(0)
    const capturesRef = useRef<string[]>([])
    const clientEmbeddingsRef = useRef<(number[] | null)[]>([])
    const captureLandmarksRef = useRef<(NormalizedLandmark[] | null)[]>([])
    // Canonical close→re-open blink transition tracker — the SAME implementation
    // the puzzle BlinkDetector uses, so enrollment and puzzles agree on what a
    // blink is. Replaces the old face-detection-confidence-dip heuristic.
    // Enrollment uses a more LENIENT consecutiveFrames=1 (vs the anti-spoof
    // default 2): at low enrollment frame rates a fast natural blink may only
    // span a single closed frame, so requiring 2 consecutive could miss it. The
    // server runs the authoritative passive-liveness check, so leniency here is
    // safe and just makes the on-screen blink step easier to complete.
    const blinkTrackerRef = useRef<BlinkTransitionTracker>(
        new BlinkTransitionTracker(undefined, undefined, 1),
    )
    const blinkDetectedRef = useRef(false)
    const stageStartRef = useRef<number>(Date.now())

    const resetChallenge = useCallback(() => {
        stageIndexRef.current = 0
        capturesRef.current = []
        clientEmbeddingsRef.current = []
        captureLandmarksRef.current = []
        holdStartRef.current = null
        blinkTrackerRef.current.reset()
        blinkDetectedRef.current = false
        stageStartRef.current = Date.now()
        setChallengeState({
            stage: 'position',
            stageIndex: 0,
            totalStages: ENROLLMENT_STAGES.length,
            progress: 0,
            stageProgress: 0,
            instruction: ENROLLMENT_STAGES[0].instructionKey,
            captures: [],
            clientEmbeddings: [],
            captureLandmarks: [],
        })
    }, [])

    /**
     * Reset the stage clock to "now" when enrollment actually BEGINS.
     *
     * The capture loop only runs after the user clicks "Begin" in
     * FaceEnrollmentFlow, but `stageStartRef` is initialised at hook mount
     * (dialog open). Without this, Step 1's soft-timeout clock could already
     * have elapsed by the time the user clicks Begin, letting the first stage
     * instant-capture on a stale 6s clock. Call this from the consumer at the
     * moment enrollment starts so the soft-timeout countdown starts fresh.
     */
    const markStarted = useCallback(() => {
        stageStartRef.current = Date.now()
        holdStartRef.current = null
    }, [])

    const checkStageCondition = useCallback((
        stage: ChallengeStage,
        detection: FaceDetectionState,
    ): boolean => {
        switch (stage) {
            case 'position':
                return detection.detected && detection.centered && !detection.tooClose && !detection.tooFar

            case 'frontal':
                // Face centered = looking straight
                return detection.detected && detection.centered

            case 'turn_left': {
                if (!detection.detected || !detection.boundingBox) return false
                // Face bounding box shifted right in mirrored video = head turned left
                const centerX = detection.boundingBox.x + detection.boundingBox.width / 2
                return centerX > (0.5 + HEAD_TURN_THRESHOLD)
            }

            case 'turn_right': {
                if (!detection.detected || !detection.boundingBox) return false
                // Face bounding box shifted left in mirrored video = head turned right
                const centerX = detection.boundingBox.x + detection.boundingBox.width / 2
                return centerX < (0.5 - HEAD_TURN_THRESHOLD)
            }

            case 'blink': {
                if (!detection.detected) return false
                // Canonical EAR close→re-open transition (same as the puzzle
                // BlinkDetector). A natural ~120ms blink completes on the re-open
                // edge — no eyes-squeezed-shut hold. Once seen, latch it so the
                // stage's short hold timer can capture a clean open-eye frame.
                if (detection.avgEAR !== null) {
                    if (blinkTrackerRef.current.update(detection.avgEAR)) {
                        blinkDetectedRef.current = true
                    }
                }
                // When avgEAR is null the active backend has no eye landmarks
                // (BlazeFace / MediaPipe FaceDetector fallback); the stage soft
                // timeout in updateChallenge() captures anyway after STAGE_TIMEOUT_MS.
                return blinkDetectedRef.current
            }

            default:
                return false
        }
    }, [])

    const updateChallenge = useCallback((
        detection: FaceDetectionState,
        cropFace: (canvas: HTMLCanvasElement) => string | null,
        canvasRef: React.RefObject<HTMLCanvasElement | null>,
        captureLandmarks?: () => NormalizedLandmark[] | null,
    ) => {
        const idx = stageIndexRef.current
        if (idx >= ENROLLMENT_STAGES.length) return

        const currentStage = ENROLLMENT_STAGES[idx]
        const conditionMet = checkStageCondition(currentStage.stage, detection)

        // GATE: never advance, never run capture/liveness math, never start
        // hold timers when there is no face in the frame. The previous build
        // had a "hard timeout" that fired regardless of `detection.detected`,
        // which let users enroll a ceiling/wall and then crashed at the
        // pgvector insert — surfacing only as "DB save failed". See USER-BUG-1.
        if (!detection.detected) {
            holdStartRef.current = null
            // Reset stage-elapsed clock too, otherwise the soft-timeout below
            // would fire instantly the moment a face reappears.
            stageStartRef.current = Date.now()
            setChallengeState(prev => ({
                ...prev,
                stageProgress: 0,
                progress: idx / ENROLLMENT_STAGES.length,
                instruction: 'faceChallenge.noFaceDetected',
            }))
            return
        }

        const stageElapsed = Date.now() - stageStartRef.current
        // Soft timeout — ONLY for `softTimeoutAllowed` stages (position +
        // frontal). For those, when a face IS detected but centering isn't yet
        // satisfied, after STAGE_TIMEOUT_MS we capture anyway with a shortened
        // hold to be forgiving of mobile detection noise.
        //
        // turn_left / turn_right are strictly mandatory (softTimeoutAllowed=false):
        // they advance ONLY via `conditionMet`. Blink is special — it can only be
        // DETECTED when avgEAR is available; if the backend can't see eyes (avgEAR
        // null) or a real blink never registers within a generous window, capture
        // anyway so the flow is never permanently stuck on an undetectable gesture
        // (a real blink still advances instantly when detected).
        let timeoutAllowed = currentStage.softTimeoutAllowed
        let timeoutThreshold = STAGE_TIMEOUT_MS
        if (currentStage.stage === 'blink' && !blinkDetectedRef.current) {
            timeoutAllowed = true
            timeoutThreshold = detection.avgEAR !== null ? BLINK_SAFETY_TIMEOUT_MS : BLINK_NO_EYES_TIMEOUT_MS
        }
        const timeoutReached = timeoutAllowed && stageElapsed > timeoutThreshold

        if (conditionMet || timeoutReached) {
            if (!holdStartRef.current) {
                holdStartRef.current = Date.now()
            }

            const elapsed = Date.now() - holdStartRef.current
            // If timeout reached, use shorter hold time (500ms) to quickly capture
            const requiredHold = timeoutReached && !conditionMet ? 500 : currentStage.holdMs
            const stageProgress = Math.min(1, elapsed / requiredHold)

            if (elapsed >= requiredHold) {
                // Stage complete — capture image. cropFace requires a face
                // bounding box; if it returns null, we MUST NOT submit a
                // synthesized center-crop (that would let a ceiling capture
                // through). Reset the hold and keep waiting for a real face.
                let capturedImage: string | null = null
                if (canvasRef.current) {
                    capturedImage = cropFace(canvasRef.current)
                }
                if (!capturedImage) {
                    // Reset BOTH hold and stage timers. Pre-fix only
                    // holdStartRef was reset, so `stageElapsed` and the
                    // derived `timeoutReached` could remain "true" on the
                    // next loop iteration — re-introducing the soft
                    // stage-skip race (Copilot post-merge on PR #50).
                    holdStartRef.current = null
                    stageStartRef.current = Date.now()
                    setChallengeState(prev => ({
                        ...prev,
                        stageProgress: 0,
                        progress: idx / ENROLLMENT_STAGES.length,
                        instruction: 'faceChallenge.noFaceDetected',
                    }))
                    return
                }
                {
                    // ── Quality gate (blur / lighting / size) ────────────────────────────
                    // Assess the captured face ROI before accepting it. A low score
                    // (blurry, too dark/bright, or too small) does NOT enroll — instead
                    // we reset the hold for THIS stage (not the whole challenge) and
                    // re-prompt the user to improve framing. When the assessor is
                    // unavailable we skip the gate (the server still scores quality);
                    // unlike liveness, a missing quality model should not hard-block
                    // enrollment because quality is advisory, not anti-spoof.
                    const quality = assessCurrentQuality(detection.boundingBox)
                    if (quality && quality.score < ENROLLMENT_QUALITY_MIN) {
                        holdStartRef.current = null
                        stageStartRef.current = Date.now()
                        // Pick a specific hint from the worst detected issue.
                        let instruction = 'faceChallenge.qualityTooLow'
                        if (quality.issues.includes('Blurry')) instruction = 'faceChallenge.qualityBlurry'
                        else if (quality.issues.includes('Dark')) instruction = 'faceChallenge.qualityDark'
                        else if (quality.issues.includes('Bright')) instruction = 'faceChallenge.qualityBright'
                        else if (quality.issues.includes('Small')) instruction = 'faceChallenge.qualitySmall'
                        setChallengeState(prev => ({
                            ...prev,
                            stageProgress: 0,
                            progress: idx / ENROLLMENT_STAGES.length,
                            instruction,
                        }))
                        return
                    }
                    // ─────────────────────────────────────────────────────────────────────

                    // ── Passive liveness pre-filter (client-side, D2 compliant) ──────────
                    // FAIL-CLOSED gate. The face capture is only accepted when the
                    // PassiveLivenessDetector is available AND returns a score at or
                    // above PASSIVE_LIVENESS_THRESHOLD. Any of the following resets the
                    // challenge instead of letting a frame through:
                    //   • detector unavailable / not yet loaded
                    //   • no usable face ROI (missing bbox, video not ready, degenerate crop)
                    //   • liveness score below threshold
                    //   • an exception during ROI extraction or the check itself
                    //
                    // Rationale: failing OPEN here let printed-photo / screen-replay
                    // attacks pass the client pre-filter whenever the model hadn't
                    // loaded. The server still makes the final auth decision, but the
                    // client must not advance a capture it could not vouch for.
                    const livenessPassed = (() => {
                        try {
                            const engine = BiometricEngine.getInstance()
                            const livenessDetector = engine.livenessDetector
                            if (!livenessDetector || !livenessDetector.isAvailable() || !detection.boundingBox) {
                                return false
                            }
                            const video = document.querySelector('video') as HTMLVideoElement | null
                            if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
                                return false
                            }
                            const vw = video.videoWidth
                            const vh = video.videoHeight
                            const bb = detection.boundingBox
                            // Convert normalized bbox to pixel coords
                            const px = Math.max(0, Math.round(bb.x * vw))
                            const py = Math.max(0, Math.round(bb.y * vh))
                            const pw = Math.min(vw - px, Math.round(bb.width * vw))
                            const ph = Math.min(vh - py, Math.round(bb.height * vh))
                            if (pw <= 2 || ph <= 2) {
                                return false
                            }
                            const offscreen = document.createElement('canvas')
                            offscreen.width = pw
                            offscreen.height = ph
                            const ctx2d = offscreen.getContext('2d')
                            if (!ctx2d) {
                                return false
                            }
                            ctx2d.drawImage(video, px, py, pw, ph, 0, 0, pw, ph)
                            const faceROI = ctx2d.getImageData(0, 0, pw, ph)
                            const livenessResult = livenessDetector.check(faceROI)
                            // Score is on a 0-100 scale in PassiveLivenessDetector.
                            return livenessResult.score >= PASSIVE_LIVENESS_THRESHOLD * 100
                        } catch {
                            // Fail closed on any error.
                            return false
                        }
                    })()

                    if (!livenessPassed) {
                        // Liveness gate not satisfied. SECURITY: the check itself
                        // is unchanged (we still fail-closed and discard this
                        // frame). Only the RECOVERY UX changes: re-prompt the
                        // CURRENT stage instead of snapping the user all the way
                        // back to Step 1. We reset only the current hold + stage
                        // clock and show the liveness-retry instruction — mirroring
                        // the quality-gate behavior above. Captures already earned
                        // on earlier stages are kept, and stageIndex is preserved.
                        holdStartRef.current = null
                        stageStartRef.current = Date.now()
                        // Blink stage: clear the latched blink so the user must
                        // blink again for a fresh live frame on the retry.
                        blinkTrackerRef.current.reset()
                        blinkDetectedRef.current = false
                        setChallengeState(prev => ({
                            ...prev,
                            stageProgress: 0,
                            progress: idx / ENROLLMENT_STAGES.length,
                            instruction: 'faceChallenge.livenessCheckFailed',
                        }))
                        return
                    }
                    // ─────────────────────────────────────────────────────────────────────

                    capturesRef.current = [...capturesRef.current, capturedImage]
                    // Snapshot the 478-pt mesh for THIS exact frame so the
                    // client-side embedder's aligner uses landmarks that match the
                    // captured crop (null when the active backend lacks dense
                    // landmarks, e.g. the BlazeFace fallback).
                    captureLandmarksRef.current = [...captureLandmarksRef.current, typeof captureLandmarks === 'function' ? captureLandmarks() : null]

                    // Async: extract client-side landmark-geometry embedding (log-only per D2).
                    // Returns null when landmarks are unavailable; server ignores the field.
                    // Push null immediately so the array index lines up with captures[],
                    // then replace with the real embedding once extraction completes.
                    const captureIdx = capturesRef.current.length - 1
                    clientEmbeddingsRef.current = [...clientEmbeddingsRef.current, null]
                    ;(async () => {
                        try {
                            const engine = BiometricEngine.getInstance()
                            const computer = engine.embeddingComputer
                            if (computer && computer.isAvailable()) {
                                const imageData = await dataURLToImageData(capturedImage)
                                if (imageData) {
                                    const vec = await computer.extract(imageData)
                                    if (vec) {
                                        clientEmbeddingsRef.current = clientEmbeddingsRef.current.map(
                                            (e, i) => i === captureIdx ? Array.from(vec) : e
                                        )
                                    }
                                }
                            }
                        } catch {
                            // Non-critical: embedding extraction failure is silently ignored.
                            // Server will perform its own embedding extraction.
                        }
                    })()
                }

                const nextIdx = idx + 1
                stageIndexRef.current = nextIdx
                holdStartRef.current = null
                blinkDetectedRef.current = false
                blinkTrackerRef.current.reset()
                stageStartRef.current = Date.now()

                if (nextIdx >= ENROLLMENT_STAGES.length) {
                    setChallengeState({
                        stage: 'complete',
                        stageIndex: nextIdx,
                        totalStages: ENROLLMENT_STAGES.length,
                        progress: 1,
                        stageProgress: 1,
                        instruction: 'faceChallenge.enrolledSuccess',
                        captures: capturesRef.current,
                        clientEmbeddings: clientEmbeddingsRef.current,
                        captureLandmarks: captureLandmarksRef.current,
                    })
                } else {
                    setChallengeState({
                        stage: ENROLLMENT_STAGES[nextIdx].stage,
                        stageIndex: nextIdx,
                        totalStages: ENROLLMENT_STAGES.length,
                        // `nextIdx` stages are now complete.
                        progress: nextIdx / ENROLLMENT_STAGES.length,
                        stageProgress: 0,
                        instruction: ENROLLMENT_STAGES[nextIdx].instructionKey,
                        captures: capturesRef.current,
                        clientEmbeddings: clientEmbeddingsRef.current,
                        captureLandmarks: captureLandmarksRef.current,
                    })
                }
            } else {
                setChallengeState(prev => ({
                    ...prev,
                    stageProgress,
                    progress: idx / ENROLLMENT_STAGES.length,
                }))
            }
        } else {
            // Condition not met — reset hold timer. The stage NEVER auto-passes
            // here for mandatory gestures; we just keep waiting for the user to
            // perform the gesture.
            holdStartRef.current = null
            // Gentle nudge: for a mandatory gesture stage that the user has been
            // on for a while without performing the gesture, swap the instruction
            // to a "still waiting" hint so it's clear the flow is waiting on THEM
            // (it never captures — purely informational). Soft-timeout stages keep
            // their normal instruction since they auto-advance anyway.
            const showGestureHint =
                !currentStage.softTimeoutAllowed && stageElapsed > GESTURE_HINT_MS
            setChallengeState(prev => ({
                ...prev,
                stageProgress: 0,
                progress: idx / ENROLLMENT_STAGES.length,
                instruction: showGestureHint
                    ? 'faceChallenge.gestureStillWaiting'
                    : currentStage.instructionKey,
            }))
        }
    }, [checkStageCondition])

    return { challengeState, updateChallenge, resetChallenge, markStarted }
}

export function useFaceVerification() {
    const [verificationState, setVerificationState] = useState<VerificationState>({
        stage: 'position',
        progress: 0,
        instruction: 'faceDetection.positionFace',
        capturedImage: null,
    })

    const holdStartRef = useRef<number | null>(null)
    const HOLD_DURATION = 1500 // ms to hold before auto-capture

    const resetVerification = useCallback(() => {
        holdStartRef.current = null
        setVerificationState({
            stage: 'position',
            progress: 0,
            instruction: 'faceDetection.positionFace',
            capturedImage: null,
        })
    }, [])

    const updateVerification = useCallback((
        detection: FaceDetectionState,
        cropFace: (canvas: HTMLCanvasElement) => string | null,
        canvasRef: React.RefObject<HTMLCanvasElement | null>,
    ) => {
        if (verificationState.stage !== 'position') return

        const ready = detection.detected && detection.centered && !detection.tooClose && !detection.tooFar

        if (ready) {
            if (!holdStartRef.current) {
                holdStartRef.current = Date.now()
                setVerificationState(prev => ({
                    ...prev,
                    instruction: 'faceChallenge.holdStill',
                }))
            }

            const elapsed = Date.now() - holdStartRef.current
            const progress = Math.min(1, elapsed / HOLD_DURATION)

            if (elapsed >= HOLD_DURATION) {
                // Auto-capture
                let capturedImage: string | null = null
                if (canvasRef.current) {
                    capturedImage = cropFace(canvasRef.current)
                }

                setVerificationState({
                    stage: 'hold',
                    progress: 1,
                    instruction: 'faceChallenge.capturedVerifying',
                    capturedImage,
                })
            } else {
                setVerificationState(prev => ({ ...prev, progress }))
            }
        } else {
            holdStartRef.current = null
            setVerificationState(prev => ({
                ...prev,
                progress: 0,
                instruction: detection.hint || 'faceDetection.positionFace',
            }))
        }
    }, [verificationState.stage])

    const setResult = useCallback((success: boolean) => {
        setVerificationState(prev => ({
            ...prev,
            stage: success ? 'success' : 'failure',
            instruction: success ? 'faceChallenge.identityVerified' : 'faceChallenge.verificationFailed',
        }))
    }, [])

    return { verificationState, updateVerification, resetVerification, setResult }
}
