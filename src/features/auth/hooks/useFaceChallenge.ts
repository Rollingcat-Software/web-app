import { useState, useCallback, useRef } from 'react'
import { FaceDetectionState } from './useFaceDetection'
import { BiometricEngine } from '../../../lib/biometric-engine/core/BiometricEngine'
import { dataURLToImageData } from '../utils/faceCropper'

/**
 * Client-side passive liveness pre-filter threshold.
 * Captures scoring below this value are discarded and the challenge resets.
 * This is a client-side guard only — the server still makes the auth decision (D2).
 *
 * @see BIOMETRIC_ROADMAP_2026-04-28.md Faz 2 — passive liveness client pre-filter
 */
const PASSIVE_LIVENESS_THRESHOLD = 0.45

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
}

export interface VerificationState {
    stage: VerificationStage
    progress: number
    instruction: string
    capturedImage: string | null
}

const ENROLLMENT_STAGES: { stage: ChallengeStage; instructionKey: string; holdMs: number }[] = [
    { stage: 'position', instructionKey: 'faceChallenge.positionOval', holdMs: 300 },
    { stage: 'frontal', instructionKey: 'faceChallenge.lookStraight', holdMs: 300 },
    { stage: 'turn_left', instructionKey: 'faceChallenge.turnLeft', holdMs: 300 },
    { stage: 'turn_right', instructionKey: 'faceChallenge.turnRight', holdMs: 300 },
    { stage: 'blink', instructionKey: 'faceChallenge.blink', holdMs: 400 },
]

const HEAD_TURN_THRESHOLD = 0.06 // relaxed for mobile front cameras
// Soft timeout: if a face IS detected but the stage-specific gesture (turn left,
// blink, etc.) is not satisfied for this long, capture anyway. This is forgiving
// of mobile front-camera quirks where head-pose estimation is noisy.
//
// IMPORTANT: timeouts must NEVER fire while `detection.detected === false`.
// Pointing the camera at the ceiling (or anywhere with no face) must NOT
// advance the flow — the server rejects an empty descriptor at pgvector insert
// time and the user only sees the failure at save. See USER-BUG-1.
const STAGE_TIMEOUT_MS = 6000

export function useFaceChallenge() {
    const [challengeState, setChallengeState] = useState<ChallengeState>({
        stage: 'position',
        stageIndex: 0,
        totalStages: ENROLLMENT_STAGES.length,
        progress: 1 / ENROLLMENT_STAGES.length,
        stageProgress: 0,
        instruction: ENROLLMENT_STAGES[0].instructionKey,
        captures: [],
        clientEmbeddings: [],
    })

    const holdStartRef = useRef<number | null>(null)
    const stageIndexRef = useRef(0)
    const capturesRef = useRef<string[]>([])
    const clientEmbeddingsRef = useRef<(number[] | null)[]>([])
    const prevConfidenceRef = useRef<number>(0)
    const blinkDetectedRef = useRef(false)
    const stageStartRef = useRef<number>(Date.now())

    const resetChallenge = useCallback(() => {
        stageIndexRef.current = 0
        capturesRef.current = []
        clientEmbeddingsRef.current = []
        holdStartRef.current = null
        prevConfidenceRef.current = 0
        blinkDetectedRef.current = false
        stageStartRef.current = Date.now()
        setChallengeState({
            stage: 'position',
            stageIndex: 0,
            totalStages: ENROLLMENT_STAGES.length,
            progress: 1 / ENROLLMENT_STAGES.length,
            stageProgress: 0,
            instruction: ENROLLMENT_STAGES[0].instructionKey,
            captures: [],
            clientEmbeddings: [],
        })
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
                // Detect blink via confidence dip: confidence drops then recovers
                const currentConf = detection.confidence
                const prevConf = prevConfidenceRef.current
                if (prevConf > 0.6 && currentConf < 0.5) {
                    blinkDetectedRef.current = true
                }
                prevConfidenceRef.current = currentConf
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
                progress: (idx + 1) / ENROLLMENT_STAGES.length,
                instruction: 'faceChallenge.noFaceDetected',
            }))
            return
        }

        const stageElapsed = Date.now() - stageStartRef.current
        // Soft timeout: face IS detected but the gesture (turn left, blink…)
        // is not satisfied. After STAGE_TIMEOUT_MS we capture anyway with a
        // shortened hold to be forgiving of mobile head-pose noise.
        const timeoutReached = stageElapsed > STAGE_TIMEOUT_MS

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
                    holdStartRef.current = null
                    setChallengeState(prev => ({
                        ...prev,
                        stageProgress: 0,
                        progress: (idx + 1) / ENROLLMENT_STAGES.length,
                        instruction: 'faceChallenge.noFaceDetected',
                    }))
                    return
                }
                {
                    // ── Passive liveness pre-filter (client-side, D2 compliant) ──────────
                    // Extract face ROI as ImageData synchronously from the current video
                    // frame (bounded by detection.boundingBox). Run PassiveLivenessDetector
                    // synchronously (pure canvas math, no async needed).
                    // If score is below threshold, reset the challenge and skip submission.
                    // If livenessDetector is unavailable (not loaded), skip silently.
                    // Server still makes the final auth decision — this is a client pre-filter.
                    try {
                        const engine = BiometricEngine.getInstance()
                        const livenessDetector = engine.livenessDetector
                        if (livenessDetector && livenessDetector.isAvailable() && detection.boundingBox) {
                            const video = document.querySelector('video') as HTMLVideoElement | null
                            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                                const vw = video.videoWidth
                                const vh = video.videoHeight
                                const bb = detection.boundingBox
                                // Convert normalized bbox to pixel coords
                                const px = Math.max(0, Math.round(bb.x * vw))
                                const py = Math.max(0, Math.round(bb.y * vh))
                                const pw = Math.min(vw - px, Math.round(bb.width * vw))
                                const ph = Math.min(vh - py, Math.round(bb.height * vh))

                                if (pw > 2 && ph > 2) {
                                    const offscreen = document.createElement('canvas')
                                    offscreen.width = pw
                                    offscreen.height = ph
                                    const ctx2d = offscreen.getContext('2d')
                                    if (ctx2d) {
                                        ctx2d.drawImage(video, px, py, pw, ph, 0, 0, pw, ph)
                                        const faceROI = ctx2d.getImageData(0, 0, pw, ph)
                                        const livenessResult = livenessDetector.check(faceROI)
                                        console.log('[PassiveLiveness]', livenessResult.score)
                                        if (livenessResult.score < PASSIVE_LIVENESS_THRESHOLD * 100) {
                                            // Score is on 0-100 scale in PassiveLivenessDetector
                                            // Reset challenge — liveness check failed
                                            stageIndexRef.current = 0
                                            capturesRef.current = []
                                            clientEmbeddingsRef.current = []
                                            holdStartRef.current = null
                                            prevConfidenceRef.current = 0
                                            blinkDetectedRef.current = false
                                            stageStartRef.current = Date.now()
                                            setChallengeState({
                                                stage: 'position',
                                                stageIndex: 0,
                                                totalStages: ENROLLMENT_STAGES.length,
                                                progress: 1 / ENROLLMENT_STAGES.length,
                                                stageProgress: 0,
                                                instruction: 'faceChallenge.livenessCheckFailed',
                                                captures: [],
                                                clientEmbeddings: [],
                                            })
                                            return
                                        }
                                    }
                                }
                            }
                        }
                    } catch {
                        // Non-critical: liveness pre-filter failure is silently ignored.
                        // Server will perform its own liveness check.
                    }
                    // ─────────────────────────────────────────────────────────────────────

                    capturesRef.current = [...capturesRef.current, capturedImage]

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
                prevConfidenceRef.current = 0
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
                    })
                } else {
                    setChallengeState({
                        stage: ENROLLMENT_STAGES[nextIdx].stage,
                        stageIndex: nextIdx,
                        totalStages: ENROLLMENT_STAGES.length,
                        progress: (nextIdx + 1) / ENROLLMENT_STAGES.length,
                        stageProgress: 0,
                        instruction: ENROLLMENT_STAGES[nextIdx].instructionKey,
                        captures: capturesRef.current,
                        clientEmbeddings: clientEmbeddingsRef.current,
                    })
                }
            } else {
                setChallengeState(prev => ({
                    ...prev,
                    stageProgress,
                    progress: (idx + 1) / ENROLLMENT_STAGES.length,
                }))
            }
        } else {
            // Condition not met — reset hold timer
            holdStartRef.current = null
            setChallengeState(prev => ({
                ...prev,
                stageProgress: 0,
                progress: (idx + 1) / ENROLLMENT_STAGES.length,
            }))
        }
    }, [checkStageCondition])

    return { challengeState, updateChallenge, resetChallenge }
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
