/**
 * ApproveLoginPanel — number-matching approve-login initiator (Phase 3)
 *
 * The PC/web "initiator" half of the no-Firebase approve-login. The user enters
 * their email, we start a session, render a prominent 2-digit match number, and
 * poll until they tap the matching number in an app where they're already
 * signed in. On APPROVED we hand the tokens to the caller; DENIED/EXPIRED show
 * a recoverable message with a "start again" affordance.
 *
 * The approver side lives in the mobile/desktop apps (agent-* teams); this panel
 * only initiates and polls.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { ArrowBack, PhonelinkLock } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import {
    APPROVE_LOGIN_POLL_INTERVAL_MS,
    pollApproveLoginSession,
    startApproveLoginSession,
    type ApproveLoginPoll,
    type ApproveLoginSession,
} from '../approve-login'

export interface ApproveLoginResult {
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    role?: string
}

export interface ApproveLoginPanelProps {
    /** Pre-fill the email field (e.g. from the login form). */
    initialEmail?: string
    /** Called with tokens when the request is APPROVED on the other device. */
    onApproved: (result: ApproveLoginResult) => void
    /** Dismiss the panel (back to the main login form). */
    onCancel: () => void
}

type Phase = 'email' | 'waiting' | 'denied' | 'expired'

/** Format remaining seconds as m:ss. */
function formatTime(seconds: number): string {
    const safe = Math.max(0, seconds)
    const mins = Math.floor(safe / 60)
    const secs = safe % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function ApproveLoginPanel({
    initialEmail = '',
    onApproved,
    onCancel,
}: ApproveLoginPanelProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [phase, setPhase] = useState<Phase>('email')
    const [email, setEmail] = useState(initialEmail)
    const [session, setSession] = useState<ApproveLoginSession | null>(null)
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [remaining, setRemaining] = useState<number | null>(null)

    // Keep the approved callback stable for the polling effect.
    const onApprovedRef = useRef(onApproved)
    onApprovedRef.current = onApproved

    const handleStart = useCallback(async () => {
        const trimmed = email.trim()
        if (!trimmed) {
            setError(t('approveLogin.emailRequired'))
            return
        }
        setStarting(true)
        setError(null)
        try {
            const s = await startApproveLoginSession(httpClient, trimmed)
            setSession(s)
            setPhase('waiting')
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setStarting(false)
        }
    }, [email, httpClient, t])

    const handleRestart = useCallback(() => {
        setSession(null)
        setError(null)
        setRemaining(null)
        setPhase('email')
    }, [])

    // Poll the session while waiting. A single interval drives both the status
    // poll and the expiry countdown so they can't drift apart.
    useEffect(() => {
        if (phase !== 'waiting' || !session) return

        let cancelled = false

        const tick = async () => {
            // Update the countdown from the authoritative server expiry.
            const secsLeft = Math.round(
                session.expiresAtEpochSeconds - Date.now() / 1000,
            )
            if (!cancelled) setRemaining(secsLeft)
            if (secsLeft <= 0) {
                if (!cancelled) setPhase('expired')
                return
            }

            let poll: ApproveLoginPoll
            try {
                poll = await pollApproveLoginSession(httpClient, session.sessionId)
            } catch (err) {
                // Transient network error — keep polling, surface the message.
                if (!cancelled) setError(formatApiError(err, t))
                return
            }
            if (cancelled) return
            setError(null)

            if (poll.status === 'APPROVED' && poll.accessToken) {
                onApprovedRef.current({
                    accessToken: poll.accessToken,
                    refreshToken: poll.refreshToken,
                    expiresIn: poll.expiresIn,
                    role: poll.role,
                })
            } else if (poll.status === 'DENIED') {
                setPhase('denied')
            } else if (poll.status === 'EXPIRED') {
                setPhase('expired')
            }
        }

        // Run immediately, then on the poll interval.
        void tick()
        const id = window.setInterval(() => { void tick() }, APPROVE_LOGIN_POLL_INTERVAL_MS)
        return () => {
            cancelled = true
            window.clearInterval(id)
        }
    }, [phase, session, httpClient, t])

    // ─── Email entry ────────────────────────────────────────────
    if (phase === 'email') {
        return (
            <Stack spacing={2.5}>
                <Box sx={{ textAlign: 'center' }}>
                    <PhonelinkLock sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6" fontWeight={700}>
                        {t('approveLogin.button')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('approveLogin.buttonHint')}
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    type="email"
                    autoComplete="username"
                    label={t('approveLogin.emailLabel')}
                    placeholder={t('approveLogin.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void handleStart() }
                    }}
                    disabled={starting}
                />

                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={() => { void handleStart() }}
                    disabled={starting}
                    sx={{ py: 1.4, borderRadius: '12px', textTransform: 'none', fontWeight: 600 }}
                >
                    {starting ? <CircularProgress size={22} color="inherit" /> : t('approveLogin.start')}
                </Button>

                <Button
                    variant="text"
                    startIcon={<ArrowBack />}
                    onClick={onCancel}
                    sx={{ color: 'text.secondary', textTransform: 'none' }}
                >
                    {t('approveLogin.back')}
                </Button>
            </Stack>
        )
    }

    // ─── Denied / Expired ───────────────────────────────────────
    if (phase === 'denied' || phase === 'expired') {
        return (
            <Stack spacing={2.5}>
                <Alert severity={phase === 'denied' ? 'error' : 'warning'} sx={{ borderRadius: 2 }}>
                    {phase === 'denied' ? t('approveLogin.denied') : t('approveLogin.expired')}
                </Alert>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleRestart}
                    sx={{ py: 1.3, borderRadius: '12px', textTransform: 'none', fontWeight: 600 }}
                >
                    {t('approveLogin.restart')}
                </Button>
                <Button
                    variant="text"
                    startIcon={<ArrowBack />}
                    onClick={onCancel}
                    sx={{ color: 'text.secondary', textTransform: 'none' }}
                >
                    {t('approveLogin.back')}
                </Button>
            </Stack>
        )
    }

    // ─── Waiting (match number + poll) ──────────────────────────
    return (
        <Stack spacing={3} alignItems="center">
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700}>
                    {t('approveLogin.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('approveLogin.instruction')}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ borderRadius: 2, width: '100%' }}>
                    {error}
                </Alert>
            )}

            {/* Prominent match number */}
            <Box
                role="status"
                aria-label={t('approveLogin.matchAria', { number: session?.matchNumber ?? '' })}
                sx={{
                    width: 120,
                    height: 120,
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 14px 40px -10px rgba(99,102,241,0.6)',
                    color: '#fff',
                }}
            >
                <Typography
                    sx={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontWeight: 800,
                        fontSize: '3.25rem',
                        lineHeight: 1,
                    }}
                >
                    {session?.matchNumber}
                </Typography>
            </Box>

            <Stack spacing={1} alignItems="center">
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <CircularProgress size={18} thickness={5} />
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {t('approveLogin.waiting')}
                    </Typography>
                </Stack>
                {remaining !== null && (
                    <Typography variant="caption" color="text.secondary">
                        {t('approveLogin.expiresIn', { time: formatTime(remaining) })}
                    </Typography>
                )}
            </Stack>

            <Button
                variant="text"
                onClick={onCancel}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
            >
                {t('approveLogin.cancel')}
            </Button>
        </Stack>
    )
}
