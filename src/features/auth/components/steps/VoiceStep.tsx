import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Typography,
    LinearProgress,
} from '@mui/material'
import {
    RecordVoiceOver,
    Mic,
    Stop,
    Replay,
    ArrowForward,
} from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useVoiceRecorder } from '@/lib/biometric-engine/hooks/useVoiceRecorder'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

const MAX_RECORDING_SECONDS = 10

interface VoiceStepProps {
    onSubmit: (voiceData: string) => void
    loading: boolean
    error?: string
}

/**
 * Read a Blob as a base64 data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
        reader.readAsDataURL(blob)
    })
}

/**
 * VoiceStep — records microphone audio for MFA voice verification.
 *
 * Emits a base64 data URL of a 16kHz mono WAV blob (produced by
 * `useVoiceRecorder`). Emitting WAV instead of the raw WebM enables the
 * Silero VAD gate in `TwoFactorDispatcher` to actually classify the
 * recording (Silero only accepts 16kHz PCM WAV) and skip uploads when the
 * user stayed silent — previously the dispatcher received WebM, failed to
 * decode it, and silently bypassed the gate.
 *
 * If the WAV conversion fails for any reason, we fall back to the raw
 * WebM blob so voice auth still works end-to-end; the backend accepts
 * both formats.
 */
export default function VoiceStep({ onSubmit, loading, error }: VoiceStepProps) {
    const { t } = useTranslation()
    const {
        start,
        stop,
        isRecording,
        duration,
        blob,
        wav16k,
        error: recorderError,
    } = useVoiceRecorder()

    const [recordedReady, setRecordedReady] = useState(false)
    const [displayDuration, setDisplayDuration] = useState(0)
    const autoStopTriggered = useRef(false)

    // Auto-stop after MAX_RECORDING_SECONDS.
    useEffect(() => {
        if (!isRecording) return
        if (duration >= MAX_RECORDING_SECONDS && !autoStopTriggered.current) {
            autoStopTriggered.current = true
            void stop()
        }
    }, [isRecording, duration, stop])

    // Track the live duration while recording, freeze it when stopped so the
    // success alert keeps showing the captured length.
    useEffect(() => {
        if (isRecording) {
            setDisplayDuration(duration)
        }
    }, [isRecording, duration])

    // Mark recording as ready once the hook has produced at least a webm blob
    // (wav16k arrives slightly later because conversion is async).
    useEffect(() => {
        if (!isRecording && blob) {
            setRecordedReady(true)
        }
    }, [isRecording, blob])

    const handleStart = useCallback(async () => {
        autoStopTriggered.current = false
        setRecordedReady(false)
        setDisplayDuration(0)
        await start()
    }, [start])

    const handleStop = useCallback(() => {
        void stop()
    }, [stop])

    const handleRetry = useCallback(() => {
        setRecordedReady(false)
        setDisplayDuration(0)
        autoStopTriggered.current = false
    }, [])

    const handleSubmit = useCallback(async () => {
        try {
            if (wav16k) {
                const dataUrl = await blobToDataUrl(wav16k)
                onSubmit(dataUrl)
                return
            }
            // Fallback: WAV conversion failed — send raw WebM so the user
            // isn't blocked. The VAD gate will skip (non-WAV input) and the
            // server will still accept the audio.
            if (blob) {
                console.warn(
                    '[VoiceStep] wav16k unavailable, falling back to WebM. VAD gating will be bypassed for this submission.'
                )
                const dataUrl = await blobToDataUrl(blob)
                onSubmit(dataUrl)
            }
        } catch (err) {
            console.warn('[VoiceStep] failed to encode recording as data URL', err)
        }
    }, [wav16k, blob, onSubmit])

    const micErrorMessage = recorderError ? t('mfa.voice.micError') : null

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 },
                },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
                    }}
                >
                    <RecordVoiceOver sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.voice.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('mfa.voice.description')}
                </Typography>
            </Box>

            {(error || micErrorMessage) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error || micErrorMessage}
                    </Alert>
                </motion.div>
            )}

            {/* Prompt phrase to read */}
            <motion.div variants={itemVariants}>
                <Box
                    sx={{
                        mt: 1,
                        mb: 2,
                        p: 2,
                        borderRadius: '12px',
                        border: '1px dashed',
                        borderColor: 'divider',
                        backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        textAlign: 'center',
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {t('mfa.voice.promptPhrase')}
                    </Typography>
                    <Typography variant="body1" fontWeight={600} color="text.primary">
                        “{t('mfa.voice.samplePhrase')}”
                    </Typography>
                </Box>
            </motion.div>

            {/* Microphone Animation */}
            <motion.div variants={itemVariants}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        my: 4,
                    }}
                >
                    <motion.div
                        animate={
                            isRecording
                                ? {
                                      scale: [1, 1.1, 1],
                                  }
                                : {}
                        }
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <Box
                            sx={{
                                width: 100,
                                height: 100,
                                borderRadius: '50%',
                                background: isRecording
                                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.25) 100%)'
                                    : recordedReady
                                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.25) 100%)'
                                      : 'rgba(99, 102, 241, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid',
                                borderColor: isRecording
                                    ? 'error.main'
                                    : recordedReady
                                      ? 'success.main'
                                      : 'divider',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <Mic
                                sx={{
                                    fontSize: 48,
                                    color: isRecording
                                        ? 'error.main'
                                        : recordedReady
                                          ? 'success.main'
                                          : 'text.secondary',
                                }}
                            />
                        </Box>
                    </motion.div>
                </Box>
            </motion.div>

            {/* Waveform Placeholder / Progress */}
            {isRecording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box sx={{ mb: 3 }}>
                        {/* Waveform bars */}
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 0.5,
                                height: 40,
                                mb: 2,
                            }}
                        >
                            {Array.from({ length: 20 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        height: [8, Math.random() * 32 + 8, 8],
                                    }}
                                    transition={{
                                        duration: 0.5 + Math.random() * 0.5,
                                        repeat: Infinity,
                                        delay: i * 0.05,
                                        ease: 'easeInOut',
                                    }}
                                    style={{
                                        width: 3,
                                        backgroundColor: '#ef4444',
                                        borderRadius: 2,
                                    }}
                                />
                            ))}
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={(displayDuration / MAX_RECORDING_SECONDS) * 100}
                            sx={{ borderRadius: 1 }}
                        />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', textAlign: 'center', mt: 1 }}
                        >
                            {t('mfa.voice.recordingTime', { current: displayDuration, max: MAX_RECORDING_SECONDS })}
                        </Typography>
                    </Box>
                </motion.div>
            )}

            {recordedReady && !isRecording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>
                        {t('mfa.voice.recordingCaptured', { seconds: displayDuration })}
                    </Alert>
                </motion.div>
            )}

            {/* Actions */}
            <motion.div variants={itemVariants}>
                {!isRecording && !recordedReady && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleStart}
                        disabled={loading}
                        startIcon={<Mic />}
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
                        {t('mfa.voice.startRecording')}
                    </Button>
                )}

                {isRecording && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleStop}
                        startIcon={<Stop />}
                        color="error"
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                        }}
                    >
                        {t('mfa.voice.stopRecording')}
                    </Button>
                )}

                {recordedReady && !isRecording && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            size="large"
                            onClick={handleRetry}
                            disabled={loading}
                            startIcon={<Replay />}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                            }}
                        >
                            {t('mfa.voice.reRecord')}
                        </Button>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleSubmit}
                            disabled={loading}
                            endIcon={!loading && <ArrowForward />}
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
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: 'white' }} />
                            ) : (
                                t('mfa.voice.submit')
                            )}
                        </Button>
                    </Box>
                )}
            </motion.div>
        </motion.div>
    )
}
