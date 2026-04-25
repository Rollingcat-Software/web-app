/**
 * useHandLandmarker
 *
 * Lazy-loaded MediaPipe HandLandmarker hook for the biometric-puzzles
 * surface. Mirrors the lifecycle of `useFaceDetection` (state machine:
 * idle → loading → ready / error) but is scoped to the puzzles page so
 * we don't pay the ~5MB WASM bill on /login or other auth surfaces.
 *
 * The model + WASM are pulled from jsdelivr/storage.googleapis.com,
 * both already on the CSP allowlist (`script-src` and `connect-src` —
 * see `public/.htaccess`).
 */
import { useEffect, useRef, useState } from 'react'
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'

const VISION_WASM_URL =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const HAND_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export interface UseHandLandmarkerReturn {
    isReady: boolean
    isLoading: boolean
    error: string | null
    /** Detect for a video frame. Returns null when not ready. */
    detect: (video: HTMLVideoElement, ts: number) => HandLandmarkerResult | null
}

export function useHandLandmarker(active: boolean): UseHandLandmarkerReturn {
    const [isReady, setIsReady] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const landmarkerRef = useRef<HandLandmarker | null>(null)

    useEffect(() => {
        if (!active) return

        let cancelled = false
        let landmarker: HandLandmarker | null = null

        const init = async () => {
            try {
                setIsLoading(true)
                setError(null)
                const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
                const filesetResolver = await FilesetResolver.forVisionTasks(VISION_WASM_URL)
                if (cancelled) return

                try {
                    landmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: HAND_MODEL_URL,
                            delegate: 'GPU',
                        },
                        runningMode: 'VIDEO',
                        numHands: 1,
                        minHandDetectionConfidence: 0.5,
                        minHandPresenceConfidence: 0.5,
                        minTrackingConfidence: 0.5,
                    })
                } catch {
                    landmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: HAND_MODEL_URL,
                            delegate: 'CPU',
                        },
                        runningMode: 'VIDEO',
                        numHands: 1,
                        minHandDetectionConfidence: 0.5,
                        minHandPresenceConfidence: 0.5,
                        minTrackingConfidence: 0.5,
                    })
                }
                if (cancelled) {
                    landmarker.close()
                    landmarker = null
                    return
                }
                landmarkerRef.current = landmarker
                setIsReady(true)
                setIsLoading(false)
            } catch (e) {
                if (cancelled) return
                setError(e instanceof Error ? e.message : 'HandLandmarker init failed')
                setIsLoading(false)
            }
        }

        init()

        return () => {
            cancelled = true
            if (landmarkerRef.current) {
                landmarkerRef.current.close()
                landmarkerRef.current = null
            }
            setIsReady(false)
        }
    }, [active])

    const detect = (video: HTMLVideoElement, ts: number): HandLandmarkerResult | null => {
        const lm = landmarkerRef.current
        if (!lm || !video || video.readyState < 2) return null
        try {
            return lm.detectForVideo(video, ts)
        } catch {
            return null
        }
    }

    return { isReady, isLoading, error, detect }
}
