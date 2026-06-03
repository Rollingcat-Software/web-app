/**
 * ApproveLoginMfaStep — APPROVE_LOGIN as a mid-flow MFA FACTOR (number-matching,
 * no Firebase). Two-phase like the QR factor:
 *   1. on mount, the renderer's `onRequestApproval` POSTs the APPROVE_LOGIN step
 *      with `action:"challenge"` → the server creates a STEP-BOUND approve
 *      session for this user and returns a 2-digit `matchNumber` + session id;
 *   2. we display the number and POLL; the user's already-signed-in phone sees
 *      the same pending request in "Login Requests", taps the matching number,
 *      and approves it. On APPROVED we submit the `approveSessionId` to complete
 *      the step (no token to type → nothing to self-fill).
 *
 * `matchNumber` is a STRING ("07") — never coerce to a number (leading zero drops).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { PhonelinkLock, ArrowBack } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'
import { formatApiError } from '@utils/formatApiError'

export interface ApproveStepSession {
    approveSessionId: string
    matchNumber: string
    expiresAtEpochSeconds?: number
}

interface ApproveLoginMfaStepProps {
    /** Phase 1 — challenge the APPROVE_LOGIN step; returns the step-bound session. */
    onRequestApproval: () => Promise<ApproveStepSession | null>
    /** Poll the approve session status (GET /auth/approve-login/session/{id}). */
    pollApproval: (approveSessionId: string) => Promise<{ status: string }>
    /** Phase 2 — submit the APPROVED session id to complete the step. */
    onSubmit: (approveSessionId: string) => void
    loading: boolean
    error?: string
    onBack?: () => void
}

const POLL_INTERVAL_MS = 2000

function formatTime(seconds: number): string {
    const safe = Math.max(0, seconds)
    const mins = Math.floor(safe / 60)
    const secs = safe % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function ApproveLoginMfaStep({
    onRequestApproval,
    pollApproval,
    onSubmit,
    loading,
    error,
    onBack,
}: ApproveLoginMfaStepProps) {
    const { t } = useTranslation()

    type Phase = 'loading' | 'waiting' | 'expired' | 'failed'
    const [phase, setPhase] = useState<Phase>('loading')
    const [session, setSession] = useState<ApproveStepSession | null>(null)
    const [remaining, setRemaining] = useState<number | null>(null)
    const [localError, setLocalError] = useState<string | undefined>(undefined)
    const [attempt, setAttempt] = useState(0)

    const onSubmitRef = useRef(onSubmit)
    onSubmitRef.current = onSubmit
    const submittedRef = useRef(false)

    useEffect(() => {
        let cancelled = false
        setPhase('loading')
        setLocalError(undefined)
        setRemaining(null)
        setSession(null)
        submittedRef.current = false
        ;(async () => {
            try {
                const s = await onRequestApproval()
                if (cancelled) return
                if (!s || !s.approveSessionId) {
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
    }, [onRequestApproval, t, attempt])

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
                const poll = await pollApproval(session.approveSessionId)
                status = poll.status
            } catch (err) {
                if (!cancelled) setLocalError(formatApiError(err, t))
                return
            }
            if (cancelled) return
            setLocalError(undefined)
            if (status === 'APPROVED') {
                if (!submittedRef.current) {
                    submittedRef.current = true
                    onSubmitRef.current(session.approveSessionId)
                }
            } else if (status === 'DENIED' || status === 'EXPIRED' || status === 'FAILED') {
                setPhase('expired')
            }
        }

        void tick()
        const id = window.setInterval(() => { void tick() }, POLL_INTERVAL_MS)
        return () => { cancelled = true; window.clearInterval(id) }
    }, [phase, session, pollApproval, t])

    const handleRestart = useCallback(() => setAttempt((n) => n + 1), [])

    return (
        <StepLayout
            title={t('approveLogin.title', { defaultValue: 'Approve on your phone' })}
            subtitle={t('approveLogin.mfaInstruction', { defaultValue: 'Open the FIVUCSAS app on your phone, find this request under "Login Requests", and tap the matching number.' })}
            icon={<PhonelinkLock sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            iconShadow="0 8px 32px rgba(99, 102, 241, 0.3)"
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
                            ? t('approveLogin.expired', { defaultValue: 'The request expired or was denied. Try again.' })
                            : t('approveLogin.startFailed', { defaultValue: 'Could not start the approval. Try again.' })}
                    </Alert>
                    <Button fullWidth variant="contained" onClick={handleRestart}
                        sx={{ py: 1.3, borderRadius: '12px', textTransform: 'none', fontWeight: 600 }}>
                        {t('approveLogin.retry', { defaultValue: 'Try again' })}
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
                    <Stack spacing={2.5} alignItems="center">
                        {/* The match number the user must tap on their phone. */}
                        <Box
                            sx={{
                                minWidth: 120, px: 4, py: 2.5, borderRadius: '20px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 12px 32px -8px rgba(99,102,241,0.5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {phase === 'loading' || !session ? (
                                <CircularProgress size={40} sx={{ color: 'white' }} />
                            ) : (
                                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '3rem', letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>
                                    {session.matchNumber}
                                </Typography>
                            )}
                        </Box>

                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <CircularProgress size={18} thickness={5} />
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                {loading
                                    ? t('qrLogin.completing', { defaultValue: 'Approved — finishing…' })
                                    : t('approveLogin.waiting', { defaultValue: 'Waiting for approval on your phone…' })}
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
