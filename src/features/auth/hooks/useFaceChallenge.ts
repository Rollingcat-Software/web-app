import { useState, useCallback, useRef } from 'react'
import { FaceDetectionState } from './useFaceDetection'

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
}

export interface VerificationState {
    stage: VerificationStage
    progress: number
    instruction: string
    capturedImage: string | null
}

const ENROLLMENT_STAGES: { stage: ChallengeStage; instruction: string; holdMs: number }[] = [
    { stage: 'position', instruction: 'Position your face in the oval', holdMs: 1500 },
    { stage: 'frontal', instruction: 'Look straight at the camera', holdMs: 2000 },
    { stage: 'turn_left', instruction: 'Slowly turn your head left', holdMs: 1800 },
    { stage: 'turn_right', instruction: 'Slowly turn your head right', holdMs: 1800 },
    { stage: 'blink', instruction: 'Blink naturally', holdMs: 2500 },
]

const HEAD_TURN_THRESHOLD = 0.12 // bounding box center offset from video center

export function useFaceChallenge() {
    const [challengeState, setChallengeState] = useState<ChallengeState>({
        stage: 'position',
        stageIndex: 0,
        totalStages: ENROLLMENT_STAGES.length,
        progress: 0,
        stageProgress: 0,
        instruction: ENROLLMENT_STAGES[0].instruction,
        captures: [],
    })

    const holdStartRef = useRef<number | null>(null)
    const stageIndexRef = useRef(0)
    const capturesRef = useRef<string[]>([])
    const prevConfidenceRef = useRef<number>(0)
    const blinkDetectedRef = useRef(false)

    const resetChallenge = useCallback(() => {
        stageIndexRef.current = 0
        capturesRef.current = []
        holdStartRef.current = null
        prevConfidenceRef.current = 0
        blinkDetectedRef.current = false
        setChallengeState({
            stage: 'position',
            stageIndex: 0,
            totalStages: ENROLLMENT_STAGES.length,
            progress: 0,
            stageProgress: 0,
            instruction: ENROLLMENT_STAGES[0].instruction,
            captures: [],
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
                if (prevConf > 0.7 && currentConf < 0.55) {
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

        if (conditionMet) {
            if (!holdStartRef.current) {
                holdStartRef.current = Date.now()
            }

            const elapsed = Date.now() - holdStartRef.current
            const stageProgress = Math.min(1, elapsed / currentStage.holdMs)

            if (elapsed >= currentStage.holdMs) {
                // Stage complete — capture image
                let capturedImage: string | null = null
                if (canvasRef.current) {
                    capturedImage = cropFace(canvasRef.current)
                }
                if (capturedImage) {
                    capturesRef.current = [...capturesRef.current, capturedImage]
                }

                const nextIdx = idx + 1
                stageIndexRef.current = nextIdx
                holdStartRef.current = null
                blinkDetectedRef.current = false
                prevConfidenceRef.current = 0

                if (nextIdx >= ENROLLMENT_STAGES.length) {
                    setChallengeState({
                        stage: 'complete',
                        stageIndex: nextIdx,
                        totalStages: ENROLLMENT_STAGES.length,
                        progress: 1,
                        stageProgress: 1,
                        instruction: 'Face enrolled successfully!',
                        captures: capturesRef.current,
                    })
                } else {
                    setChallengeState({
                        stage: ENROLLMENT_STAGES[nextIdx].stage,
                        stageIndex: nextIdx,
                        totalStages: ENROLLMENT_STAGES.length,
                        progress: nextIdx / ENROLLMENT_STAGES.length,
                        stageProgress: 0,
                        instruction: ENROLLMENT_STAGES[nextIdx].instruction,
                        captures: capturesRef.current,
                    })
                }
            } else {
                setChallengeState(prev => ({
                    ...prev,
                    stageProgress,
                    progress: (idx + stageProgress) / ENROLLMENT_STAGES.length,
                }))
            }
        } else {
            // Condition not met — reset hold timer
            holdStartRef.current = null
            setChallengeState(prev => ({
                ...prev,
                stageProgress: 0,
                progress: idx / ENROLLMENT_STAGES.length,
            }))
        }
    }, [checkStageCondition])

    return { challengeState, updateChallenge, resetChallenge }
}

export function useFaceVerification() {
    const [verificationState, setVerificationState] = useState<VerificationState>({
        stage: 'position',
        progress: 0,
        instruction: 'Position your face in the frame',
        capturedImage: null,
    })

    const holdStartRef = useRef<number | null>(null)
    const HOLD_DURATION = 1500 // ms to hold before auto-capture

    const resetVerification = useCallback(() => {
        holdStartRef.current = null
        setVerificationState({
            stage: 'position',
            progress: 0,
            instruction: 'Position your face in the frame',
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
                    instruction: 'Hold still...',
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
                    instruction: 'Captured! Verifying...',
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
                instruction: detection.hint || 'Position your face in the frame',
            }))
        }
    }, [verificationState.stage])

    const setResult = useCallback((success: boolean) => {
        setVerificationState(prev => ({
            ...prev,
            stage: success ? 'success' : 'failure',
            instruction: success ? 'Identity verified!' : 'Verification failed. Try again.',
        }))
    }, [])

    return { verificationState, updateVerification, resetVerification, setResult }
}
