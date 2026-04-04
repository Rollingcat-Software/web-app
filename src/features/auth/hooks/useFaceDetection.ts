import { useEffect, useRef, useCallback, useState } from 'react'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

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
    hint: 'Position your face in the frame',
    confidence: 0,
    boundingBox: null,
}

export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
    const detectorRef = useRef<FaceDetector | null>(null)
    const animFrameRef = useRef<number>(0)
    const [state, setState] = useState<FaceDetectionState>(INITIAL_STATE)

    useEffect(() => {
        if (!active) return

        let cancelled = false

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
                detectorRef.current = detector
            } catch (e) {
                console.warn('[FaceDetection] MediaPipe init failed, falling back to full-frame capture', e)
            }
        }

        init()

        return () => {
            cancelled = true
            if (detectorRef.current) {
                detectorRef.current.close()
                detectorRef.current = null
            }
        }
    }, [active])

    const detect = useCallback(() => {
        const video = videoRef.current
        const detector = detectorRef.current

        if (!video || !detector || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(detect)
            return
        }

        try {
            const result = detector.detectForVideo(video, performance.now())
            const detections = result.detections

            if (!detections || detections.length === 0) {
                setState({
                    ...INITIAL_STATE,
                    hint: 'No face detected — look at the camera',
                })
            } else {
                const face = detections[0]
                const bb = face.boundingBox
                if (!bb) {
                    setState({ ...INITIAL_STATE, hint: 'No face detected' })
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

                    let hint = 'Perfect — hold steady'
                    if (tooFar) hint = 'Move closer to the camera'
                    else if (tooClose) hint = 'Move further from the camera'
                    else if (!centered) hint = 'Center your face in the frame'

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
        } catch {
            // Detection frame error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(detect)
    }, [videoRef])

    useEffect(() => {
        if (active && detectorRef.current) {
            animFrameRef.current = requestAnimationFrame(detect)
        }

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
            }
        }
    }, [active, detect])

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

    return { ...state, cropFace }
}
