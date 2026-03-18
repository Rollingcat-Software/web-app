import { useState, useCallback, useRef } from 'react'

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
    instruction: string
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

const ACTION_INSTRUCTIONS: Record<string, string> = {
    blink: 'Blink your eyes',
    smile: 'Smile!',
    turn_left: 'Turn your head LEFT',
    turn_right: 'Turn your head RIGHT',
    nod: 'Nod your head down',
    look_up: 'Look up',
    open_mouth: 'Open your mouth wide',
    raise_eyebrows: 'Raise your eyebrows',
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
     * Capture a frame from the video element, cropped to face if landmarks available.
     */
    const captureFrame = useCallback((
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const video = videoRef.current
            if (!video) { resolve(null); return }

            const c = document.createElement('canvas')
            const w = video.videoWidth
            const h = video.videoHeight
            const maxDim = 640
            const scale = Math.min(1, maxDim / Math.max(w, h))
            c.width = Math.round(w * scale)
            c.height = Math.round(h * scale)
            const ctx = c.getContext('2d')
            if (!ctx) { resolve(null); return }
            ctx.drawImage(video, 0, 0, w, h, 0, 0, c.width, c.height)
            c.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
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

            const challengeRes = await fetch(`${apiBaseUrl}/api/v1/enrollment/liveness/challenge`, {
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
                    instruction: ACTION_INSTRUCTIONS[action] || `Perform: ${action}`,
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
                    message: `Step ${i + 1}/${livenessSteps.length}: ${step.instruction}`,
                }))

                const actionResult = await waitForAction(step.action, step.durationMs, videoRef)
                const confidence = actionResult.detected ? 1.0 : 0.3
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
            for (let j = 0; j < capturedFrames.length && j < 3; j++) {
                formData.append(`frame_${j}`, capturedFrames[j], `frame_${j}.jpg`)
            }

            const verifyHeaders: Record<string, string> = {}
            if (token) verifyHeaders['Authorization'] = `Bearer ${token}`

            const verifyRes = await fetch(`${apiBaseUrl}/api/v1/enrollment/liveness/verify`, {
                method: 'POST',
                headers: verifyHeaders,
                body: formData,
            })

            const verifyData = await verifyRes.json().catch(() => null)

            if (verifyRes.ok && verifyData) {
                const serverScore = verifyData.score || verifyData.confidence || 0
                const serverPassed = verifyData.passed || verifyData.alive || verifyData.liveness || false
                const passed = clientScore >= 0.6 && serverPassed

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
                message: err instanceof Error ? err.message : 'Liveness puzzle error',
            }))
        }
    }, [waitForAction, captureFrame])

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
