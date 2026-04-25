import { useState, useCallback, useRef } from 'react'
import { detectHeadTurn } from './useLivenessPuzzle'

interface Landmark {
    x: number
    y: number
    z?: number
}

export type BankEnrollmentStatus = 'idle' | 'active' | 'uploading' | 'complete' | 'error'

export interface BankEnrollmentAngle {
    label: string
    direction: 'center' | 'left' | 'right'
    captured: boolean
    imageUrl: string | null
}

export interface BankEnrollmentState {
    status: BankEnrollmentStatus
    currentAngle: number
    totalAngles: number
    angles: BankEnrollmentAngle[]
    message: string
}

const CAPTURE_ANGLES: Array<{ label: string; direction: 'center' | 'left' | 'right' }> = [
    { label: 'Look straight at camera', direction: 'center' },
    { label: 'Turn your head slightly LEFT', direction: 'left' },
    { label: 'Turn your head slightly RIGHT', direction: 'right' },
]

/**
 * useBankEnrollment — Multi-angle face enrollment (front/left/right)
 *
 * Uses FaceLandmarker to detect head orientation, captures frames at each angle,
 * then sends all 3 to the backend (tries multi-enroll, falls back to sequential).
 */
export function useBankEnrollment() {
    const [state, setState] = useState<BankEnrollmentState>({
        status: 'idle',
        currentAngle: -1,
        totalAngles: CAPTURE_ANGLES.length,
        angles: CAPTURE_ANGLES.map(a => ({
            ...a,
            captured: false,
            imageUrl: null,
        })),
        message: '',
    })

    const abortRef = useRef(false)
    const landmarkerRef = useRef<{
        detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
            faceLandmarks: Landmark[][]
        }
    } | null>(null)

    const setLandmarker = useCallback((landmarker: typeof landmarkerRef.current) => {
        landmarkerRef.current = landmarker
    }, [])

    /**
     * Wait for a specific head pose (center/left/right) with 5 consecutive stable frames.
     */
    const waitForPose = useCallback((
        direction: 'center' | 'left' | 'right',
        timeoutMs: number,
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ): Promise<boolean> => {
        return new Promise((resolve) => {
            const startTime = performance.now()
            let stableCount = 0
            const requiredStable = 5

            function check() {
                if (abortRef.current) { resolve(false); return }
                if (performance.now() - startTime > timeoutMs) { resolve(false); return }

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
                        const turn = detectHeadTurn(landmarks)
                        if (turn.direction === direction) {
                            stableCount++
                            if (stableCount >= requiredStable) {
                                resolve(true)
                                return
                            }
                        } else {
                            stableCount = Math.max(0, stableCount - 1)
                        }
                    } else {
                        stableCount = 0
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
     * Capture a full frame, resized to max 640px dimension.
     */
    const captureFrame = useCallback((
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ): Promise<{ blob: Blob | null; dataUrl: string | null }> => {
        return new Promise((resolve) => {
            const video = videoRef.current
            if (!video) { resolve({ blob: null, dataUrl: null }); return }

            const c = document.createElement('canvas')
            const w = video.videoWidth
            const h = video.videoHeight
            const maxDim = 640
            const scale = Math.min(1, maxDim / Math.max(w, h))
            c.width = Math.round(w * scale)
            c.height = Math.round(h * scale)
            const ctx = c.getContext('2d')
            if (!ctx) { resolve({ blob: null, dataUrl: null }); return }
            ctx.drawImage(video, 0, 0, w, h, 0, 0, c.width, c.height)
            const dataUrl = c.toDataURL('image/jpeg', 0.92)
            c.toBlob((blob) => resolve({ blob, dataUrl }), 'image/jpeg', 0.92)
        })
    }, [])

    /**
     * Start the 3-angle bank enrollment flow
     */
    const startEnrollment = useCallback(async (
        userId: string,
        apiBaseUrl: string,
        token: string | null,
        videoRef: React.RefObject<HTMLVideoElement | null>,
    ) => {
        if (!landmarkerRef.current) {
            setState(prev => ({ ...prev, status: 'error', message: 'FaceLandmarker not ready.' }))
            return
        }

        abortRef.current = false
        const capturedBlobs: Blob[] = []
        const updatedAngles = CAPTURE_ANGLES.map(a => ({
            ...a,
            captured: false,
            imageUrl: null as string | null,
        }))

        setState({
            status: 'active',
            currentAngle: 0,
            totalAngles: CAPTURE_ANGLES.length,
            angles: updatedAngles,
            message: '',
        })

        try {
            for (let i = 0; i < CAPTURE_ANGLES.length; i++) {
                if (abortRef.current) break

                const angle = CAPTURE_ANGLES[i]
                setState(prev => ({
                    ...prev,
                    currentAngle: i,
                    message: `Step ${i + 1}/3: ${angle.label}`,
                }))

                const detected = await waitForPose(angle.direction, 10000, videoRef)

                if (detected) {
                    // Brief hold for stability
                    await new Promise(r => setTimeout(r, 300))
                }

                const { blob, dataUrl } = await captureFrame(videoRef)
                if (blob) capturedBlobs.push(blob)

                updatedAngles[i] = {
                    ...updatedAngles[i],
                    captured: true,
                    imageUrl: dataUrl,
                }
                setState(prev => ({
                    ...prev,
                    angles: [...updatedAngles],
                    message: detected
                        ? `Angle ${i + 1} captured!`
                        : `Angle ${i + 1} timed out, captured current frame.`,
                }))

                if (i < CAPTURE_ANGLES.length - 1) {
                    await new Promise(r => setTimeout(r, 1000))
                }
            }

            if (abortRef.current) {
                setState(prev => ({ ...prev, status: 'idle', message: 'Cancelled' }))
                return
            }

            // Upload
            setState(prev => ({
                ...prev,
                status: 'uploading',
                message: `Sending ${capturedBlobs.length} angles for enrollment...`,
            }))

            const headers: Record<string, string> = {}
            if (token) headers['Authorization'] = `Bearer ${token}`

            // Try multi-enroll first
            const formData = new FormData()
            capturedBlobs.forEach((blob, j) => {
                formData.append('files', blob, `angle_${j}.jpg`)
            })

            let success = false
            // apiBaseUrl already includes /api/v1
            const multiRes = await fetch(`${apiBaseUrl}/biometric/enroll/multi/${userId}`, {
                method: 'POST',
                headers,
                body: formData,
            })

            const multiData = await multiRes.json().catch(() => null)
            const multiOk = multiRes.ok && multiData && multiData.success !== false

            if (multiOk) {
                success = true
                setState(prev => ({
                    ...prev,
                    status: 'complete',
                    message: `Multi-angle enrollment complete! ${capturedBlobs.length} angles fused.`,
                }))
            } else {
                // Fallback: sequential single enrolls
                for (let k = 0; k < capturedBlobs.length; k++) {
                    const singleForm = new FormData()
                    singleForm.append('image', capturedBlobs[k], `face_${k}.jpg`)
                    const singleRes = await fetch(`${apiBaseUrl}/biometric/enroll/${userId}`, {
                        method: 'POST',
                        headers,
                        body: singleForm,
                    })
                    if (singleRes.ok) success = true
                }

                setState(prev => ({
                    ...prev,
                    status: success ? 'complete' : 'error',
                    message: success
                        ? 'Bank enrollment complete (sequential mode).'
                        : 'Enrollment failed.',
                }))
            }
        } catch (err) {
            setState(prev => ({
                ...prev,
                status: 'error',
                // eslint-disable-next-line no-restricted-syntax -- hook stores raw message for caller; caller is responsible for formatApiError display
                message: err instanceof Error ? err.message : 'Bank enrollment error',
            }))
        }
    }, [waitForPose, captureFrame])

    const cancelEnrollment = useCallback(() => {
        abortRef.current = true
        setState(prev => ({ ...prev, status: 'idle', message: 'Cancelled' }))
    }, [])

    const resetEnrollment = useCallback(() => {
        abortRef.current = true
        setState({
            status: 'idle',
            currentAngle: -1,
            totalAngles: CAPTURE_ANGLES.length,
            angles: CAPTURE_ANGLES.map(a => ({
                ...a,
                captured: false,
                imageUrl: null,
            })),
            message: '',
        })
    }, [])

    return { state, startEnrollment, cancelEnrollment, resetEnrollment, setLandmarker }
}
