import { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Devices,
    Logout,
    Computer,
    PhoneAndroid,
    Tablet,
    Public,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useSessions } from '@features/settings/hooks/useSessions'
import { useNow } from '@hooks/useNow'
import type { UserSessionResponse } from '@core/repositories/AuthSessionRepository'

import { dedupeSessions } from './sessions.utils'

/**
 * Pick an icon based on device info string
 */
function getDeviceIcon(deviceInfo: string) {
    const lower = deviceInfo.toLowerCase()
    if (lower.includes('android') || lower.includes('iphone')) return <PhoneAndroid />
    if (lower.includes('ipad') || lower.includes('tablet')) return <Tablet />
    return <Computer />
}

/**
 * Format a date string to a human-readable relative or absolute format.
 *
 * `now` must be supplied by the caller (from `useNow`) so that the relative
 * label ("Az önce", "5 dk önce") re-evaluates on each minute tick instead
 * of staying frozen at its first-render value.
 */
function formatSessionDate(
    dateStr: string,
    t: (key: string, options?: Record<string, unknown>) => string,
    now: Date,
): string {
    try {
        const date = new Date(dateStr)
        const diffMs = now.getTime() - date.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMinutes < 1) return t('sessions.justNow')
        if (diffMinutes < 60) return t('sessions.minutesAgo', { count: diffMinutes })
        if (diffHours < 24) return t('sessions.hoursAgo', { count: diffHours })
        if (diffDays < 7) return t('sessions.daysAgo', { count: diffDays })

        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    } catch {
        return dateStr
    }
}

/**
 * Single session row
 */
function SessionRow({
    session,
    revoking,
    onRevoke,
    t,
    now,
}: {
    session: UserSessionResponse
    revoking: string | null
    onRevoke: (sessionId: string) => void
    t: (key: string, options?: Record<string, unknown>) => string
    now: Date
}) {
    const isRevoking = revoking === session.sessionId

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1.5,
                px: 1,
                borderRadius: 1,
                bgcolor: session.isCurrent ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <Box sx={{ mr: 2, color: 'text.secondary' }}>
                {getDeviceIcon(session.deviceInfo)}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                        {session.deviceInfo || t('sessions.unknownDevice')}
                    </Typography>
                    {session.isCurrent && (
                        <Chip
                            label={t('sessions.currentSession')}
                            color="primary"
                            size="small"
                            variant="outlined"
                        />
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Tooltip title={t('sessions.ipAddress')}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Public sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary">
                                {session.ipAddress || '-'}
                            </Typography>
                        </Box>
                    </Tooltip>
                    <Typography variant="caption" color="text.disabled">|</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {t('sessions.signedIn')}: {formatSessionDate(session.createdAt, t, now)}
                    </Typography>
                </Box>
            </Box>

            {!session.isCurrent && (
                <Tooltip title={t('sessions.revokeSession')}>
                    <span>
                        <IconButton
                            color="error"
                            size="small"
                            onClick={() => onRevoke(session.sessionId)}
                            disabled={isRevoking || revoking === 'all'}
                            aria-label={t('sessions.revokeSession')}
                        >
                            {isRevoking ? <CircularProgress size={18} /> : <Logout />}
                        </IconButton>
                    </span>
                </Tooltip>
            )}
        </Box>
    )
}

/**
 * Sessions section for the Settings page.
 * Shows active sessions across devices with revoke capability.
 */
export default function SessionsSection() {
    const { t } = useTranslation()
    const { sessions, loading, error, revoking, revokeSession, revokeAllOther } = useSessions()
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    // Re-render every minute so the "signed in" relative label stays fresh
    // without re-fetching sessions from the backend.
    const now = useNow(60_000)

    const displaySessions = dedupeSessions(sessions)
    const otherSessionCount = displaySessions.filter((s) => !s.isCurrent).length

    const handleRevokeAll = async () => {
        setConfirmDialogOpen(false)
        try {
            await revokeAllOther()
        } catch {
            // Error handled by hook
        }
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Devices sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                    {t('sessions.title')}
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('sessions.subtitle')}
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box display="flex" justifyContent="center" py={3}>
                    <CircularProgress size={28} />
                </Box>
            ) : displaySessions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {t('sessions.noSessions')}
                </Typography>
            ) : (
                <Box>
                    {displaySessions.map((session, index) => (
                        <Box key={session.sessionId}>
                            <SessionRow
                                session={session}
                                revoking={revoking}
                                onRevoke={revokeSession}
                                t={t}
                                now={now}
                            />
                            {index < displaySessions.length - 1 && <Divider />}
                        </Box>
                    ))}
                </Box>
            )}

            {otherSessionCount > 0 && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={revoking === 'all' ? <CircularProgress size={16} /> : <Logout />}
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={revoking !== null}
                    >
                        {t('sessions.revokeAllOther')}
                    </Button>
                </Box>
            )}

            {/* Confirm revoke all dialog */}
            <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
                <DialogTitle>{t('sessions.revokeAllTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('sessions.revokeAllConfirm', { count: otherSessionCount })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="contained" color="error" onClick={handleRevokeAll}>
                        {t('sessions.revokeAllOther')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    )
}
