import { useState, useRef, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Select,
    Typography,
} from '@mui/material'
import { Mic, RecordVoiceOver, Refresh, Stop } from '@mui/icons-material'
import { useVoiceSearch } from '@hooks/useVoiceSearch'
import { useTranslation } from 'react-i18next'

// ── WAV Conversion Helpers (reused from VoiceEnrollmentFlow) ──

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

// ── Component ──

const MAX_RECORDING_SECONDS = 10

export default function VoiceSearchPage() {
    const { searching, result, error: searchError, searchVoice, reset } = useVoiceSearch()
    const { t } = useTranslation()

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const animFrameRef = useRef<number>(0)
    const startTimeRef = useRef(0)

    const [recording, setRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [voiceBase64, setVoiceBase64] = useState<string | null>(null)
    const [micError, setMicError] = useState<string | null>(null)
    const [waveformData, setWaveformData] = useState<number[]>([])
    const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])
    const [selectedMic, setSelectedMic] = useState<string>('')

    // Load available microphones
    useEffect(() => {
        async function loadMicrophones() {
            try {
                // Request access first to get device labels
                await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
                    s.getTracks().forEach(t => t.stop())
                })
                const devices = await navigator.mediaDevices.enumerateDevices()
                const audioInputs = devices.filter(d => d.kind === 'audioinput')
                setMicrophones(audioInputs)
                if (audioInputs.length > 0 && !selectedMic) {
                    setSelectedMic(audioInputs[0].deviceId)
                }
            } catch {
                // Will show error when user tries to record
            }
        }
        loadMicrophones()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            const samples: number[] = []
            const step = Math.floor(bufLen / 30)
            for (let i = 0; i < 30; i++) {
                const v = data[i * step] || 128
                samples.push(Math.abs(v - 128) / 128)
            }
            setWaveformData(samples)
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
            setRecordingTime(0)
            reset()
            chunksRef.current = []

            const constraints: MediaStreamConstraints = {
                audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
            }
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
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

                try {
                    const wavBlob = await convertToWav16k(blob)
                    const reader = new FileReader()
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1]
                        setVoiceBase64(base64)
                    }
                    reader.readAsDataURL(wavBlob)
                } catch {
                    // Fallback: send WebM raw
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
            setMicError(t('voiceSearch.microphoneError'))
        }
    }, [selectedMic, reset])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
        }
        setRecording(false)
        analyserRef.current = null
    }, [])

    const handleSearch = async () => {
        if (!voiceBase64) return
        await searchVoice(voiceBase64)
    }

    const handleReset = () => {
        reset()
        setVoiceBase64(null)
        setRecordingTime(0)
        setWaveformData([])
    }

    const hasRecording = voiceBase64 !== null && !recording

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RecordVoiceOver /> {t('voiceSearch.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('voiceSearch.subtitle')}
            </Typography>

            {micError && (
                <Alert severity="error" sx={{ mb: 2 }}>{micError}</Alert>
            )}
            {searchError && (
                <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    {/* Microphone selector */}
                    {microphones.length > 1 && (
                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                            <InputLabel>{t('voiceSearch.microphone')}</InputLabel>
                            <Select
                                value={selectedMic}
                                label={t('voiceSearch.microphone')}
                                onChange={(e) => setSelectedMic(e.target.value)}
                                disabled={recording}
                            >
                                {microphones.map((mic) => (
                                    <MenuItem key={mic.deviceId} value={mic.deviceId}>
                                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Waveform visualization */}
                    <Box sx={{
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: recording ? 'error.50' : hasRecording ? 'success.50' : 'grey.100',
                        borderRadius: 2,
                        mb: 2,
                        transition: 'background-color 0.3s',
                    }}>
                        {recording ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, height: 80 }}>
                                {waveformData.map((amp, i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            width: 3,
                                            height: `${Math.max(4, amp * 80)}px`,
                                            bgcolor: 'error.main',
                                            borderRadius: 1,
                                            transition: 'height 0.1s',
                                        }}
                                    />
                                ))}
                            </Box>
                        ) : hasRecording ? (
                            <Box sx={{ textAlign: 'center' }}>
                                <Mic sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                                <Typography color="success.main" fontWeight={600}>
                                    {t('common.recordingReady', { seconds: recordingTime })}
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ textAlign: 'center' }}>
                                <Mic sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                                <Typography color="text.secondary">
                                    {t('common.startRecordingPrompt')}
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Recording progress */}
                    {recording && (
                        <Box sx={{ mb: 2 }}>
                            <LinearProgress
                                variant="determinate"
                                value={(recordingTime / MAX_RECORDING_SECONDS) * 100}
                                color="error"
                                sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                                {recordingTime}s / {MAX_RECORDING_SECONDS}s
                            </Typography>
                        </Box>
                    )}

                    {/* Controls */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {!recording && !hasRecording && (
                            <Button
                                variant="contained"
                                startIcon={<Mic />}
                                onClick={startRecording}
                            >
                                {t('voiceSearch.startRecording')}
                            </Button>
                        )}

                        {recording && (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<Stop />}
                                onClick={stopRecording}
                            >
                                {t('voiceSearch.stopRecording')}
                            </Button>
                        )}

                        {hasRecording && (
                            <>
                                <Button
                                    variant="contained"
                                    startIcon={searching ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <RecordVoiceOver />}
                                    onClick={handleSearch}
                                    disabled={searching}
                                >
                                    {t('voiceSearch.whoIsThis')}
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Refresh />}
                                    onClick={handleReset}
                                    disabled={searching}
                                >
                                    {t('common.reset')}
                                </Button>
                            </>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Search results */}
            {result && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>{t('voiceSearch.searchResults')}</Typography>
                        <Box sx={{ mb: 2 }}>
                            <Chip
                                label={result.found ? t('voiceSearch.speakerIdentified') : t('common.noMatchFound')}
                                color={result.found ? 'success' : 'warning'}
                                size="medium"
                            />
                        </Box>

                        {result.found && result.matches.length > 0 ? (
                            <List disablePadding>
                                {result.matches.map((match, idx) => (
                                    <ListItem key={idx} divider sx={{ px: 0 }}>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                    <Typography variant="body1" fontWeight={match.userName ? 600 : 400}>
                                                        {match.userName || match.userId}
                                                    </Typography>
                                                    {match.userEmail && (
                                                        <Typography variant="body2" color="text.secondary">
                                                            ({match.userEmail})
                                                        </Typography>
                                                    )}
                                                    {idx === 0 && (
                                                        <Chip label={t('common.bestMatch')} size="small" color="primary" />
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <Box component="span">
                                                    {`${t('common.similarity')}: ${(match.similarity * 100).toFixed(1)}%`}
                                                    {match.userName && (
                                                        <Typography variant="caption" color="text.disabled" component="span" sx={{ ml: 1 }}>
                                                            ID: {match.userId}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('voiceSearch.noMatching')}
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            )}
        </Box>
    )
}
