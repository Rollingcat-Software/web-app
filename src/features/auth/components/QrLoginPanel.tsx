/**
 * QrLoginPanel — cross-device "sign in with your phone" initiator.
 *
 * The desktop/web half of scan-to-login: create a QR session, render the QR,
 * and poll until an already-signed-in phone scans + approves it. On APPROVED we
 * either hand tokens to the caller (single Layer-1 / engine-off) or — when the
 * tenant flow needs more steps — surface a "continue here" message (the
 * step-up handoff via mfaSessionToken is a tracked follow-up; we never hang).
 *
 * The approver (scan + approve) lives in the mobile/desktop apps; this panel
 * only initiates and polls. Mirrors ApproveLoginPanel.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material'
import { ArrowBack, QrCode2 } from '@mui/icons-material'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import {
    QR_LOGIN_POLL_INTERVAL_MS,
    pollQrLoginSession,
    qrPayloadForSession,
    startQrLoginSession,
    type QrLoginPoll,
    type QrLoginSession,
} from '../qr-login'

export interface QrLoginResult {
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    role?: string
}

export interface QrLoginPanelProps {
    /** Called with tokens when the sign-in is APPROVED on the phone. */
    onApproved: (result: QrLoginResult) => void
    /**
     * Called when the phone APPROVED a MULTI-STEP tenant's Layer-1 — hands the MFA
     * session up so the shell RESUMES the step-up flow (the bridge) instead of
     * dead-ending at "continue here". When omitted, falls back to that message.
     */
    onMfaPending?: (handoff: { mfaSessionToken: string; currentStep?: number; totalSteps?: number; availableMethods?: string[] }) => void
    /** Dismiss the panel (back to the main login form). */
    onCancel: () => void
}

type Phase = 'loading' | 'waiting' | 'scanned' | 'expired' | 'mfa' | 'failed'

/** Format remaining seconds as m:ss. */
function formatTime(seconds: number): string {
    const safe = Math.max(0, seconds)
    const mins = Math.floor(safe / 60)
    const secs = safe % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function QrLoginPanel({ onApproved, onMfaPending, onCancel }: QrLoginPanelProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [phase, setPhase] = useState<Phase>('loading')
    const [session, setSession] = useState<QrLoginSession | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [remaining, setRemaining] = useState<number | null>(null)
    // Bumped to force a fresh session on "start again".
    const [attempt, setAttempt] = useState(0)

    const onApprovedRef = useRef(onApproved)
    onApprovedRef.current = onApproved
    const onMfaPendingRef = useRef(onMfaPending)
    onMfaPendingRef.current = onMfaPending

    // Create a session (and re-create on restart).
    useEffect(() => {
        let cancelled = false
        setPhase('loading')
        setError(null)
        setRemaining(null)
        setSession(null)
        ;(async () => {
            try {
                const s = await startQrLoginSession(httpClient, 'WEB')
                if (cancelled) return
                setSession(s)
                setPhase('waiting')
            } catch (err) {
                if (cancelled) return
                setError(formatApiError(err, t))
                setPhase('failed')
            }
        })()
        return () => {
            cancelled = true
        }
    }, [httpClient, t, attempt])

    const handleRestart = useCallback(() => setAttempt((n) => n + 1), [])

    // Poll the session while waiting/scanned. One interval drives both the poll
    // and the expiry countdown so they can't drift apart.
    useEffect(() => {
        if ((phase !== 'waiting' && phase !== 'scanned') || !session) return

        let cancelled = false

        const tick = async () => {
            const secsLeft = Math.round(
                session.expiresAtEpochSeconds - Date.now() / 1000,
            )
            if (!cancelled) setRemaining(secsLeft)
            if (secsLeft <= 0) {
                if (!cancelled) setPhase('expired')
                return
            }

            let poll: QrLoginPoll
            try {
                poll = await pollQrLoginSession(httpClient, session.sessionId)
            } catch (err) {
                // Transient network error — keep polling, surface the message.
                if (!cancelled) setError(formatApiError(err, t))
                return
            }
            if (cancelled) return
            setError(null)

            if (poll.status === 'APPROVED') {
                if (poll.accessToken) {
                    onApprovedRef.current({
                        accessToken: poll.accessToken,
                        refreshToken: poll.refreshToken,
                        expiresIn: poll.expiresIn,
                        role: poll.role,
                    })
                } else if (onMfaPendingRef.current && poll.mfaSessionToken) {
                    // Approved on the phone, but the tenant flow needs more steps —
                    // bridge the MFA session up so the shell RESUMES the step-up flow
                    // (the user continues into FACE/etc., like an email-first login).
                    onMfaPendingRef.current({
                        mfaSessionToken: poll.mfaSessionToken,
                        currentStep: poll.currentStep,
                        totalSteps: poll.totalSteps,
                        availableMethods: poll.availableMethods,
                    })
                } else {
                    // No bridge wired (or no session token) — fall back to the
                    // "continue here" message rather than hang.
                    setPhase('mfa')
                }
            } else if (poll.status === 'PENDING_APPROVAL') {
                setPhase('scanned')
            } else if (poll.status === 'EXPIRED') {
                setPhase('expired')
            } else if (poll.status === 'REJECTED' || poll.status === 'FAILED') {
                setPhase('expired')
            }
        }

        void tick()
        const id = window.setInterval(() => { void tick() }, QR_LOGIN_POLL_INTERVAL_MS)
        return () => {
            cancelled = true
            window.clearInterval(id)
        }
    }, [phase, session, httpClient, t])

    // ─── Expired / approved-needs-step-up ───────────────────────
    if (phase === 'expired' || phase === 'mfa' || phase === 'failed') {
        const isExpired = phase === 'expired'
        return (
            <Stack spacing={2.5}>
                <Alert severity={phase === 'mfa' ? 'info' : 'warning'} sx={{ borderRadius: 2 }}>
                    {phase === 'mfa'
                        ? t('qrLogin.mfaRequired')
                        : isExpired
                            ? t('qrLogin.expired')
                            : t('qrLogin.startFailed')}
                </Alert>
                {phase !== 'mfa' && (
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleRestart}
                        sx={{ py: 1.3, borderRadius: '12px', textTransform: 'none', fontWeight: 600 }}
                    >
                        {t('qrLogin.restart')}
                    </Button>
                )}
                <Button
                    variant="text"
                    startIcon={<ArrowBack />}
                    onClick={onCancel}
                    sx={{ color: 'text.secondary', textTransform: 'none' }}
                >
                    {t('qrLogin.back')}
                </Button>
            </Stack>
        )
    }

    // ─── Loading / waiting (QR + poll) ──────────────────────────
    return (
        <Stack spacing={3} alignItems="center">
            <Box sx={{ textAlign: 'center' }}>
                <QrCode2 sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" fontWeight={700}>
                    {t('qrLogin.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('qrLogin.instruction')}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ borderRadius: 2, width: '100%' }}>
                    {error}
                </Alert>
            )}

            {/* QR code (white quiet-zone box for scan contrast) */}
            <Box
                sx={{
                    width: 232,
                    height: 232,
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fff',
                    boxShadow: '0 14px 40px -12px rgba(0,0,0,0.35)',
                    p: 2,
                }}
            >
                {phase === 'loading' || !session ? (
                    <CircularProgress />
                ) : (
                    <QRCodeSVG
                        value={qrPayloadForSession(session.sessionId)}
                        size={196}
                        level="M"
                        aria-label={t('qrLogin.qrAria')}
                    />
                )}
            </Box>

            <Stack spacing={1} alignItems="center">
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <CircularProgress size={18} thickness={5} />
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {phase === 'scanned' ? t('qrLogin.scanned') : t('qrLogin.waiting')}
                    </Typography>
                </Stack>
                {remaining !== null && (
                    <Typography variant="caption" color="text.secondary">
                        {t('qrLogin.expiresIn', { time: formatTime(remaining) })}
                    </Typography>
                )}
            </Stack>

            <Button
                variant="text"
                onClick={onCancel}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
            >
                {t('qrLogin.cancel')}
            </Button>
        </Stack>
    )
}
