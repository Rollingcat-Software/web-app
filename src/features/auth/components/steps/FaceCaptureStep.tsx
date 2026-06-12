import { useState, useRef, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Typography,
} from '@mui/material'
import {
    Face,
    CameraAlt,
    Replay,
    ArrowForward,
    VideocamOff,
    Visibility,
    WbSunny,
    BlurOn,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { NormalizedLandmark } from '../../../../lib/biometric-engine/types'
import { useFaceDetection } from '../../hooks/useFaceDetection'
import { useQualityAssessment } from '../../hooks/useQualityAssessment'
import { usePerf } from '../../../../contexts/PerfContextHook'
import { BiometricEngine } from '../../../../lib/biometric-engine/core/BiometricEngine'
import { dataURLToImageData } from '../../utils/faceCropper'
import { isClientPadAdvisoryEnabled } from '@features/biometrics/pad/clientPadFlag'
import { computeClientPadScore } from '@features/biometrics/pad/computeClientPadScore'
import { scheduleFacenetPrefetch } from '@features/biometrics/embedding/prefetchFacenetModel'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

interface FaceCaptureStepProps {
    /**
     * @param image           The captured (mirror-corrected) face crop data-URL.
     * @param clientEmbedding  Optional legacy landmark-geometry embedding (log-only, D2).
     * @param faceLandmarks    The 478-pt MediaPipe mesh captured WITH this frame, when
     *                         the FaceLandmarker backend was active. Threaded to the
     *                         client-side Facenet512 ALIGNER so probe and template
     *                         share the same canonical alignment. Undefined when the
     *                         active backend has no dense landmarks (BlazeFace fallback).
     * @param clientPadScore   Optional ADVISORY client-side PAD / passive-liveness
     *                         confidence in [0, 1] (SP-D, defense-in-depth). Computed
     *                         from the captured frame ONLY when the advisory flag is on
     *                         and the analyzer succeeds; undefined otherwise. The client
     *                         NEVER gates on it — it is forwarded to the (authoritative)
     *                         server purely as a defense-in-depth signal.
     */
    onSubmit: (
        image: string,
        clientEmbedding?: number[],
        faceLandmarks?: NormalizedLandmark[],
        clientPadScore?: number,
    ) => void | Promise<void>
    loading: boolean
    error?: string
}

export default function FaceCaptureStep({ onSubmit, loading, error }: FaceCaptureStepProps) {
    const { t } = useTranslation()
    const { recordFrame, recordOperation } = usePerf()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [videoReady, setVideoReady] = useState(false)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [cameraError, setCameraError] = useState<string | null>(null)

    // True while the parent `onSubmit` is running its on-device preparation
    // (client-side Facenet512 embed: ~47 MB model download on first use + WASM
    // init + inference) BEFORE the actual /auth/mfa/step verify call. Distinct
    // from `loading` (the in-flight verify owned by the surface's flow): on
    // mobile the embed alone can take seconds, and without this the submit button
    // looks frozen. Surfaced as a "Preparing secure verification…" button state.
    const [preparing, setPreparing] = useState(false)

    // ADVISORY client-side PAD / passive-liveness confidence (0..1) for the
    // captured frame (SP-D). Computed only when the advisory flag is on and the
    // analyzer succeeds; null otherwise. DISPLAY + forward only — the client
    // NEVER gates a login on this (untrusted-client caveat; server decides).
    const [padScore, setPadScore] = useState<number | null>(null)
    const padScoreRef = useRef<number | null>(null)

    // 478-pt mesh captured at the same instant as `capturedImage`, for the
    // client-side aligner. Snapshotted on capture (not read live) so it matches
    // the exact frame the user submits. Null when the backend lacks dense landmarks.
    const capturedLandmarksRef = useRef<NormalizedLandmark[] | null>(null)

    const {
        detected,
        centered,
        hint,
        boundingBox,
        cropFace,
        captureLandmarks,
        backend,
        initialized,
        initFailed,
    } = useFaceDetection(videoRef, cameraActive && !capturedImage, recordOperation)

    // True while the camera is live but the face-detection model (BlazeFace /
    // MediaPipe FaceLandmarker / FaceDetector) is still loading from the CDN.
    // Used to suppress quality chips that would otherwise display values
    // computed from the raw frame before any face localization is available,
    // and to disable the capture button during the load window.
    const modelLoading = cameraActive && !initialized && !initFailed

    const { quality, updateQuality, resetQuality, getScoreColor, getQualityLabel } = useQualityAssessment()

    // Keep latest boundingBox in a ref so the animation-loop closure always
    // sees the current value without retriggering on every detection update.
    const boundingBoxRef = useRef(boundingBox)
    boundingBoxRef.current = boundingBox

    // Run quality assessment in animation loop. Gated on `initialized` so we
    // don't burn CPU computing blur/light/size on raw frames before the
    // detector model finishes loading (those scores would also be misleading
    // to the user since no face localization is available yet).
    useEffect(() => {
        if (!cameraActive || capturedImage || !initialized) return
        let animFrame = 0
        function loop() {
            recordFrame()
            if (videoRef.current && videoRef.current.readyState >= 2) {
                const t0 = performance.now()
                updateQuality(videoRef.current, boundingBoxRef.current ?? undefined)
                recordOperation('quality-assess', performance.now() - t0)
            }
            animFrame = requestAnimationFrame(loop)
        }
        animFrame = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(animFrame)
            resetQuality()
        }
    }, [cameraActive, capturedImage, initialized, updateQuality, resetQuality, recordFrame, recordOperation])

    const startCamera = useCallback(async () => {
        try {
            setCameraError(null)
            setVideoReady(false)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            })
            streamRef.current = stream
            setCameraActive(true)
        } catch {
            setCameraError(t('mfa.face.cameraError'))
        }
    }, [t])

    const stopCamera = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setCameraActive(false)
        setVideoReady(false)
    }, [])

    // Callback ref for the video element — attaches the stream as soon as
    // the element is mounted into the DOM. This is more reliable than
    // useEffect + useRef because it fires exactly when the node appears.
    const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
        // Also keep videoRef in sync for other hooks (useFaceDetection, captureImage)
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node
        if (node && streamRef.current) {
            node.srcObject = streamRef.current
            node.onloadeddata = () => {
                setVideoReady(true)
            }
            node.play().catch(() => {
                // Autoplay blocked — user will tap capture which acts as gesture
            })
        }
    }, [])

    // Auto-start camera on mount
    useEffect(() => {
        startCamera()
        return () => {
            stopCamera()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Warm the Facenet512 model cache as soon as the FACE step mounts (the user
    // is now seconds from capturing). Flag-gated + de-duped inside the helper, so
    // with client-side embedding OFF this is a no-op, and a login surface that
    // already prefetched shares the same in-flight download. On idle (fallback
    // setTimeout) so it never competes with camera start / face-detector load.
    // By submit time the ~47 MB model is cached → the embed is instant instead of
    // a frozen 47 MB-on-submit download. The cleanup cancels a still-pending
    // idle schedule if the step unmounts first.
    useEffect(() => scheduleFacenetPrefetch(), [])

    const captureImage = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        // Guard: video must have actual dimensions (is actually playing)
        const vw = videoRef.current.videoWidth
        const vh = videoRef.current.videoHeight
        if (!vw || !vh) {
            setCameraError(t('mfa.face.cameraError'))
            return
        }

        // Face gate: always crop to 224×224 — never send a full-resolution frame.
        // This eliminates the 200-730ms server-side face detection step.
        // If no face is detected, block the capture and ask the user to re-position.
        if (!detected || !boundingBox) {
            setCameraError(t('mfa.face.noFaceDetected'))
            return
        }

        // Client pre-crops to 224×224 JPEG (<20KB) — server detection only as fallback
        const cropped = cropFace(canvasRef.current)
        if (!cropped) {
            setCameraError(t('mfa.face.cameraError'))
            return
        }

        // Snapshot the dense mesh for THIS frame so the client-side aligner uses the
        // landmarks that match the captured image (not a later live frame).
        capturedLandmarksRef.current = captureLandmarks()

        // ADVISORY PAD / passive-liveness score (SP-D, flag-gated). Run the in-repo
        // passive analyzer on the captured crop and surface the live-confidence to
        // the user. Fire-and-forget + resilient (null on any failure) so the capture
        // is NEVER blocked or delayed by it — this is defense-in-depth display only,
        // not a gate. The score is forwarded to the authoritative server on submit.
        padScoreRef.current = null
        setPadScore(null)
        if (isClientPadAdvisoryEnabled()) {
            void computeClientPadScore(cropped)
                .then((pad) => {
                    if (pad) {
                        padScoreRef.current = pad.score
                        setPadScore(pad.score)
                    }
                })
                .catch(() => {
                    // Non-critical: a failed PAD score just means no advisory shown/sent.
                })
        }

        setCapturedImage(cropped)
        stopCamera()
    }, [stopCamera, detected, boundingBox, cropFace, captureLandmarks, t])

    const retakePhoto = useCallback(() => {
        capturedLandmarksRef.current = null
        padScoreRef.current = null
        setPadScore(null)
        setCapturedImage(null)
        startCamera()
    }, [startCamera])

    const handleSubmit = useCallback(async () => {
        if (!capturedImage) return

        // Attempt client-side landmark-geometry embedding extraction (non-blocking).
        // Produces a 512-dim vector from MediaPipe landmarks (log-only per D2).
        // Returns null when landmarks are unavailable; server computes its own
        // trusted embedding regardless. The field is passed as clientEmbedding
        // to onSubmit — server stores it for offline analysis only.
        let clientEmbedding: number[] | undefined
        try {
            const engine = BiometricEngine.getInstance()
            const computer = engine.embeddingComputer
            if (computer && computer.isAvailable()) {
                const imageData = await dataURLToImageData(capturedImage)
                if (imageData) {
                    const vec = await computer.extract(imageData)
                    if (vec) clientEmbedding = Array.from(vec)
                }
            }
        } catch {
            // Non-critical: embedding extraction failure is silently ignored.
        }

        // Show the "Preparing secure verification…" state for the duration of the
        // parent's onSubmit. When client-side embedding is ON this covers the model
        // download (first use) + ONNX init + inference that happens BEFORE the
        // verify call — so the user sees it is working, not frozen, on mobile. When
        // the flag is OFF, onSubmit returns synchronously (legacy { image } upload)
        // and `preparing` flips on/off within the same tick (no visible flicker).
        setPreparing(true)
        try {
            await onSubmit(
                capturedImage,
                clientEmbedding,
                capturedLandmarksRef.current ?? undefined,
                // ADVISORY ONLY (SP-D): forward the client PAD score if one was
                // computed. undefined when the flag is off or the analyzer failed —
                // the submit is identical to the legacy path in that case.
                padScoreRef.current ?? undefined,
            )
        } finally {
            setPreparing(false)
        }
    }, [capturedImage, onSubmit])

    // Determine bounding box overlay color
    const boxColor = detected
        ? centered
            ? 'rgba(34, 197, 94, 0.8)'   // green - ready
            : 'rgba(250, 204, 21, 0.8)'   // yellow - adjust
        : 'rgba(255, 255, 255, 0.3)'       // white dashed - no face

    const captureReady = detected && centered

    return (
        <StepLayout
            title={t('mfa.face.title')}
            subtitle={t('mfa.face.description')}
            icon={<Face sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)"
            iconShadow="0 8px 32px rgba(139, 92, 246, 0.3)"
        >
            {(error || cameraError) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert
                        severity="error"
                        role="alert"
                        aria-live="polite"
                        sx={{ mb: 2, borderRadius: '12px' }}
                    >
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                            {error || cameraError}
                        </Typography>
                        {/* Retry guidance — lighting / framing tips shown when the server
                            rejects the capture. Keeps the user oriented instead of showing
                            just a bare "Verification failed" with the last frame preview. */}
                        {error && (
                            <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                                • {t('mfa.face.retryTipLighting')}<br />
                                • {t('mfa.face.retryTipFraming')}<br />
                                • {t('mfa.face.retryTipGlasses')}
                            </Typography>
                        )}
                    </Alert>
                </motion.div>
            )}

            {/* Camera / Captured Image Area */}
            <motion.div variants={itemVariants} style={{ overflowX: 'hidden' }}>
                <Box
                    sx={{
                        maxWidth: '100%',
                        width: 360,
                        mx: 'auto',
                        mb: 1,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '2px solid',
                        borderColor: cameraActive
                            ? captureReady
                                ? 'success.main'
                                : 'primary.main'
                            : 'divider',
                        position: 'relative',
                        aspectRatio: '4/3',
                        bgcolor: '#1e293b',
                    }}
                >
                    {/* Hidden canvas for capture */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {capturedImage ? (
                        <Box
                            component="img"
                            src={capturedImage}
                            // Alt text swaps to a retry-oriented label when the
                            // server rejected the capture, so screen-readers do
                            // not announce the same "captured face" label that
                            // conflicts with the "Verification failed" alert.
                            alt={
                                error
                                    ? t('mfa.face.lastAttemptAlt')
                                    : t('mfa.face.capturedAlt')
                            }
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                // Subtle grayscale on failure to visually signal
                                // "this attempt didn't pass — try again".
                                filter: error ? 'grayscale(0.35)' : 'none',
                            }}
                        />
                    ) : cameraActive ? (
                        <>
                            <video
                                ref={videoCallbackRef}
                                autoPlay
                                playsInline
                                muted
                                aria-label={t('faceCapture.videoAriaLabel')}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                            {/* Face bounding box overlay */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    pointerEvents: 'none',
                                }}
                            >
                                {detected && boundingBox ? (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            // Mirror x-coordinate (video is flipped)
                                            right: `${boundingBox.x * 100}%`,
                                            top: `${boundingBox.y * 100}%`,
                                            width: `${boundingBox.width * 100}%`,
                                            height: `${boundingBox.height * 100}%`,
                                            border: `2px solid ${boxColor}`,
                                            borderRadius: '8px',
                                            transition: 'all 0.15s ease',
                                        }}
                                    />
                                ) : (
                                    // Fallback: dashed oval guide when no face detected
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: '60%',
                                                aspectRatio: '3/4',
                                                borderRadius: '50%',
                                                border: '2px dashed rgba(255, 255, 255, 0.5)',
                                            }}
                                        />
                                    </Box>
                                )}
                            </Box>
                        </>
                    ) : (
                        <Box
                            sx={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                color: 'rgba(255, 255, 255, 0.6)',
                            }}
                        >
                            <VideocamOff sx={{ fontSize: 48, mb: 1 }} />
                            <Typography variant="body2" sx={{ color: 'inherit' }}>{t('mfa.face.cameraOff')}</Typography>
                        </Box>
                    )}
                </Box>
            </motion.div>

            {/* Advisory PAD / passive-liveness indicator (SP-D, flag-gated).
                Shown on the captured-image preview when a client-side PAD score
                was computed. This is INFORMATIONAL ONLY — it never gates the
                submit (the authoritative server makes the auth decision); it is
                a defense-in-depth signal surfaced to the user. */}
            {capturedImage && padScore !== null && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        <Chip
                            icon={<Visibility sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.padScore', { score: Math.round(padScore * 100) })}
                            size="small"
                            color={getScoreColor(padScore * 100)}
                            variant="outlined"
                            role="status"
                            aria-live="polite"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                    </Box>
                </motion.div>
            )}

            {/* Quality hint */}
            {cameraActive && !capturedImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'center',
                            mb: 1,
                            color: captureReady ? 'success.main' : 'text.secondary',
                            fontWeight: captureReady ? 600 : 400,
                            transition: 'color 0.2s ease',
                        }}
                    >
                        {t(hint)}
                    </Typography>
                </motion.div>
            )}

            {/* Model loading / load-failed status. Shown while the face
                detection model (BlazeFace / MediaPipe) is still being
                fetched from the CDN — without this, the quality chips
                below would display values that don't reflect any actual
                face localization. */}
            {cameraActive && !capturedImage && (modelLoading || initFailed) && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 1,
                    }}
                >
                    {modelLoading && (
                        <Box
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 1,
                                color: 'text.secondary',
                            }}
                            role="status"
                            aria-live="polite"
                        >
                            <CircularProgress size={16} />
                            <Typography variant="caption">
                                {t('mfa.face.modelLoading')}
                            </Typography>
                        </Box>
                    )}
                    {initFailed && (
                        <Alert
                            severity="warning"
                            sx={{ borderRadius: '12px', width: '100%' }}
                        >
                            {t('mfa.face.modelLoadFailed')}
                        </Alert>
                    )}
                </Box>
            )}

            {/* Quality assessment overlay — only render once the detection
                model has loaded and produced a real backend, otherwise the
                chips would show values computed on raw frames before any
                face has been localized. */}
            {cameraActive && !capturedImage && initialized && backend !== 'none' && quality.overall > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 0.75,
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            mb: 2,
                        }}
                    >
                        <Chip
                            icon={<Visibility sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.quality', { label: t(`mfa.face.qualityLabel.${getQualityLabel(quality.overall)}`), score: quality.overall })}
                            size="small"
                            color={getScoreColor(quality.overall)}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                        <Chip
                            icon={<BlurOn sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.blur', { score: quality.blur })}
                            size="small"
                            color={getScoreColor(quality.blur)}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                        <Chip
                            icon={<WbSunny sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.light', { score: quality.lighting })}
                            size="small"
                            color={getScoreColor(quality.lighting)}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                        {quality.faceSizeScore > 0 && (
                            <Chip
                                icon={<Face sx={{ fontSize: 14 }} />}
                                label={t('mfa.face.size', { score: quality.faceSizeScore })}
                                size="small"
                                color={getScoreColor(quality.faceSizeScore)}
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 24 }}
                            />
                        )}
                        {/* backend !== 'none' is already guarded by the outer
                            block — TS narrows it away here. */}
                        <Chip
                            label={
                                backend === 'blazeface'
                                    ? t('faceCapture.backend.blazeface')
                                    : t('faceCapture.backend.mediapipe')
                            }
                            size="small"
                            color={backend === 'blazeface' ? 'success' : 'info'}
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 24 }}
                        />
                    </Box>
                </motion.div>
            )}

            {/* Actions */}
            <motion.div variants={itemVariants}>
                {!cameraActive && !capturedImage && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={startCamera}
                        disabled={loading}
                        startIcon={<CameraAlt />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {t('mfa.face.startCamera')}
                    </Button>
                )}

                {cameraActive && !capturedImage && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={captureImage}
                        disabled={loading || !videoReady || modelLoading}
                        startIcon={<CameraAlt />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: captureReady
                                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: captureReady
                                ? '0 10px 40px rgba(34, 197, 94, 0.4)'
                                : '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: captureReady
                                    ? 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)'
                                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {t('mfa.face.capturePhoto')}
                    </Button>
                )}

                {capturedImage && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            size="large"
                            onClick={retakePhoto}
                            disabled={loading || preparing}
                            startIcon={<Replay />}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                            }}
                        >
                            {t('mfa.face.retake')}
                        </Button>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleSubmit}
                            disabled={loading || preparing}
                            endIcon={!loading && !preparing && <ArrowForward />}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                },
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {/* `preparing` = on-device prep (client-side embed: model
                                download + ONNX init + inference) BEFORE the verify
                                call; `loading` = the in-flight verify. Both show a
                                spinner; `preparing` adds a status line so the user
                                knows the (potentially multi-second, mobile) embed is
                                working, not frozen. */}
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: 'white' }} />
                            ) : preparing ? (
                                <Box
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                    role="status"
                                    aria-live="polite"
                                >
                                    <CircularProgress size={20} sx={{ color: 'white' }} />
                                    {t('mfa.face.preparingSecure')}
                                </Box>
                            ) : (
                                t('mfa.face.submit')
                            )}
                        </Button>
                    </Box>
                )}
            </motion.div>
        </StepLayout>
    )
}
