import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { cropFaceToDataURL } from '../utils/faceCropper'

/**
 * Landmark distance helper
 */
interface Landmark {
    x: number
    y: number
    z?: number
}

function landmarkDist(landmarks: Landmark[], a: number, b: number): number {
    const la = landmarks[a]
    const lb = landmarks[b]
    if (!la || !lb) return 0
    const dx = la.x - lb.x
    const dy = la.y - lb.y
    const dz = (la.z || 0) - (lb.z || 0)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Detect blink via Eye Aspect Ratio (EAR)
 */
export function detectBlink(landmarks: Landmark[]): { detected: boolean; ear: number } {
    const leftV = landmarkDist(landmarks, 159, 145)
    const leftH = landmarkDist(landmarks, 33, 133)
    const leftEAR = leftH > 0 ? leftV / leftH : 1
    const rightV = landmarkDist(landmarks, 386, 374)
    const rightH = landmarkDist(landmarks, 362, 263)
    const rightEAR = rightH > 0 ? rightV / rightH : 1
    const avgEAR = (leftEAR + rightEAR) / 2
    return { detected: avgEAR < 0.18, ear: avgEAR }
}

/**
 * Detect smile via mouth width/height ratio
 */
export function detectSmile(landmarks: Landmark[]): { detected: boolean; ratio: number } {
    const mouthWidth = landmarkDist(landmarks, 61, 291)
    const mouthHeight = landmarkDist(landmarks, 13, 14)
    const ratio = mouthHeight > 0 ? mouthWidth / mouthHeight : 0
    return { detected: ratio > 2.8, ratio }
}

/**
 * Detect open mouth
 */
export function detectOpenMouth(landmarks: Landmark[]): { detected: boolean; ratio: number } {
    const mouthOpen = landmarkDist(landmarks, 13, 14)
    const faceHeight = landmarkDist(landmarks, 10, 152)
    const ratio = faceHeight > 0 ? mouthOpen / faceHeight : 0
    return { detected: ratio > 0.08, ratio }
}

/**
 * Detect raised eyebrows
 */
export function detectRaiseEyebrows(landmarks: Landmark[]): { detected: boolean; ratio: number } {
    const leftDist = landmarkDist(landmarks, 105, 159)
    const rightDist = landmarkDist(landmarks, 334, 386)
    const avgDist = (leftDist + rightDist) / 2
    const faceHeight = landmarkDist(landmarks, 10, 152)
    const ratio = faceHeight > 0 ? avgDist / faceHeight : 0
    return { detected: ratio > 0.065, ratio }
}

/**
 * Detect head turn direction
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

/**
 * Detect nod (head tilt down/up)
 */
export function detectNod(landmarks: Landmark[]): { nod: boolean; lookUp: boolean; offset: number } {
    const noseY = landmarks[1].y
    const foreheadY = landmarks[10].y
    const chinY = landmarks[152].y
    const faceCenter = (foreheadY + chinY) / 2
    const faceHeight = Math.abs(chinY - foreheadY)
    const offset = (noseY - faceCenter) / (faceHeight || 0.001)
    return { nod: offset > 0.15, lookUp: offset < -0.05, offset }
}

export type LivenessAction =
    | 'blink'
    | 'smile'
    | 'turn_left'
    | 'turn_right'
    | 'nod'
    | 'look_up'
    | 'open_mouth'
    | 'raise_eyebrows'

export interface LivenessStep {
    action: LivenessAction
    /** i18n key for the instruction text (e.g. `liveness.actions.blink`). Render with `t()`. */
    instructionKey: string
    durationMs: number
    detected: boolean
    confidence: number
    elapsedMs: number
}

export type LivenessPuzzleStatus = 'idle' | 'requesting' | 'active' | 'verifying' | 'passed' | 'failed' | 'error'

export interface LivenessPuzzleState {
    status: LivenessPuzzleStatus
    currentStepIndex: number
    totalSteps: number
    steps: LivenessStep[]
    clientScore: number
    serverScore: number
    message: string
    challengeId: string | null
}

/**
 * i18n keys for each action instruction. Consumers should render with t().
 * Keys live in `liveness.actions.*` in en.json + tr.json.
 */
const ACTION_INSTRUCTION_KEYS: Record<string, string> = {
    blink: 'liveness.actions.blink',
    smile: 'liveness.actions.smile',
    turn_left: 'liveness.actions.turn_left',
    turn_right: 'liveness.actions.turn_right',
    nod: 'liveness.actions.nod',
    look_up: 'liveness.actions.look_up',
    open_mouth: 'liveness.actions.open_mouth',
    raise_eyebrows: 'liveness.actions.raise_eyebrows',
}

/**
 * Detect a specific liveness action from FaceLandmarker landmarks (478-point).
 */
function detectAction(action: string, landmarks: Landmark[]): boolean {
    switch (action) {
        case 'blink':
            return detectBlink(landmarks).detected
        case 'smile':
            return detectSmile(landmarks).detected
        case 'turn_left':
            return detectHeadTurn(landmarks).direction === 'left'
        case 'turn_right':
            return detectHeadTurn(landmarks).direction === 'right'
        case 'nod':
            return detectNod(landmarks).nod
        case 'look_up':
            return detectNod(landmarks).lookUp
        case 'open_mouth':
            return detectOpenMouth(landmarks).detected
        case 'raise_eyebrows':
            return detectRaiseEyebrows(landmarks).detected
        default:
            return false
    }
}

/**
 * useLivenessPuzzle — React hook for server-driven liveness challenge
 *
 * Flow:
 * 1. Request challenge from backend (gets steps with actions)
 * 2. For each step, detect the action client-side using FaceLandmarker
 * 3. Capture frames at each step
 * 4. Send captured frames + challengeId to server for verification
 * 5. Compute hybrid score (client 40% + server 60%)
 */
export function useLivenessPuzzle() {
    const { t } = useTranslation()
    const [state, setState] = useState<LivenessPuzzleState>({
        status: 'idle',
        currentStepIndex: -1,
        totalSteps: 0,
        steps: [],
        clientScore: 0,
        serverScore: 0,
        message: '',
        challengeId: null,
    })

    const abortRef = useRef(false)
    const landmarkerRef = useRef<{
        detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
            faceLandmarks: Landmark[][]
        }
    } | null>(null)

    /**
     * Set the FaceLandmarker instance (from parent component that manages MediaPipe)
     */
    const setLandmarker = useCallback((landmarker: typeof landmarkerRef.current) => {
        landmarkerRef.current = landmarker
    }, [])

    /**
     * Wait for a specific action to be detected via FaceLandmarker.
     * Returns after 3 consecutive detection frames or on timeout.
     */
    const waitForAction = useCallback((
        action: string,
        timeoutMs: number,
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ): Promise<{ detected: boolean; elapsedMs: number }> => {
        return new Promise((resolve) => {
            const startTime = performance.now()
            let detectedCount = 0
            const requiredCount = 3

            function check() {
                if (abortRef.current) {
                    resolve({ detected: false, elapsedMs: performance.now() - startTime })
                    return
                }
                if (performance.now() - startTime > timeoutMs) {
                    resolve({ detected: false, elapsedMs: performance.now() - startTime })
                    return
                }

                const video = videoRef.current
                const landmarker = landmarkerRef.current
                if (!video || !landmarker || video.readyState < 2) {
                    requestAnimationFrame(check)
                    return
                }

                try {
                    const result = landmarker.detectForVideo(video, performance.now())
                    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                        const landmarks = result.faceLandmarks[0]
                        const actionDetected = detectAction(action, landmarks)

                        if (actionDetected) {
                            detectedCount++
                            if (detectedCount >= requiredCount) {
                                resolve({ detected: true, elapsedMs: performance.now() - startTime })
                                return
                            }
                        } else {
                            detectedCount = Math.max(0, detectedCount - 1)
                        }
                    }
                } catch {
                    // skip frame
                }

                requestAnimationFrame(check)
            }

            requestAnimationFrame(check)
        })
    }, [])

    /**
     * Capture a 224×224 face crop from the video element.
     *
     * Always-client-crop: uses the FaceLandmarker's latest result to compute
     * a normalized bounding box and crop via cropFaceToDataURL, so the server
     * receives a 224×224 JPEG instead of a full-resolution frame.
     * This eliminates the 200-730ms server-side detection step for each liveness frame.
     * Falls back to a center-biased full-frame encode if landmarks are unavailable.
     *
     * Returns a Blob (multipart form upload) converted from the cropped data-URL.
     */
    const captureFrame = useCallback((
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const video = videoRef.current
            if (!video || video.readyState < 2) { resolve(null); return }

            const w = video.videoWidth
            const h = video.videoHeight
            if (!w || !h) { resolve(null); return }

            // Client pre-crops to 224×224 — server detection only as fallback.
            // Derive a bounding box from the latest FaceLandmarker result when available.
            let dataUrl: string | null = null
            const landmarker = landmarkerRef.current
            if (landmarker) {
                try {
                    const result = landmarker.detectForVideo(video, performance.now())
                    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                        const lms = result.faceLandmarks[0]
                        // Compute tight bbox from all 478 landmarks
                        let minX = 1, minY = 1, maxX = 0, maxY = 0
                        for (const lm of lms) {
                            if (lm.x < minX) minX = lm.x
                            if (lm.y < minY) minY = lm.y
                            if (lm.x > maxX) maxX = lm.x
                            if (lm.y > maxY) maxY = lm.y
                        }
                        const bbox = {
                            x: minX,
                            y: minY,
                            width: maxX - minX,
                            height: maxY - minY,
                        }
                        dataUrl = cropFaceToDataURL(video, bbox, 224, 0.2)
                    }
                } catch {
                    // Landmark detection frame error — fall through to center crop
                }
            }

            if (!dataUrl) {
                // Fallback: encode center region as 224×224 when no landmarks available
                const c = document.createElement('canvas')
                c.width = 224
                c.height = 224
                const ctx = c.getContext('2d')
                if (!ctx) { resolve(null); return }
                // Draw center square of video
                const size = Math.min(w, h)
                const sx = (w - size) / 2
                const sy = (h - size) / 2
                ctx.translate(224, 0)
                ctx.scale(-1, 1)
                ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224)
                dataUrl = c.toDataURL('image/jpeg', 0.85)
            }

            // Convert data-URL to Blob for multipart upload
            const byteString = atob(dataUrl.split(',')[1])
            const ab = new ArrayBuffer(byteString.length)
            const ia = new Uint8Array(ab)
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i)
            }
            resolve(new Blob([ab], { type: 'image/jpeg' }))
        })
    }, [])

    /**
     * Run the full liveness puzzle flow
     */
    const startPuzzle = useCallback(async (
        apiBaseUrl: string,
        token: string | null,
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ) => {
        if (!landmarkerRef.current) {
            setState(prev => ({
                ...prev,
                status: 'error',
                message: 'FaceLandmarker not initialized. Start camera first.',
            }))
            return
        }

        abortRef.current = false

        // 1. Request challenge from server
        setState(prev => ({
            ...prev,
            status: 'requesting',
            message: 'Requesting liveness challenge...',
            steps: [],
            currentStepIndex: -1,
            clientScore: 0,
            serverScore: 0,
        }))

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`

            // apiBaseUrl already includes /api/v1
            const challengeRes = await fetch(`${apiBaseUrl}/enrollment/liveness/challenge`, {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
            })

            if (!challengeRes.ok) {
                setState(prev => ({
                    ...prev,
                    status: 'error',
                    message: `Failed to get challenge (${challengeRes.status})`,
                }))
                return
            }

            const challenge = await challengeRes.json()
            const challengeId = challenge.challengeId
            const rawSteps = (challenge.steps || []) as Array<{
                action?: string
                type?: string
                order?: number
                duration_seconds?: number
                durationSeconds?: number
            }>

            if (rawSteps.length === 0) {
                setState(prev => ({
                    ...prev,
                    status: 'error',
                    message: 'No steps in challenge',
                }))
                return
            }

            rawSteps.sort((a, b) => (a.order || 0) - (b.order || 0))

            const livenessSteps: LivenessStep[] = rawSteps.map(s => {
                const action = (s.action || s.type || 'blink') as LivenessAction
                return {
                    action,
                    instructionKey: ACTION_INSTRUCTION_KEYS[action] || 'liveness.actions.perform',
                    durationMs: (s.duration_seconds || s.durationSeconds || 5) * 1000,
                    detected: false,
                    confidence: 0,
                    elapsedMs: 0,
                }
            })

            setState(prev => ({
                ...prev,
                status: 'active',
                challengeId,
                totalSteps: livenessSteps.length,
                steps: livenessSteps,
                message: `Challenge: ${livenessSteps.length} steps`,
            }))

            // 2. Process each step
            const capturedFrames: Blob[] = []
            const stepConfidences: number[] = []

            for (let i = 0; i < livenessSteps.length; i++) {
                if (abortRef.current) break

                const step = livenessSteps[i]

                setState(prev => ({
                    ...prev,
                    currentStepIndex: i,
                    // Non-UI diagnostic string. Render step.instructionKey via t() in the component.
                    message: `Step ${i + 1}/${livenessSteps.length}: ${step.action}`,
                }))

                const actionResult = await waitForAction(step.action, step.durationMs, videoRef)
                const confidence = actionResult.detected ? 1.0 : 0.0
                stepConfidences.push(confidence)

                // Update step result
                livenessSteps[i] = {
                    ...step,
                    detected: actionResult.detected,
                    confidence,
                    elapsedMs: actionResult.elapsedMs,
                }

                // Capture frame
                const frame = await captureFrame(videoRef)
                if (frame) capturedFrames.push(frame)

                setState(prev => ({
                    ...prev,
                    steps: [...livenessSteps],
                }))

                // Brief pause between steps
                if (i < livenessSteps.length - 1) {
                    await new Promise(r => setTimeout(r, 800))
                }
            }

            if (abortRef.current) {
                setState(prev => ({ ...prev, status: 'idle', message: 'Cancelled' }))
                return
            }

            // 3. Compute client score
            const clientScore = stepConfidences.length > 0
                ? stepConfidences.reduce((a, b) => a + b, 0) / stepConfidences.length
                : 0

            setState(prev => ({
                ...prev,
                status: 'verifying',
                clientScore,
                message: `Client score: ${(clientScore * 100).toFixed(1)}%. Verifying with server...`,
            }))

            // 4. Send frames to server
            const formData = new FormData()
            formData.append('challengeId', challengeId)
            formData.append('clientScore', clientScore.toString())
            for (let j = 0; j < capturedFrames.length && j < 3; j++) {
                formData.append(`frame_${j}`, capturedFrames[j], `frame_${j}.jpg`)
            }

            const verifyHeaders: Record<string, string> = {}
            if (token) verifyHeaders['Authorization'] = `Bearer ${token}`

            const verifyRes = await fetch(`${apiBaseUrl}/enrollment/liveness/verify`, {
                method: 'POST',
                headers: verifyHeaders,
                body: formData,
            })

            const verifyData = await verifyRes.json().catch(() => null)

            if (verifyRes.ok && verifyData) {
                const serverScore = verifyData.score || verifyData.confidence || 0
                const serverPassed = verifyData.passed || verifyData.alive || verifyData.liveness || false
                const passed = clientScore >= 0.75 && serverPassed

                setState(prev => ({
                    ...prev,
                    status: passed ? 'passed' : 'failed',
                    serverScore,
                    message: passed
                        ? `Liveness PASSED! Client: ${(clientScore * 100).toFixed(1)}%, Server: ${(serverScore * 100).toFixed(1)}%`
                        : `Liveness FAILED. Client: ${(clientScore * 100).toFixed(1)}%, Server: ${(serverScore * 100).toFixed(1)}%`,
                }))
            } else {
                setState(prev => ({
                    ...prev,
                    status: 'failed',
                    message: `Server verification failed (${verifyRes.status}). Client score: ${(clientScore * 100).toFixed(1)}%`,
                }))
            }
        } catch (err) {
            setState(prev => ({
                ...prev,
                status: 'error',
                message: formatApiError(err, t) || t('errors.livenessPuzzleError'),
            }))
        }
    }, [waitForAction, captureFrame, t])

    const cancelPuzzle = useCallback(() => {
        abortRef.current = true
        setState(prev => ({ ...prev, status: 'idle', message: 'Cancelled' }))
    }, [])

    const resetPuzzle = useCallback(() => {
        abortRef.current = true
        setState({
            status: 'idle',
            currentStepIndex: -1,
            totalSteps: 0,
            steps: [],
            clientScore: 0,
            serverScore: 0,
            message: '',
            challengeId: null,
        })
    }, [])

    return { state, startPuzzle, cancelPuzzle, resetPuzzle, setLandmarker }
}
