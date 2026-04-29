/**
 * FaceDemoPage — Public showcase of FIVUCSAS face capabilities.
 *
 * Walks visitors through 7 sections:
 *   1. Face detection (BlazeFace + FaceLandmarker)
 *   2. 478-point landmark mesh
 *   3. Head pose (yaw/pitch — roll is shown as "—" because the geometric
 *      estimator only computes yaw/pitch; the i18n key is kept for future
 *      solvePnP migration)
 *   4. Passive client-side liveness (5-component scoring)
 *   5. Server anti-spoofing (auth-gated, degrades gracefully)
 *   6. Quality assessment chips (blur / lighting / size / overall)
 *   7. Embedding visualization (educational deterministic sample)
 *
 * Route: /face-demo (public, bypasses ProtectedRoute).
 * Strings: face_demo.* in en.json + tr.json.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Stack,
    Switch,
    Typography,
    LinearProgress,
    Alert,
} from '@mui/material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import { useBiometricEngine } from '../lib/biometric-engine/hooks/useBiometricEngine'
import { useFaceDetection } from '../lib/biometric-engine/hooks/useFaceDetection'
import { useAuth } from '../features/auth/hooks/useAuth'
import { getBiometricService } from '@core/services/BiometricService'
import {
    FACE_CONTOUR,
    LEFT_EYE_OUTLINE,
    RIGHT_EYE_OUTLINE,
    LIPS_OUTER,
    NOSE,
    LEFT_EYEBROW_OUTLINE,
    RIGHT_EYEBROW_OUTLINE,
} from '../lib/biometric-engine/core/constants'
import type { TrackedFace } from '../lib/biometric-engine/types'
import { formatApiError } from '@/utils/formatApiError'

// ---------------------------------------------------------------------------
// Visual primitives
// ---------------------------------------------------------------------------

const HERO_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)'

interface DemoSectionProps {
    index: number
    total: number
    title: string
    subtitle: string
    description: string
    badge: string
    children: React.ReactNode
}

function DemoSection({ index, total, title, subtitle, description, badge, children }: DemoSectionProps) {
    const { t } = useTranslation()
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            <Card
                sx={{
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.96)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 12px 32px -10px rgba(80, 60, 130, 0.25)',
                    overflow: 'hidden',
                }}
            >
                <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                        <Chip
                            size="small"
                            label={`${t('face_demo.section_label')} ${t('face_demo.section_index', { index, total })}`}
                            sx={{
                                background: HERO_GRADIENT,
                                color: '#fff',
                                fontWeight: 600,
                            }}
                        />
                        <Chip size="small" variant="outlined" label={badge} />
                    </Stack>
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {subtitle}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2.5, color: '#3a3a52' }}>
                        {description}
                    </Typography>
                    <Box>{children}</Box>
                </CardContent>
            </Card>
        </motion.div>
    )
}

interface MetricChipProps {
    label: string
    value: string
    tone?: 'default' | 'success' | 'warning' | 'error'
}

function MetricChip({ label, value, tone = 'default' }: MetricChipProps) {
    const colors: Record<string, { bg: string; fg: string }> = {
        default: { bg: '#eef0fb', fg: '#1a1a2e' },
        success: { bg: '#dcfce7', fg: '#166534' },
        warning: { bg: '#fef3c7', fg: '#92400e' },
        error: { bg: '#fee2e2', fg: '#991b1b' },
    }
    const c = colors[tone]
    return (
        <Box
            sx={{
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: c.bg,
                color: c.fg,
                minWidth: 96,
                textAlign: 'center',
            }}
        >
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 500 }}>
                {label}
            </Typography>
            <Typography variant="body1" fontWeight={700}>
                {value}
            </Typography>
        </Box>
    )
}

function scoreTone(score: number): 'success' | 'warning' | 'error' {
    if (score >= 65) return 'success'
    if (score >= 40) return 'warning'
    return 'error'
}

// ---------------------------------------------------------------------------
// Mesh overlay
// ---------------------------------------------------------------------------

const MESH_CONNECTIONS: ReadonlyArray<readonly number[]> = [
    FACE_CONTOUR,
    LEFT_EYE_OUTLINE,
    RIGHT_EYE_OUTLINE,
    LIPS_OUTER,
    NOSE,
    LEFT_EYEBROW_OUTLINE,
    RIGHT_EYEBROW_OUTLINE,
]

interface MeshOverlayProps {
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
    videoRef: React.RefObject<HTMLVideoElement | null>
    primaryFace: TrackedFace | null
    showMesh: boolean
    showBox: boolean
}

function MeshOverlay({ canvasRef, videoRef, primaryFace, showMesh, showBox }: MeshOverlayProps) {
    useEffect(() => {
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const w = video.videoWidth || canvas.width
        const h = video.videoHeight || canvas.height
        if (canvas.width !== w) canvas.width = w
        if (canvas.height !== h) canvas.height = h

        ctx.clearRect(0, 0, w, h)
        if (!primaryFace) return

        // Bounding box
        if (showBox) {
            const bb = primaryFace.detection.boundingBox
            ctx.strokeStyle = '#22d3ee'
            ctx.lineWidth = 3
            ctx.strokeRect(bb.x, bb.y, bb.width, bb.height)
        }

        // Mesh
        if (showMesh) {
            const lms = primaryFace.detection.pixelLandmarks
            if (lms && lms.length > 0) {
                ctx.fillStyle = 'rgba(118, 75, 162, 0.7)'
                for (const lm of lms) {
                    ctx.beginPath()
                    ctx.arc(lm.x, lm.y, 1.2, 0, Math.PI * 2)
                    ctx.fill()
                }
                ctx.strokeStyle = 'rgba(246, 79, 89, 0.85)'
                ctx.lineWidth = 1.2
                for (const conn of MESH_CONNECTIONS) {
                    ctx.beginPath()
                    for (let i = 0; i < conn.length; i++) {
                        const idx = conn[i]
                        if (idx >= lms.length) continue
                        const p = lms[idx]
                        if (i === 0) ctx.moveTo(p.x, p.y)
                        else ctx.lineTo(p.x, p.y)
                    }
                    ctx.stroke()
                }
            }
        }
    }, [canvasRef, videoRef, primaryFace, showMesh, showBox])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                transform: 'scaleX(-1)', // mirror to match the mirrored video
            }}
        />
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TOTAL_SECTIONS = 7

export default function FaceDemoPage() {
    const { t } = useTranslation()
    const auth = useAuth()
    const isAuthenticated = auth?.isAuthenticated ?? false

    // Engine + detection
    const { engine, isLoading: engineLoading } = useBiometricEngine()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [cameraOn, setCameraOn] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [showMesh, setShowMesh] = useState(true)

    const detectionActive = cameraOn && !!engine
    const { primaryFace, fps } = useFaceDetection(engine, videoRef, detectionActive)

    // ---- Camera lifecycle ----
    const startCamera = useCallback(async () => {
        setCameraError(null)
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            })
            streamRef.current = mediaStream
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
                await videoRef.current.play().catch(() => {
                    /* play() may be interrupted by a stop; non-fatal */
                })
            }
            setCameraOn(true)
        } catch {
            setCameraError(t('face_demo.hero.camera_blocked'))
            setCameraOn(false)
        }
    }, [t])

    const stopCamera = useCallback(() => {
        const stream = streamRef.current
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) videoRef.current.srcObject = null
        setCameraOn(false)
    }, [])

    useEffect(() => () => stopCamera(), [stopCamera])

    // ---- Backend label ----
    const detectionBackend = useMemo(() => {
        // The lib FaceDetector is MediaPipe FaceLandmarker by default; if the
        // engine isn't ready yet, surface BlazeFace as the fallback hint so the
        // copy stays accurate in the UI.
        if (engineLoading) return 'BlazeFace (loading FaceLandmarker)'
        if (!engine) return '—'
        return 'MediaPipe FaceLandmarker (478 pt)'
    }, [engine, engineLoading])

    // ---- Section 5: server liveness ----
    const [serverLivenessState, setServerLivenessState] = useState<{
        loading: boolean
        verdict: 'real' | 'spoof' | null
        message: string | null
        confidence: number | null
        error: string | null
    }>({ loading: false, verdict: null, message: null, confidence: null, error: null })

    const runServerLiveness = useCallback(async () => {
        if (!videoRef.current) return
        const video = videoRef.current
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

        setServerLivenessState({ loading: true, verdict: null, message: null, confidence: null, error: null })
        try {
            // searchFace travels through the proxy; the server pipeline runs the
            // detector + anti-spoof + liveness. We don't care about the match,
            // only that the server accepted the frame as real (no spoof error).
            const svc = getBiometricService()
            const res = await svc.searchFace(dataUrl)
            setServerLivenessState({
                loading: false,
                verdict: 'real',
                message: res.found
                    ? `Match confidence ${(res.confidence * 100).toFixed(1)}%`
                    : 'Frame accepted by anti-spoof pipeline',
                confidence: res.confidence,
                error: null,
            })
        } catch (err) {
            const msg = formatApiError(err, t)
            const looksLikeSpoof = /spoof|liveness|fake/i.test(msg)
            setServerLivenessState({
                loading: false,
                verdict: looksLikeSpoof ? 'spoof' : null,
                message: looksLikeSpoof ? msg : null,
                confidence: null,
                error: looksLikeSpoof ? null : msg,
            })
        }
    }, [t])

    // ---- Section 6: quality (computed from primaryFace) ----
    const qualityReport = primaryFace?.quality ?? null

    // ---- Section 7: deterministic sample embedding ----
    const [embeddingSample, setEmbeddingSample] = useState<number[] | null>(null)
    const generateSample = useCallback(() => {
        // Deterministic-ish from the bbox + landmarks we already have, falling
        // back to a fixed seed so the visualization works even without a face.
        const seedSrc = primaryFace
            ? primaryFace.detection.pixelLandmarks
                  .slice(0, 16)
                  .reduce((acc, lm) => acc + lm.x * 0.31 + lm.y * 0.71, 1.0)
            : 42.0
        const arr: number[] = []
        let seed = seedSrc
        for (let i = 0; i < 32; i++) {
            // Cheap mulberry-style jitter — purely educational.
            seed = (seed * 9301 + 49297) % 233280
            const v = (seed / 233280) * 2 - 1
            arr.push(Number(v.toFixed(3)))
        }
        setEmbeddingSample(arr)
    }, [primaryFace])

    // ---- Render ----
    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: HERO_GRADIENT,
                backgroundSize: '400% 400%',
                animation: 'faceDemoGradient 18s ease infinite',
                '@keyframes faceDemoGradient': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                py: { xs: 4, sm: 6 },
            }}
        >
            <Container maxWidth="md">
                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Stack spacing={1.5} sx={{ color: '#fff', textAlign: 'center', mb: 4, px: 1 }}>
                        <Typography variant="overline" sx={{ letterSpacing: 2 }}>
                            {t('face_demo.hero.eyebrow')}
                        </Typography>
                        <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.15 }}>
                            {t('face_demo.hero.title')}
                        </Typography>
                        <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 720, mx: 'auto' }}>
                            {t('face_demo.hero.subtitle')}
                        </Typography>
                    </Stack>
                </motion.div>

                {/* Camera surface */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card
                        sx={{
                            borderRadius: 4,
                            mb: 4,
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.95)',
                            boxShadow: '0 24px 48px -16px rgba(40,20,80,0.4)',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                aspectRatio: '4 / 3',
                                bgcolor: '#0f172a',
                            }}
                        >
                            <video
                                ref={videoRef}
                                playsInline
                                muted
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                            <MeshOverlay
                                canvasRef={canvasRef}
                                videoRef={videoRef}
                                primaryFace={primaryFace}
                                showMesh={showMesh && cameraOn}
                                showBox={cameraOn}
                            />

                            {!cameraOn && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        color: '#fff',
                                        textAlign: 'center',
                                        px: 3,
                                        gap: 2,
                                    }}
                                >
                                    <Typography variant="body1" sx={{ opacity: 0.85 }}>
                                        {cameraError ?? t('face_demo.hero.camera_required')}
                                    </Typography>
                                    {engineLoading && (
                                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                            {t('face_demo.hero.engine_loading')}
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Box>
                        <CardContent>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={2}
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                justifyContent="space-between"
                            >
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {cameraOn ? (
                                        <Chip color="success" label={`${fps.toFixed(0)} FPS`} />
                                    ) : (
                                        <Chip variant="outlined" label="Idle" />
                                    )}
                                    <Chip variant="outlined" size="small" label={detectionBackend} />
                                </Stack>
                                <Stack direction="row" spacing={1.5}>
                                    {!cameraOn ? (
                                        <Button
                                            variant="contained"
                                            onClick={startCamera}
                                            sx={{
                                                background: HERO_GRADIENT,
                                                color: '#fff',
                                                fontWeight: 600,
                                                px: 3,
                                                '&:hover': { background: HERO_GRADIENT, opacity: 0.92 },
                                            }}
                                        >
                                            {t('face_demo.hero.start_camera')}
                                        </Button>
                                    ) : (
                                        <Button variant="outlined" onClick={stopCamera}>
                                            {t('face_demo.hero.stop_camera')}
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Sections */}
                <Stack spacing={3}>
                    {/* 1. Detection */}
                    <DemoSection
                        index={1}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.detection.title')}
                        subtitle={t('face_demo.detection.subtitle')}
                        description={t('face_demo.detection.description')}
                        badge={t('face_demo.powered_by_local')}
                    >
                        {primaryFace ? (
                            <Stack direction="row" flexWrap="wrap" gap={1.5}>
                                <MetricChip
                                    label={t('face_demo.detection.confidence')}
                                    value={`${(primaryFace.detection.confidence * 100).toFixed(0)}%`}
                                    tone="success"
                                />
                                <MetricChip
                                    label={t('face_demo.detection.fps')}
                                    value={`${fps.toFixed(0)}`}
                                />
                                <MetricChip
                                    label={t('face_demo.detection.backend')}
                                    value={detectionBackend.split('(')[0].trim()}
                                />
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {cameraOn
                                    ? t('face_demo.detection.no_face')
                                    : t('face_demo.hero.camera_required')}
                            </Typography>
                        )}
                    </DemoSection>

                    {/* 2. Landmarks */}
                    <DemoSection
                        index={2}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.landmarks.title')}
                        subtitle={t('face_demo.landmarks.subtitle')}
                        description={t('face_demo.landmarks.description')}
                        badge={t('face_demo.powered_by_local')}
                    >
                        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Switch
                                    checked={showMesh}
                                    onChange={(e) => setShowMesh(e.target.checked)}
                                    inputProps={{ 'aria-label': 'toggle mesh' }}
                                />
                                <Typography variant="body2">
                                    {showMesh
                                        ? t('face_demo.landmarks.toggle_off')
                                        : t('face_demo.landmarks.toggle_on')}
                                </Typography>
                            </Stack>
                            <MetricChip
                                label={t('face_demo.landmarks.points_drawn')}
                                value={
                                    primaryFace?.detection.pixelLandmarks?.length
                                        ? `${primaryFace.detection.pixelLandmarks.length}`
                                        : '—'
                                }
                            />
                            {!primaryFace && cameraOn && (
                                <Typography variant="caption" color="text.secondary">
                                    {t('face_demo.landmarks.engine_warmup')}
                                </Typography>
                            )}
                        </Stack>
                    </DemoSection>

                    {/* 3. Head Pose */}
                    <DemoSection
                        index={3}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.head_pose.title')}
                        subtitle={t('face_demo.head_pose.subtitle')}
                        description={t('face_demo.head_pose.description')}
                        badge={t('face_demo.powered_by_local')}
                    >
                        {primaryFace?.headPose ? (
                            <Stack direction="row" flexWrap="wrap" gap={1.5}>
                                <MetricChip
                                    label={t('face_demo.head_pose.yaw')}
                                    value={`${primaryFace.headPose.yaw.toFixed(1)}°`}
                                />
                                <MetricChip
                                    label={t('face_demo.head_pose.pitch')}
                                    value={`${primaryFace.headPose.pitch.toFixed(1)}°`}
                                />
                                <MetricChip label={t('face_demo.head_pose.roll')} value="—" />
                                <MetricChip
                                    label="State"
                                    value={poseLabel(t, primaryFace.headPose.yaw, primaryFace.headPose.pitch)}
                                />
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('face_demo.detection.no_face')}
                            </Typography>
                        )}
                    </DemoSection>

                    {/* 4. Passive Liveness */}
                    <DemoSection
                        index={4}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.passive_liveness.title')}
                        subtitle={t('face_demo.passive_liveness.subtitle')}
                        description={t('face_demo.passive_liveness.description')}
                        badge={t('face_demo.powered_by_local')}
                    >
                        {primaryFace?.liveness ? (
                            <Stack spacing={2}>
                                <Box>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{ mb: 0.5 }}
                                    >
                                        <Typography variant="body2" fontWeight={600}>
                                            {t('face_demo.passive_liveness.overall_score')}
                                        </Typography>
                                        <Chip
                                            size="small"
                                            color={primaryFace.liveness.isLive ? 'success' : 'warning'}
                                            label={
                                                primaryFace.liveness.isLive
                                                    ? t('face_demo.passive_liveness.is_live')
                                                    : t('face_demo.passive_liveness.is_spoof')
                                            }
                                        />
                                    </Stack>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(100, Math.max(0, primaryFace.liveness.score))}
                                        sx={{
                                            height: 10,
                                            borderRadius: 5,
                                            '& .MuiLinearProgress-bar': { background: HERO_GRADIENT },
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        {primaryFace.liveness.score.toFixed(0)} / 100
                                    </Typography>
                                </Box>
                                <Stack direction="row" flexWrap="wrap" gap={1.5}>
                                    <MetricChip
                                        label={t('face_demo.passive_liveness.components.texture')}
                                        value={primaryFace.liveness.breakdown.texture.toFixed(0)}
                                    />
                                    <MetricChip
                                        label={t('face_demo.passive_liveness.components.color')}
                                        value={primaryFace.liveness.breakdown.color.toFixed(0)}
                                    />
                                    <MetricChip
                                        label={t('face_demo.passive_liveness.components.skinTone')}
                                        value={primaryFace.liveness.breakdown.skinTone.toFixed(0)}
                                    />
                                    <MetricChip
                                        label={t('face_demo.passive_liveness.components.moire')}
                                        value={primaryFace.liveness.breakdown.moire.toFixed(0)}
                                    />
                                    <MetricChip
                                        label={t('face_demo.passive_liveness.components.localVariance')}
                                        value={primaryFace.liveness.breakdown.localVariance.toFixed(0)}
                                    />
                                </Stack>
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('face_demo.passive_liveness.warming_up')}
                            </Typography>
                        )}
                    </DemoSection>

                    {/* 5. Server Anti-Spoofing */}
                    <DemoSection
                        index={5}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.server_liveness.title')}
                        subtitle={t('face_demo.server_liveness.subtitle')}
                        description={t('face_demo.server_liveness.description')}
                        badge={t('face_demo.powered_by_server')}
                    >
                        {!isAuthenticated ? (
                            <Alert severity="info">
                                {t('face_demo.server_liveness.auth_required')}
                            </Alert>
                        ) : (
                            <Stack spacing={2}>
                                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                                    <Button
                                        variant="contained"
                                        disabled={!cameraOn || serverLivenessState.loading}
                                        onClick={runServerLiveness}
                                        sx={{
                                            background: HERO_GRADIENT,
                                            color: '#fff',
                                            '&:hover': { background: HERO_GRADIENT, opacity: 0.92 },
                                        }}
                                    >
                                        {serverLivenessState.loading
                                            ? t('face_demo.server_liveness.capturing')
                                            : t('face_demo.server_liveness.capture')}
                                    </Button>
                                    {serverLivenessState.verdict === 'real' && (
                                        <Chip color="success" label={t('face_demo.server_liveness.real')} />
                                    )}
                                    {serverLivenessState.verdict === 'spoof' && (
                                        <Chip color="error" label={t('face_demo.server_liveness.spoof')} />
                                    )}
                                </Stack>
                                {serverLivenessState.message && (
                                    <Typography variant="body2" color="text.secondary">
                                        {serverLivenessState.message}
                                    </Typography>
                                )}
                                {serverLivenessState.error && (
                                    <Alert severity="error">
                                        {t('face_demo.server_liveness.error', { message: serverLivenessState.error })}
                                    </Alert>
                                )}
                            </Stack>
                        )}
                    </DemoSection>

                    {/* 6. Quality */}
                    <DemoSection
                        index={6}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.quality.title')}
                        subtitle={t('face_demo.quality.subtitle')}
                        description={t('face_demo.quality.description')}
                        badge={t('face_demo.powered_by_local')}
                    >
                        {qualityReport ? (
                            <Stack spacing={2}>
                                <Stack direction="row" flexWrap="wrap" gap={1.5}>
                                    <MetricChip
                                        label={t('face_demo.quality.blur')}
                                        value={`${qualityReport.blur.toFixed(0)}`}
                                        tone={scoreTone(qualityReport.blur)}
                                    />
                                    <MetricChip
                                        label={t('face_demo.quality.lighting')}
                                        value={`${qualityReport.brightness.toFixed(0)}`}
                                        tone={qualityReport.brightnessOk ? 'success' : 'warning'}
                                    />
                                    <MetricChip
                                        label={t('face_demo.quality.face_size')}
                                        value={`${qualityReport.size.toFixed(0)}`}
                                        tone={scoreTone(qualityReport.size)}
                                    />
                                    <MetricChip
                                        label={t('face_demo.quality.overall')}
                                        value={`${qualityReport.score.toFixed(0)}`}
                                        tone={scoreTone(qualityReport.score)}
                                    />
                                </Stack>
                                <Chip
                                    size="small"
                                    color={qualityReport.score >= 65 ? 'success' : 'warning'}
                                    label={
                                        qualityReport.score >= 65
                                            ? t('face_demo.quality.acceptable')
                                            : t('face_demo.quality.not_acceptable')
                                    }
                                    sx={{ alignSelf: 'flex-start' }}
                                />
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('face_demo.detection.no_face')}
                            </Typography>
                        )}
                    </DemoSection>

                    {/* 7. Embedding visualization */}
                    <DemoSection
                        index={7}
                        total={TOTAL_SECTIONS}
                        title={t('face_demo.embedding.title')}
                        subtitle={t('face_demo.embedding.subtitle')}
                        description={t('face_demo.embedding.description')}
                        badge={t('face_demo.powered_by_local')}
                    >
                        <Stack spacing={2}>
                            {!isAuthenticated && (
                                <Alert severity="info">
                                    {t('face_demo.embedding.auth_required')}
                                </Alert>
                            )}
                            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                                <Button variant="outlined" onClick={generateSample}>
                                    {t('face_demo.embedding.extract')}
                                </Button>
                                {embeddingSample && (
                                    <Typography variant="caption" color="text.secondary">
                                        {t('face_demo.embedding.vector_label')}
                                    </Typography>
                                )}
                            </Stack>
                            {embeddingSample && <EmbeddingHeatmap values={embeddingSample} />}
                        </Stack>
                    </DemoSection>
                </Stack>

                {/* Footer */}
                <Box sx={{ mt: 6, textAlign: 'center', color: '#fff' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {t('face_demo.footer.ready')}
                    </Typography>
                    <Button
                        component={RouterLink}
                        to="/developer-portal"
                        variant="contained"
                        sx={{
                            background: 'rgba(255,255,255,0.95)',
                            color: '#1a1a2e',
                            fontWeight: 600,
                            '&:hover': { background: '#fff' },
                        }}
                    >
                        {t('face_demo.footer.cta')}
                    </Button>
                </Box>

                {engineLoading && (
                    <Box sx={{ position: 'fixed', top: 16, right: 16 }}>
                        <CircularProgress size={24} sx={{ color: '#fff' }} />
                    </Box>
                )}
            </Container>
        </Box>
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function poseLabel(t: (k: string) => string, yaw: number, pitch: number): string {
    if (yaw < -15) return t('face_demo.head_pose.turning_left')
    if (yaw > 15) return t('face_demo.head_pose.turning_right')
    if (pitch < -10) return t('face_demo.head_pose.looking_down')
    if (pitch > 10) return t('face_demo.head_pose.looking_up')
    return t('face_demo.head_pose.frontal')
}

function EmbeddingHeatmap({ values }: { values: number[] }) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 0.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(102, 126, 234, 0.08)',
            }}
        >
            {values.map((v, i) => {
                const t = (v - min) / range
                // Map t [0,1] across the gradient palette
                const r = Math.round(102 + (246 - 102) * t)
                const g = Math.round(126 + (79 - 126) * t)
                const b = Math.round(234 + (89 - 234) * t)
                return (
                    <Box
                        key={i}
                        title={`#${i}: ${v.toFixed(3)}`}
                        sx={{
                            aspectRatio: '1 / 1',
                            borderRadius: 1,
                            background: `rgb(${r}, ${g}, ${b})`,
                        }}
                    />
                )
            })}
        </Box>
    )
}
