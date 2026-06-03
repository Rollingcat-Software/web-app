/**
 * QrCodeStep — QR as a mid-flow MFA FACTOR, via genuine cross-device approval.
 *
 * The old design generated a token and asked the user to type it back; because
 * the same browser both issued and submitted the token, the step self-passed
 * (no separate-device possession proof — the "fill the field + Verify" cheat).
 *
 * This version mirrors QrLoginPanel: it asks the backend (two-phase QR_CODE
 * step, `action:"challenge"`) for a STEP-BOUND session, renders that session as
 * a QR, and POLLS until the user's already-signed-in phone scans + approves it.
 * On APPROVED it submits the `qrSessionId` (NOT a token) — the server only
 * accepts it if the SAME user approved it on their phone. There is no input box,
 * so there is nothing to self-fill.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { QrCode2, ArrowBack } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'
import { formatApiError } from '@utils/formatApiError'
import { qrPayloadForSession } from '@features/auth/qr-login'

/** Step-bound session handed back by the QR_CODE challenge phase. */
export interface QrStepSession {
    qrSessionId: string
    expiresAtEpochSeconds?: number
}

interface QrSessionMfaStepProps {
    /**
     * Phase 1 — POST the QR_CODE step with `action:"challenge"` and return the
     * step-bound session (or null on failure). Built by the renderer.
     */
    onRequestSession: () => Promise<QrStepSession | null>
    /** Poll a QR session's status (GET /auth/qr/session/{id}). */
    pollSession: (qrSessionId: string) => Promise<{ status: string }>
    /** Phase 2 — submit the APPROVED session id to complete the step. */
    onSubmit: (qrSessionId: string) => void
    loading: boolean
    error?: string
    /** Optional back affordance (renderer-controlled). */
    onBack?: () => void
}

const POLL_INTERVAL_MS = 2500

function formatTime(seconds: number): string {
    const safe = Math.max(0, seconds)
    const mins = Math.floor(safe / 60)
    const secs = safe % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function QrSessionMfaStep({
    onRequestSession,
    pollSession,
    onSubmit,
    loading,
    error,
    onBack,
}: QrSessionMfaStepProps) {
    const { t } = useTranslation()

    type Phase = 'loading' | 'waiting' | 'expired' | 'failed'
    const [phase, setPhase] = useState<Phase>('loading')
    const [session, setSession] = useState<QrStepSession | null>(null)
    const [remaining, setRemaining] = useState<number | null>(null)
    const [localError, setLocalError] = useState<string | undefined>(undefined)
    const [attempt, setAttempt] = useState(0)

    const onSubmitRef = useRef(onSubmit)
    onSubmitRef.current = onSubmit
    const submittedRef = useRef(false)

    // Create (and re-create on restart) the step-bound session.
    useEffect(() => {
        let cancelled = false
        setPhase('loading')
        setLocalError(undefined)
        setRemaining(null)
        setSession(null)
        submittedRef.current = false
        ;(async () => {
            try {
                const s = await onRequestSession()
                if (cancelled) return
                if (!s || !s.qrSessionId) {
                    setPhase('failed')
                    return
                }
                setSession(s)
                setPhase('waiting')
            } catch (err) {
                if (cancelled) return
                setLocalError(formatApiError(err, t))
                setPhase('failed')
            }
        })()
        return () => { cancelled = true }
    }, [onRequestSession, t, attempt])

    // Poll while waiting; one interval drives both the poll and the countdown.
    useEffect(() => {
        if (phase !== 'waiting' || !session) return
        let cancelled = false

        const tick = async () => {
            if (session.expiresAtEpochSeconds) {
                const secsLeft = Math.round(session.expiresAtEpochSeconds - Date.now() / 1000)
                if (!cancelled) setRemaining(secsLeft)
                if (secsLeft <= 0) {
                    if (!cancelled) setPhase('expired')
                    return
                }
            }
            let status: string
            try {
                const poll = await pollSession(session.qrSessionId)
                status = poll.status
            } catch (err) {
                if (!cancelled) setLocalError(formatApiError(err, t))
                return // transient — keep polling
            }
            if (cancelled) return
            setLocalError(undefined)
            if (status === 'APPROVED') {
                if (!submittedRef.current) {
                    submittedRef.current = true
                    onSubmitRef.current(session.qrSessionId)
                }
            } else if (status === 'EXPIRED' || status === 'REJECTED' || status === 'FAILED') {
                setPhase('expired')
            }
        }

        void tick()
        const id = window.setInterval(() => { void tick() }, POLL_INTERVAL_MS)
        return () => { cancelled = true; window.clearInterval(id) }
    }, [phase, session, pollSession, t])

    const handleRestart = useCallback(() => setAttempt((n) => n + 1), [])

    return (
        <StepLayout
            title={t('mfa.qrCode.title')}
            subtitle={t('qrLogin.instruction', { defaultValue: 'Sign in to the FIVUCSAS app on your phone, then scan this code to approve.' })}
            icon={<QrCode2 sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)"
            iconShadow="0 8px 32px rgba(59, 130, 246, 0.3)"
            error={error}
        >
            {localError && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
                    {localError}
                </Alert>
            )}

            {(phase === 'expired' || phase === 'failed') ? (
                <Stack spacing={2} alignItems="center">
                    <Alert severity="warning" sx={{ borderRadius: '12px', width: '100%' }}>
                        {phase === 'expired'
                            ? t('qrLogin.expired', { defaultValue: 'The QR code expired. Generate a new one.' })
                            : t('qrLogin.startFailed', { defaultValue: 'Could not start the QR session. Try again.' })}
                    </Alert>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleRestart}
                        sx={{ py: 1.3, borderRadius: '12px', textTransform: 'none', fontWeight: 600 }}
                    >
                        {t('qrLogin.restart', { defaultValue: 'Generate a new code' })}
                    </Button>
                    {onBack && (
                        <Button variant="text" startIcon={<ArrowBack />} onClick={onBack}
                            sx={{ color: 'text.secondary', textTransform: 'none' }}>
                            {t('qrLogin.back', { defaultValue: 'Back' })}
                        </Button>
                    )}
                </Stack>
            ) : (
                <motion.div variants={itemVariants}>
                    <Stack spacing={2} alignItems="center">
                        <Box
                            sx={{
                                width: 220, height: 220, borderRadius: '16px',
                                border: '2px solid', borderColor: 'divider',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: '#ffffff', p: 1.5,
                            }}
                        >
                            {phase === 'loading' || !session ? (
                                <CircularProgress size={40} />
                            ) : (
                                <QRCodeSVG
                                    value={qrPayloadForSession(session.qrSessionId)}
                                    size={180}
                                    level="M"
                                    bgColor="#ffffff"
                                    fgColor="#1e293b"
                                />
                            )}
                        </Box>

                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <CircularProgress size={18} thickness={5} />
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                {loading
                                    ? t('qrLogin.completing', { defaultValue: 'Approved — finishing…' })
                                    : t('qrLogin.waiting', { defaultValue: 'Waiting for approval on your phone…' })}
                            </Typography>
                        </Stack>
                        {remaining !== null && (
                            <Typography variant="caption" color="text.secondary">
                                {t('qrLogin.expiresIn', { time: formatTime(remaining), defaultValue: `Expires in ${formatTime(remaining)}` })}
                            </Typography>
                        )}
                    </Stack>
                </motion.div>
            )}
        </StepLayout>
    )
}
