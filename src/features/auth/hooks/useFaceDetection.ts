/**
 * useFaceDetection — Face detection hook for auth capture flow.
 *
 * Strategy:
 *   PRIMARY   — BiometricEngine.getInstance().faceDetector (MediaPipe FaceLandmarker, 478pt)
 *               Active once the engine has been initialized by a parent component.
 *   SECONDARY — BlazeFace (TF.js, ~1.2MB, on-device). Used while the engine is still loading.
 *   FALLBACK  — MediaPipe FaceDetector (CDN, blaze_face_short_range). Used if BlazeFace fails.
 *
 * Head-pose hint: when FaceLandmarker is active, yaw is computed via HeadPoseEstimator.
 * If |yaw| > 25° the user is prompted to look straight ('faceDetection.lookStraight').
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase F2-5
 */

import { useEffect, useRef, useCallback, useState } from 'react'
// Type-only import — the runtime module is loaded lazily inside init() below.
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { useBlazeFace } from '../../../lib/ml/useBlazeFace'
import { cropFaceToDataURL } from '../utils/faceCropper'
import { BiometricEngine } from '../../../lib/biometric-engine/core/BiometricEngine'
import { MEDIAPIPE_WASM_URL } from '../../../config/cdn'

export type DetectionBackend = 'blazeface' | 'mediapipe' | 'mediapipe-landmarker' | 'none'

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

/** Yaw threshold (degrees) beyond which the user is prompted to look straight. */
const YAW_STRAIGHT_THRESHOLD = 25

export function useFaceDetection(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    active: boolean,
    recordOperation?: (name: string, durationMs: number) => void,
) {
    // --- MediaPipe FaceDetector fallback state ---
    const mpDetectorRef = useRef<FaceDetector | null>(null)
    const animFrameRef = useRef<number>(0)
    const [state, setState] = useState<FaceDetectionState>(INITIAL_STATE)
    const [initialized, setInitialized] = useState(false)
    const [initFailed, setInitFailed] = useState(false)
    const [backend, setBackend] = useState<DetectionBackend>('none')

    // --- BlazeFace (secondary) ---
    const blazeFace = useBlazeFace(active)

    // Performance logging refs
    const perfLogCountRef = useRef(0)
    const mediapipeTimingsRef = useRef<number[]>([])

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 1: BiometricEngine FaceLandmarker (478pt)
    // Poll every 500ms until the engine is ready. Once ready, switch backend.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!active) return

        // Check immediately in case engine was already initialized
        const checkEngine = () => {
            const engine = BiometricEngine.getInstance()
            if (engine.isReady() && engine.faceDetector.isAvailable()) {
                setBackend('mediapipe-landmarker')
                setInitialized(true)
                return true
            }
            return false
        }

        if (checkEngine()) return

        // Engine not ready yet — start it and poll
        const engine = BiometricEngine.getInstance()
        let cancelled = false

        engine.initialize().then(() => {
            if (!cancelled && engine.isReady() && engine.faceDetector.isAvailable()) {
                setBackend('mediapipe-landmarker')
                setInitialized(true)
            }
        }).catch(() => {
            // Engine init failed — BlazeFace / MediaPipe fallbacks will take over
        })

        return () => { cancelled = true }
    }, [active])

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 2: BlazeFace (when engine not yet ready)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (blazeFace.isReady && active && backend === 'none') {
            setBackend('blazeface')
            setInitialized(true)
        }
    }, [blazeFace.isReady, active, backend])

    // Promote to FaceLandmarker if engine becomes ready while BlazeFace is running
    useEffect(() => {
        if (backend !== 'blazeface' && backend !== 'mediapipe') return
        const engine = BiometricEngine.getInstance()
        if (engine.isReady() && engine.faceDetector.isAvailable()) {
            setBackend('mediapipe-landmarker')
        }
    }, [backend])

    // ─────────────────────────────────────────────────────────────────────────
    // Priority 3: MediaPipe FaceDetector (CDN fallback if BlazeFace fails)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!active || blazeFace.isLoading || blazeFace.isReady) return
        if (!blazeFace.error) return

        // BlazeFace failed — fall back to MediaPipe FaceDetector (short-range)
        console.warn('[FaceDetection] BlazeFace failed, falling back to MediaPipe:', blazeFace.error)

        let cancelled = false
        setInitFailed(false)

        async function init() {
            try {
                const { FaceDetector: MPFaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
                const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL)
                if (cancelled) return

                const detector = await MPFaceDetector.createFromOptions(vision, {
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

    // ─────────────────────────────────────────────────────────────────────────
    // Detection loop: FaceLandmarker (primary)
    // ─────────────────────────────────────────────────────────────────────────
    const detectWithFaceLandmarker = useCallback(() => {
        const video = videoRef.current
        if (!video || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(detectWithFaceLandmarker)
            return
        }

        try {
            const engine = BiometricEngine.getInstance()
            const faceDetector = engine.faceDetector
            const headPoseEstimator = engine.headPoseEstimator

            if (!faceDetector.isAvailable()) {
                animFrameRef.current = requestAnimationFrame(detectWithFaceLandmarker)
                return
            }

            const t0 = performance.now()
            const detections = faceDetector.detect(video, performance.now())
            const inferenceMs = performance.now() - t0

            if (!detections || detections.length === 0) {
                setState({ ...INITIAL_STATE, hint: 'faceDetection.noFace' })
            } else {
                const face = detections[0]
                const bb = face.boundingBox // pixel coordinates

                const vw = video.videoWidth
                const vh = video.videoHeight

                // Normalize bounding box to 0-1 range for API compatibility
                const normX = bb.x / vw
                const normY = bb.y / vh
                const normW = bb.width / vw
                const normH = bb.height / vh

                const faceCenterX = normX + normW / 2
                const faceCenterY = normY + normH / 2

                const centered =
                    Math.abs(faceCenterX - 0.5) < 0.2 &&
                    Math.abs(faceCenterY - 0.5) < 0.25

                const tooClose = normW > 0.65
                const tooFar = normW < 0.15

                // Head pose from 478-point landmarks
                let hint = 'faceDetection.perfect'
                if (tooFar) {
                    hint = 'faceDetection.moveCloser'
                } else if (tooClose) {
                    hint = 'faceDetection.moveFurther'
                } else if (!centered) {
                    hint = 'faceDetection.centerFace'
                } else if (face.pixelLandmarks && face.pixelLandmarks.length >= 468 && headPoseEstimator?.isAvailable()) {
                    // Use HeadPoseEstimator to detect non-frontal head pose
                    const pose = headPoseEstimator.estimate(
                        face.pixelLandmarks,
                        { width: vw, height: vh },
                    )
                    if (Math.abs(pose.yaw) > YAW_STRAIGHT_THRESHOLD) {
                        hint = 'faceChallenge.lookStraight'
                    }
                }

                setState({
                    detected: true,
                    centered,
                    tooClose,
                    tooFar,
                    hint,
                    confidence: face.confidence,
                    boundingBox: {
                        x: normX,
                        y: normY,
                        width: normW,
                        height: normH,
                    },
                })

                recordOperation?.('face-detect', inferenceMs)
                perfLogCountRef.current++
            }
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithFaceLandmarker)
    }, [videoRef, recordOperation])

    // ─────────────────────────────────────────────────────────────────────────
    // Detection loop: BlazeFace (secondary)
    // ─────────────────────────────────────────────────────────────────────────
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

                recordOperation?.('face-detect', result.inferenceTimeMs)
                perfLogCountRef.current++
            }
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithBlazeFace)
    }, [videoRef, blazeFace, recordOperation])

    // ─────────────────────────────────────────────────────────────────────────
    // Detection loop: MediaPipe FaceDetector fallback
    // ─────────────────────────────────────────────────────────────────────────
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

            recordOperation?.('face-detect', inferenceMs)
            perfLogCountRef.current++
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detectWithMediaPipe)
    }, [videoRef, recordOperation])

    // ─────────────────────────────────────────────────────────────────────────
    // Start the appropriate detection loop when backend/initialized changes
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!active || !initialized) return

        perfLogCountRef.current = 0

        if (backend === 'mediapipe-landmarker') {
            animFrameRef.current = requestAnimationFrame(detectWithFaceLandmarker)
        } else if (backend === 'blazeface') {
            animFrameRef.current = requestAnimationFrame(detectWithBlazeFace)
        } else if (backend === 'mediapipe' && mpDetectorRef.current) {
            animFrameRef.current = requestAnimationFrame(detectWithMediaPipe)
        }

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
            }
        }
    }, [active, initialized, backend, detectWithFaceLandmarker, detectWithBlazeFace, detectWithMediaPipe])

    // Cleanup on unmount
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
     * The `canvas` parameter is accepted for API compatibility but unused.
     *
     * @returns Base64 JPEG data-URL (~8-18KB), or null if no face is detected.
     */
    const cropFace = useCallback(
        (_canvas: HTMLCanvasElement): string | null => {
            const video = videoRef.current
            if (!video || !state.boundingBox) return null

            return cropFaceToDataURL(video, state.boundingBox, 224, 0.2)
        },
        [videoRef, state.boundingBox]
    )

    return { ...state, cropFace, initialized, initFailed, backend }
}
