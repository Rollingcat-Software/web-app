/**
 * useFaceDetection — Face detection hook for auth capture flow.
 *
 * Strategy: BlazeFace (TF.js, ~1.2MB, on-device) is preferred.
 * Falls back to MediaPipe (CDN, ~5MB WASM) if BlazeFace fails to load.
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { useBlazeFace } from '../../../lib/ml/useBlazeFace'

export type DetectionBackend = 'blazeface' | 'mediapipe' | 'none'

export interface FaceDetectionState {
    detected: boolean
    centered: boolean
    tooClose: boolean
    tooFar: boolean
    hint: string
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number } | null
}

const INITIAL_STATE: FaceDetectionState = {
    detected: false,
    centered: false,
    tooClose: false,
    tooFar: false,
    hint: 'faceDetection.positionFace',
    confidence: 0,
    boundingBox: null,
}

export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
    // --- MediaPipe state (fallback) ---
    const mpDetectorRef = useRef<FaceDetector | null>(null)
    const animFrameRef = useRef<number>(0)
    const [state, setState] = useState<FaceDetectionState>(INITIAL_STATE)
    const [initialized, setInitialized] = useState(false)
    const [initFailed, setInitFailed] = useState(false)
    const [backend, setBackend] = useState<DetectionBackend>('none')

    // --- BlazeFace (primary) ---
    const blazeFace = useBlazeFace(active)

    // Performance logging refs
    const perfLogCountRef = useRef(0)
    const mediapipeTimingsRef = useRef<number[]>([])

    // When BlazeFace is ready, mark it as the active backend
    useEffect(() => {
        if (blazeFace.isReady && active) {
            setBackend('blazeface')
            setInitialized(true)
            // eslint-disable-next-line no-console
            console.info('[FaceDetection] Using BlazeFace backend (on-device TF.js)')
        }
    }, [blazeFace.isReady, active])

    // Fall back to MediaPipe if BlazeFace fails
    useEffect(() => {
        if (!active || blazeFace.isLoading || blazeFace.isReady) return
        if (!blazeFace.error) return // Still trying

        // BlazeFace failed — initialize MediaPipe as fallback
        console.warn('[FaceDetection] BlazeFace failed, falling back to MediaPipe:', blazeFace.error)

        let cancelled = false
        setInitFailed(false)

        async function init() {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                )
                if (cancelled) return

                const detector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    minDetectionConfidence: 0.5,
                })
                if (cancelled) {
                    detector.close()
                    return
                }
                mpDetectorRef.current = detector
                setBackend('mediapipe')
                setInitialized(true)
                // eslint-disable-next-line no-console
                console.info('[FaceDetection] Using MediaPipe backend (CDN fallback)')
            } catch (e) {
                console.warn('[FaceDetection] MediaPipe init also failed', e)
                setInitFailed(true)
            }
        }

        init()

        return () => {
            cancelled = true
            if (mpDetectorRef.current) {
                mpDetectorRef.current.close()
                mpDetectorRef.current = null
            }
        }
    }, [active, blazeFace.isLoading, blazeFace.isReady, blazeFace.error])

    // --- BlazeFace detection loop ---
    const detectWithBlazeFace = useCallback(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(detectWithBlazeFace)
            return
        }

        try {
            const result = await blazeFace.detect(video)
            if (!result || !result.detected || result.faces.length === 0) {
                setState({
                    ...INITIAL_STATE,
                    hint: 'faceDetection.noFace',
                })
            } else {
                const face = result.faces[0]
                const bb = face.boundingBox

                const faceCenterX = (bb.x + bb.width / 2)
                const faceCenterY = (bb.y + bb.height / 2)

                const centered =
                    Math.abs(faceCenterX - 0.5) < 0.2 &&
                    Math.abs(faceCenterY - 0.5) < 0.25

                const tooClose = bb.width > 0.65
                const tooFar = bb.width < 0.15

                let hint = 'faceDetection.perfect'
                if (tooFar) hint = 'faceDetection.moveCloser'
                else if (tooClose) hint = 'faceDetection.moveFurther'
                else if (!centered) hint = 'faceDetection.centerFace'

                setState({
                    detected: true,
                    centered,
                    tooClose,
                    tooFar,
                    hint,
                    confidence: face.confidence,
                    boundingBox: {
                        x: bb.x,
                        y: bb.y,
                        width: bb.width,
                        height: bb.height,
                    },
                })

                // Performance logging: log every 60 frames (~2 seconds)
                perfLogCountRef.current++
                if (perfLogCountRef.current % 60 === 0) {
                    // eslint-disable-next-line no-console
                    console.debug(`[FaceDetection] BlazeFace avg: ${blazeFace.avgInferenceMs}ms | last: ${result.inferenceTimeMs.toFixed(1)}ms | faces: ${result.faces.length}`)
                }
            }
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithBlazeFace)
    }, [videoRef, blazeFace])

    // --- MediaPipe detection loop (fallback) ---
    const detectWithMediaPipe = useCallback(() => {
        const video = videoRef.current
        const detector = mpDetectorRef.current

        if (!video || !detector || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(detectWithMediaPipe)
            return
        }

        try {
            const t0 = performance.now()
            const result = detector.detectForVideo(video, performance.now())
            const inferenceMs = performance.now() - t0
            const detections = result.detections

            // Track MediaPipe timings for comparison
            const mpTimings = mediapipeTimingsRef.current
            mpTimings.push(inferenceMs)
            if (mpTimings.length > 30) mpTimings.shift()

            if (!detections || detections.length === 0) {
                setState({
                    ...INITIAL_STATE,
                    hint: 'faceDetection.noFace',
                })
            } else {
                const face = detections[0]
                const bb = face.boundingBox
                if (!bb) {
                    setState({ ...INITIAL_STATE, hint: 'faceDetection.noFace' })
                } else {
                    const vw = video.videoWidth
                    const vh = video.videoHeight
                    const faceCenterX = bb.originX + bb.width / 2
                    const faceCenterY = bb.originY + bb.height / 2
                    const faceRatio = bb.width / vw

                    const centered =
                        Math.abs(faceCenterX / vw - 0.5) < 0.2 &&
                        Math.abs(faceCenterY / vh - 0.5) < 0.25

                    const tooClose = faceRatio > 0.65
                    const tooFar = faceRatio < 0.15

                    let hint = 'faceDetection.perfect'
                    if (tooFar) hint = 'faceDetection.moveCloser'
                    else if (tooClose) hint = 'faceDetection.moveFurther'
                    else if (!centered) hint = 'faceDetection.centerFace'

                    const confidence = face.categories?.[0]?.score ?? 0

                    setState({
                        detected: true,
                        centered,
                        tooClose,
                        tooFar,
                        hint,
                        confidence,
                        boundingBox: {
                            x: bb.originX / vw,
                            y: bb.originY / vh,
                            width: bb.width / vw,
                            height: bb.height / vh,
                        },
                    })
                }
            }

            // Performance logging
            perfLogCountRef.current++
            if (perfLogCountRef.current % 60 === 0) {
                const avg = mpTimings.reduce((s, t) => s + t, 0) / mpTimings.length
                // eslint-disable-next-line no-console
                console.debug(`[FaceDetection] MediaPipe avg: ${avg.toFixed(1)}ms | last: ${inferenceMs.toFixed(1)}ms`)
            }
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithMediaPipe)
    }, [videoRef])

    // --- Start the appropriate detection loop ---
    useEffect(() => {
        if (!active || !initialized) return

        perfLogCountRef.current = 0

        if (backend === 'blazeface') {
            animFrameRef.current = requestAnimationFrame(detectWithBlazeFace)
        } else if (backend === 'mediapipe' && mpDetectorRef.current) {
            animFrameRef.current = requestAnimationFrame(detectWithMediaPipe)
        }

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
            }
        }
    }, [active, initialized, backend, detectWithBlazeFace, detectWithMediaPipe])

    // --- Cleanup on unmount ---
    useEffect(() => {
        return () => {
            if (mpDetectorRef.current) {
                mpDetectorRef.current.close()
                mpDetectorRef.current = null
            }
        }
    }, [])

    const cropFace = useCallback(
        (canvas: HTMLCanvasElement): string | null => {
            const video = videoRef.current
            if (!video || !state.boundingBox) return null

            const vw = video.videoWidth
            const vh = video.videoHeight
            const bb = state.boundingBox

            // Add 30% padding around the face
            const padding = 0.3
            const rawX = bb.x * vw
            const rawY = bb.y * vh
            const rawW = bb.width * vw
            const rawH = bb.height * vh

            const padW = rawW * padding
            const padH = rawH * padding
            const cropX = Math.max(0, rawX - padW)
            const cropY = Math.max(0, rawY - padH)
            const cropW = Math.min(vw - cropX, rawW + padW * 2)
            const cropH = Math.min(vh - cropY, rawH + padH * 2)

            canvas.width = cropW
            canvas.height = cropH

            const ctx = canvas.getContext('2d')
            if (!ctx) return null

            // Mirror for selfie (video is mirrored via CSS)
            ctx.translate(canvas.width, 0)
            ctx.scale(-1, 1)
            ctx.drawImage(
                video,
                cropX, cropY, cropW, cropH,
                0, 0, cropW, cropH
            )

            return canvas.toDataURL('image/jpeg', 0.85)
        },
        [videoRef, state.boundingBox]
    )

    return { ...state, cropFace, initialized, initFailed, backend }
}
