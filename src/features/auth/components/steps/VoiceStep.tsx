import { useState, useRef, useCallback, useEffect } from 'react'
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

export default function VoiceStep({ onSubmit, loading, error }: VoiceStepProps) {
    const { t } = useTranslation()
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const [recording, setRecording] = useState(false)
    const [recordedData, setRecordedData] = useState<string | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    const [micError, setMicError] = useState<string | null>(null)

    useEffect(() => {
        if (!recording) return

        const timer = setInterval(() => {
            setRecordingTime((prev) => {
                if (prev >= MAX_RECORDING_SECONDS) {
                    stopRecording()
                    return prev
                }
                return prev + 1
            })
        }, 1000)

        return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording])

    const startRecording = useCallback(async () => {
        try {
            setMicError(null)
            setRecordedData(null)
            setRecordingTime(0)
            chunksRef.current = []

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                const reader = new FileReader()
                reader.onloadend = () => {
                    setRecordedData(reader.result as string)
                }
                reader.readAsDataURL(blob)

                stream.getTracks().forEach((track) => track.stop())
            }

            mediaRecorder.start()
            setRecording(true)
        } catch (_err) {
            setMicError(
                t('mfa.voice.micError')
            )
        }
    }, [])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
        }
        setRecording(false)
    }, [])

    const handleRetry = useCallback(() => {
        setRecordedData(null)
        setRecordingTime(0)
    }, [])

    const handleSubmit = useCallback(() => {
        if (recordedData) {
            onSubmit(recordedData)
        }
    }, [recordedData, onSubmit])

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop()
            }
        }
    }, [])

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

            {(error || micError) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error || micError}
                    </Alert>
                </motion.div>
            )}

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
                            recording
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
                                background: recording
                                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.25) 100%)'
                                    : recordedData
                                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.25) 100%)'
                                      : 'rgba(99, 102, 241, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid',
                                borderColor: recording
                                    ? 'error.main'
                                    : recordedData
                                      ? 'success.main'
                                      : 'divider',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <Mic
                                sx={{
                                    fontSize: 48,
                                    color: recording
                                        ? 'error.main'
                                        : recordedData
                                          ? 'success.main'
                                          : 'text.secondary',
                                }}
                            />
                        </Box>
                    </motion.div>
                </Box>
            </motion.div>

            {/* Waveform Placeholder / Progress */}
            {recording && (
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
                            value={(recordingTime / MAX_RECORDING_SECONDS) * 100}
                            sx={{ borderRadius: 1 }}
                        />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', textAlign: 'center', mt: 1 }}
                        >
                            {t('mfa.voice.recordingTime', { current: recordingTime, max: MAX_RECORDING_SECONDS })}
                        </Typography>
                    </Box>
                </motion.div>
            )}

            {recordedData && !recording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>
                        {t('mfa.voice.recordingCaptured', { seconds: recordingTime })}
                    </Alert>
                </motion.div>
            )}

            {/* Actions */}
            <motion.div variants={itemVariants}>
                {!recording && !recordedData && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={startRecording}
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

                {recording && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={stopRecording}
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

                {recordedData && !recording && (
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
