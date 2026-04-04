import { useState, useRef, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    IconButton,
    LinearProgress,
    Typography,
} from '@mui/material'
import {
    Close,
    Mic,
    Stop,
    Replay,
    CheckCircle,
    RecordVoiceOver,
    Search,
    PersonAdd,
    VerifiedUser,
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'

// ── WAV Conversion Helpers ──────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
    }
}

function createWavBuffer(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)     // PCM
    view.setUint16(22, 1, true)     // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)    // 16-bit
    writeString(view, 36, 'data')
    view.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    }
    return buffer
}

async function convertToWav16k(blob: Blob): Promise<Blob> {
    const audioCtx = new AudioContext({ sampleRate: 16000 })
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    let channelData: Float32Array
    if (audioBuffer.numberOfChannels === 1) {
        channelData = audioBuffer.getChannelData(0)
    } else {
        const ch0 = audioBuffer.getChannelData(0)
        const ch1 = audioBuffer.getChannelData(1)
        channelData = new Float32Array(ch0.length)
        for (let i = 0; i < ch0.length; i++) {
            channelData[i] = (ch0[i] + ch1[i]) / 2
        }
    }
    const wavBuffer = createWavBuffer(channelData, 16000)
    await audioCtx.close()
    return new Blob([wavBuffer], { type: 'audio/wav' })
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(2)} MB`
}

// ── Component ──────────────────────────────────────────────────

const MAX_RECORDING_SECONDS = 10

const VOICE_PASSPHRASES = [
    'The quick brown fox jumps over the lazy dog near the riverbank',
    'My voice is my passport, verify me please',
    'Authentication requires clear and consistent speech patterns',
    'Security systems protect our digital identity every day',
    'Biometric verification ensures only authorized access',
    'Every person has a unique voice that can be recognized',
]

type VoiceAction = 'enroll' | 'verify' | 'search'

interface VoiceEnrollmentFlowProps {
    open: boolean
    userId: string
    apiBaseUrl: string
    token: string | null
    onClose: () => void
    onSuccess: (action: VoiceAction, result: unknown) => void
}

interface ConversionStats {
    originalSize: number
    wavSize: number
    conversionMs: number
    format: string
    sampleRate: number
    duration: number
}

export default function VoiceEnrollmentFlow({
    open,
    userId,
    apiBaseUrl,
    token,
    onClose,
    onSuccess,
}: VoiceEnrollmentFlowProps) {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const animFrameRef = useRef<number>(0)
    const startTimeRef = useRef(0)
    const maxAmplitudeRef = useRef(0)

    const [recording, setRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [voiceBase64, setVoiceBase64] = useState<string | null>(null)
    const [conversionStats, setConversionStats] = useState<ConversionStats | null>(null)
    const [micError, setMicError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<VoiceAction | null>(null)
    const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null)

    // Waveform amplitude for visualization
    const [waveformData, setWaveformData] = useState<number[]>([])

    // Random passphrase for voice quality
    const [passphrase, setPassphrase] = useState(() =>
        VOICE_PASSPHRASES[Math.floor(Math.random() * VOICE_PASSPHRASES.length)]
    )

    // Timer
    useEffect(() => {
        if (!recording) return
        const timer = setInterval(() => {
            setRecordingTime(prev => {
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

    // Waveform animation
    useEffect(() => {
        if (!recording || !analyserRef.current) return

        const analyser = analyserRef.current
        const bufLen = analyser.frequencyBinCount
        const data = new Uint8Array(bufLen)

        function draw() {
            if (!analyserRef.current) return
            analyserRef.current.getByteTimeDomainData(data)
            // Sample 20 points from the data
            const samples: number[] = []
            const step = Math.floor(bufLen / 20)
            for (let i = 0; i < 20; i++) {
                const v = data[i * step] || 128
                samples.push(Math.abs(v - 128) / 128)
            }
            setWaveformData(samples)
            const maxAmp = Math.max(...samples)
            if (maxAmp > maxAmplitudeRef.current) maxAmplitudeRef.current = maxAmp
            animFrameRef.current = requestAnimationFrame(draw)
        }
        animFrameRef.current = requestAnimationFrame(draw)

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        }
    }, [recording])

    const startRecording = useCallback(async () => {
        try {
            setMicError(null)
            setVoiceBase64(null)
            setConversionStats(null)
            setRecordingTime(0)
            setActionResult(null)
            chunksRef.current = []
            maxAmplitudeRef.current = 0

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 2048
            source.connect(analyser)
            analyserRef.current = analyser

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
            })
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

                if (maxAmplitudeRef.current < 0.05) {
                    setMicError('No voice detected. Please speak clearly into the microphone and try again.')
                    stream.getTracks().forEach(t => t.stop())
                    return
                }

                const duration = (performance.now() - startTimeRef.current) / 1000
                const origSampleRate = audioCtxRef.current?.sampleRate || 48000

                // Convert WebM -> WAV 16kHz mono
                try {
                    const convStart = performance.now()
                    const wavBlob = await convertToWav16k(blob)
                    const convTime = performance.now() - convStart

                    setConversionStats({
                        originalSize: blob.size,
                        wavSize: wavBlob.size,
                        conversionMs: Math.round(convTime),
                        format: 'WAV 16kHz mono',
                        sampleRate: origSampleRate,
                        duration: Math.round(duration * 10) / 10,
                    })

                    const reader = new FileReader()
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1]
                        setVoiceBase64(base64)
                    }
                    reader.readAsDataURL(wavBlob)
                } catch {
                    // Fallback: send WebM
                    setConversionStats({
                        originalSize: blob.size,
                        wavSize: 0,
                        conversionMs: 0,
                        format: 'WebM (fallback)',
                        sampleRate: origSampleRate,
                        duration: Math.round(duration * 10) / 10,
                    })

                    const reader = new FileReader()
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1]
                        setVoiceBase64(base64)
                    }
                    reader.readAsDataURL(blob)
                }

                stream.getTracks().forEach(t => t.stop())
            }

            mediaRecorder.start()
            startTimeRef.current = performance.now()
            setRecording(true)
        } catch {
            setMicError('Unable to access microphone. Please grant permissions.')
        }
    }, [])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
        }
        setRecording(false)
        analyserRef.current = null
    }, [])

    const handleRetry = useCallback(() => {
        setVoiceBase64(null)
        setConversionStats(null)
        setRecordingTime(0)
        setActionResult(null)
    }, [])

    const doVoiceAction = useCallback(async (action: VoiceAction) => {
        if (!voiceBase64) return

        setActionLoading(action)
        setActionResult(null)

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        try {
            let url: string
            let body: object

            // apiBaseUrl already includes /api/v1 (e.g. https://auth.rollingcatsoftware.com/api/v1)
            switch (action) {
                case 'enroll':
                    url = `${apiBaseUrl}/biometric/voice/enroll/${userId}`
                    body = { voiceData: voiceBase64 }
                    break
                case 'verify':
                    url = `${apiBaseUrl}/biometric/voice/verify/${userId}`
                    body = { voiceData: voiceBase64 }
                    break
                case 'search':
                    url = `${apiBaseUrl}/biometric/voice/search`
                    body = { voiceData: voiceBase64 }
                    break
            }

            const res = await fetch(url, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => null)

            if (res.ok && data) {
                let message: string
                let success = true

                switch (action) {
                    case 'enroll':
                        message = 'Voice enrolled successfully!'
                        break
                    case 'verify': {
                        const verified = data.verified === true || (data.confidence && data.confidence > 0)
                        const conf = data.confidence ? ` (confidence: ${(data.confidence * 100).toFixed(1)}%)` : ''
                        message = verified ? `Voice VERIFIED!${conf}` : `Voice NOT verified.${conf}`
                        success = verified
                        break
                    }
                    case 'search': {
                        const matches = data.matches || []
                        if (matches.length > 0) {
                            const top = matches[0]
                            const sim = top.similarity ? (top.similarity * 100).toFixed(1) : '?'
                            message = `Speaker identified: ${top.user_id} (${sim}% similarity)`
                        } else {
                            message = 'No speaker match found.'
                            success = false
                        }
                        break
                    }
                }

                setActionResult({ success, message })
                if (success) onSuccess(action, data)
            } else {
                setActionResult({
                    success: false,
                    message: `Failed (${res.status}): ${data?.message || 'Unknown error'}`,
                })
            }
        } catch (err) {
            setActionResult({
                success: false,
                message: err instanceof Error ? err.message : 'Request failed',
            })
        } finally {
            setActionLoading(null)
        }
    }, [voiceBase64, token, apiBaseUrl, userId, onSuccess])

    // Cleanup on close / re-init on open
    useEffect(() => {
        if (!open) {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop()
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }
            setRecording(false)
            setVoiceBase64(null)
            setConversionStats(null)
            setRecordingTime(0)
            setActionResult(null)
        } else {
            // Pick a new random passphrase each time the dialog opens
            setPassphrase(VOICE_PASSPHRASES[Math.floor(Math.random() * VOICE_PASSPHRASES.length)])
        }
    }, [open])

    const hasRecording = voiceBase64 !== null && !recording

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '20px',
                    bgcolor: '#0f172a',
                    color: 'white',
                    overflow: 'hidden',
                },
            }}
        >
            <DialogContent sx={{ p: 0, position: 'relative' }}>
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 10,
                        color: 'rgba(255,255,255,0.7)',
                        '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                >
                    <Close />
                </IconButton>

                {/* Header */}
                <Box sx={{ textAlign: 'center', pt: 3, pb: 1, px: 3 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 1.5,
                        }}
                    >
                        <RecordVoiceOver sx={{ fontSize: 26, color: 'white' }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700}>
                        Voice Authentication
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>
                        Record your voice, then enroll, verify, or search
                    </Typography>
                </Box>

                {/* Microphone visual */}
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                    <motion.div
                        animate={recording ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Box
                            sx={{
                                width: 100,
                                height: 100,
                                borderRadius: '50%',
                                background: recording
                                    ? 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.25) 100%)'
                                    : hasRecording
                                        ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.25) 100%)'
                                        : 'rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid',
                                borderColor: recording
                                    ? '#ef4444'
                                    : hasRecording
                                        ? '#10b981'
                                        : 'rgba(255,255,255,0.2)',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <Mic sx={{ fontSize: 48, color: recording ? '#ef4444' : hasRecording ? '#10b981' : 'rgba(255,255,255,0.5)' }} />
                        </Box>
                    </motion.div>
                </Box>

                {/* Passphrase prompt */}
                {!hasRecording && (
                    <Box
                        sx={{
                            mx: 3,
                            mb: 2,
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            textAlign: 'center',
                        }}
                    >
                        <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}
                        >
                            Please read the following text aloud:
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                color: 'white',
                                fontWeight: 600,
                                fontStyle: 'italic',
                                lineHeight: 1.6,
                                px: 1,
                            }}
                        >
                            &ldquo;{passphrase}&rdquo;
                        </Typography>
                    </Box>
                )}

                {/* Waveform / recording progress */}
                {recording && (
                    <Box sx={{ px: 3, mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, height: 40, mb: 1 }}>
                            {waveformData.map((amp, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: 8 + amp * 32 }}
                                    transition={{ duration: 0.1 }}
                                    style={{
                                        width: 3,
                                        backgroundColor: '#ef4444',
                                        borderRadius: 2,
                                        minHeight: 4,
                                    }}
                                />
                            ))}
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={(recordingTime / MAX_RECORDING_SECONDS) * 100}
                            sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: 'rgba(255,255,255,0.1)',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 3,
                                    bgcolor: '#ef4444',
                                },
                            }}
                        />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', textAlign: 'center', mt: 0.5 }}>
                            {recordingTime}s / {MAX_RECORDING_SECONDS}s
                        </Typography>
                    </Box>
                )}

                {/* Conversion stats */}
                {conversionStats && !recording && (
                    <Box sx={{ px: 3, mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Chip
                                label={`${conversionStats.duration}s`}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
                            />
                            <Chip
                                label={conversionStats.format}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
                            />
                            <Chip
                                label={formatBytes(conversionStats.wavSize || conversionStats.originalSize)}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
                            />
                            {conversionStats.conversionMs > 0 && (
                                <Chip
                                    label={`Conv: ${conversionStats.conversionMs}ms`}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                />
                            )}
                        </Box>
                    </Box>
                )}

                {/* Errors */}
                {micError && (
                    <Box sx={{ px: 3, mb: 2 }}>
                        <Alert severity="error" sx={{ borderRadius: '12px' }}>{micError}</Alert>
                    </Box>
                )}

                {/* Action result */}
                <AnimatePresence>
                    {actionResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <Box sx={{ px: 3, mb: 2 }}>
                                <Alert
                                    severity={actionResult.success ? 'success' : 'error'}
                                    icon={actionResult.success ? <CheckCircle /> : undefined}
                                    sx={{ borderRadius: '12px' }}
                                >
                                    {actionResult.message}
                                </Alert>
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Controls */}
                <Box sx={{ px: 3, pb: 3 }}>
                    {!recording && !hasRecording && (
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={startRecording}
                            startIcon={<Mic />}
                            sx={{
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                                '&:hover': { opacity: 0.9 },
                            }}
                        >
                            Start Recording
                        </Button>
                    )}

                    {recording && (
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={stopRecording}
                            startIcon={<Stop />}
                            sx={{
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                                bgcolor: '#ef4444',
                                '&:hover': { bgcolor: '#dc2626' },
                            }}
                        >
                            Stop Recording
                        </Button>
                    )}

                    {hasRecording && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {/* Action buttons */}
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={() => doVoiceAction('enroll')}
                                    disabled={actionLoading !== null}
                                    startIcon={actionLoading === 'enroll' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PersonAdd />}
                                    sx={{
                                        flex: 1,
                                        py: 1.5,
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                                        '&:hover': { opacity: 0.9 },
                                    }}
                                >
                                    Enroll
                                </Button>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={() => doVoiceAction('verify')}
                                    disabled={actionLoading !== null}
                                    startIcon={actionLoading === 'verify' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <VerifiedUser />}
                                    sx={{
                                        flex: 1,
                                        py: 1.5,
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        '&:hover': { opacity: 0.9 },
                                    }}
                                >
                                    Verify
                                </Button>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={() => doVoiceAction('search')}
                                    disabled={actionLoading !== null}
                                    startIcon={actionLoading === 'search' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Search />}
                                    sx={{
                                        flex: 1,
                                        py: 1.5,
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                                        '&:hover': { opacity: 0.9 },
                                    }}
                                >
                                    Search
                                </Button>
                            </Box>

                            <Button
                                variant="outlined"
                                size="large"
                                onClick={handleRetry}
                                disabled={actionLoading !== null}
                                startIcon={<Replay />}
                                sx={{
                                    py: 1,
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    '&:hover': { borderColor: 'rgba(255,255,255,0.4)' },
                                }}
                            >
                                Re-record
                            </Button>
                        </Box>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    )
}
