import { useState, useCallback, useRef } from 'react'
import { FaceDetectionState } from './useFaceDetection'
import { BiometricEngine } from '../../../lib/biometric-engine/core/BiometricEngine'
import { dataURLToImageData } from '../utils/faceCropper'

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
const STAGE_TIMEOUT_MS = 6000 // auto-advance after 6s if stuck (soft timeout)

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

        const stageElapsed = Date.now() - stageStartRef.current
        // Soft timeout: auto-advance if face detected but condition not met
        const softTimeout = stageElapsed > STAGE_TIMEOUT_MS && detection.detected
        // Hard timeout: auto-advance even without detection (MediaPipe may have failed)
        const hardTimeout = stageElapsed > STAGE_TIMEOUT_MS * 2
        const timeoutReached = softTimeout || hardTimeout

        if (conditionMet || timeoutReached) {
            if (!holdStartRef.current) {
                holdStartRef.current = Date.now()
            }

            const elapsed = Date.now() - holdStartRef.current
            // If timeout reached, use shorter hold time (500ms) to quickly capture
            const requiredHold = timeoutReached && !conditionMet ? 500 : currentStage.holdMs
            const stageProgress = Math.min(1, elapsed / requiredHold)

            if (elapsed >= requiredHold) {
                // Stage complete — capture image
                let capturedImage: string | null = null
                if (canvasRef.current) {
                    capturedImage = cropFace(canvasRef.current)
                    // If cropFace returned null (no bounding box), capture a center crop
                    // that approximates a face region rather than the full frame.
                    // The biometric-processor rejects full-frame images where it can't detect a face.
                    if (!capturedImage && canvasRef.current) {
                        const video = document.querySelector('video')
                        if (video && video.videoWidth > 0) {
                            // Crop center ~50% of frame (face is usually centered in selfie mode)
                            const vw = video.videoWidth
                            const vh = video.videoHeight
                            const cropSize = Math.min(vw, vh) * 0.6
                            const sx = (vw - cropSize) / 2
                            const sy = (vh - cropSize) / 2.5 // shift slightly up (face is upper-center)
                            const size = Math.round(cropSize)
                            canvasRef.current.width = size
                            canvasRef.current.height = size
                            const ctx = canvasRef.current.getContext('2d')
                            if (ctx) {
                                ctx.drawImage(video, sx, Math.max(0, sy), cropSize, cropSize, 0, 0, size, size)
                                capturedImage = canvasRef.current.toDataURL('image/jpeg', 0.85)
                            }
                        }
                    }
                }
                if (capturedImage) {
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
