/**
 * useFaceDetection — Face detection hook for auth capture flow.
 *
 * Strategy: BlazeFace (TF.js, ~1.2MB, on-device) is preferred.
 * Falls back to MediaPipe (CDN, ~5MB WASM) if BlazeFace fails to load.
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

import { useEffect, useRef, useCallback, useState } from 'react'
// Type-only import — the runtime module is loaded lazily inside init() below.
// This keeps @mediapipe/tasks-vision (~137KB uncompressed) off the eager chunk.
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { useBlazeFace } from '../../../lib/ml/useBlazeFace'
import { cropFaceToDataURL } from '../utils/faceCropper'

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

export function useFaceDetection(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    active: boolean,
    recordOperation?: (name: string, durationMs: number) => void,
) {
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
                // Dynamic import defers the ~137KB @mediapipe/tasks-vision module
                // until we actually need the MediaPipe fallback (i.e. BlazeFace failed).
                const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
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

                // Record timing for dev perf overlay
                recordOperation?.('face-detect', result.inferenceTimeMs)

                perfLogCountRef.current++
            }
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithBlazeFace)
    }, [videoRef, blazeFace, recordOperation])

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

            // Record timing for dev perf overlay
            recordOperation?.('face-detect', inferenceMs)

            perfLogCountRef.current++
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithMediaPipe)
    }, [videoRef, recordOperation])

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

    /**
     * Always-client-crop: crops the current face bounding box to a 224×224 JPEG.
     * This eliminates the 200-730ms server-side face detection step because the
     * server receives a tight pre-cropped face instead of a full-resolution frame.
     *
     * The `canvas` parameter is accepted for API compatibility but unused — the
     * crop is performed on an internal offscreen canvas so the output is always
     * exactly 224×224 regardless of the hidden canvas in the DOM.
     *
     * @returns Base64 JPEG data-URL (~8-18KB), or null if no face is detected.
     */
    const cropFace = useCallback(
        (_canvas: HTMLCanvasElement): string | null => {
            const video = videoRef.current
            if (!video || !state.boundingBox) return null

            // Client pre-crops to 224×224 — server detection only as fallback
            return cropFaceToDataURL(video, state.boundingBox, 224, 0.2)
        },
        [videoRef, state.boundingBox]
    )

    return { ...state, cropFace, initialized, initFailed, backend }
}
