import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    Badge,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Popover,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    CheckCircle,
    DoneAll,
    Error as ErrorIcon,
    Fingerprint,
    Login,
    Notifications,
    PersonAdd,
    Security,
    Settings,
    VpnKey,
    Logout,
    LockReset,
    AdminPanelSettings,
} from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import { container } from '@core/di/container'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { IAuditLogService } from '@domain/interfaces/IAuditLogService'
import type { AuditLog } from '@domain/models/AuditLog'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { tr as trLocale, enUS } from 'date-fns/locale'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useNow } from '@hooks/useNow'

const POLL_INTERVAL = 30_000 // 30 seconds
const MAX_NOTIFICATIONS = 20
const STORAGE_KEY_READ_IDS = 'fivucsas_notifications_read'
const STORAGE_KEY_LAST_SEEN = 'fivucsas_last_notification'

// --- Notification categories ---

type NotificationCategory = 'login' | 'security' | 'enrollment' | 'system'

function getNotificationCategory(action: string): NotificationCategory {
    if (['USER_LOGIN', 'USER_LOGOUT', 'USER_LOGIN_FAILED', 'TOKEN_REFRESH', 'MFA_STARTED', 'MFA_STEP_COMPLETED', 'MFA_STEP_FAILED', 'MFA_COMPLETE'].includes(action)) {
        return 'login'
    }
    if (['FAILED_LOGIN_ATTEMPT', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET', 'SECURITY_SETTINGS_UPDATED'].includes(action)) {
        return 'security'
    }
    if (['BIOMETRIC_ENROLLED', 'BIOMETRIC_VERIFIED', 'BIOMETRIC_VERIFICATION_FAILED', 'BIOMETRIC_DELETED'].includes(action)) {
        return 'enrollment'
    }
    return 'system'
}

function getCategoryLabel(category: NotificationCategory, t: (key: string) => string): string {
    switch (category) {
        case 'login': return t('notifications.loginAlerts')
        case 'security': return t('notifications.securityEvents')
        case 'enrollment': return t('notifications.enrollmentChanges')
        case 'system': return t('notifications.systemChanges')
    }
}

function getCategoryColor(category: NotificationCategory): string {
    switch (category) {
        case 'login': return '#3b82f6'
        case 'security': return '#ef4444'
        case 'enrollment': return '#8b5cf6'
        case 'system': return '#64748b'
    }
}

// --- Action icons ---

function getActionIcon(action: string) {
    switch (action) {
        case 'USER_LOGIN':
            return <Login fontSize="small" color="info" />
        case 'USER_LOGOUT':
            return <Logout fontSize="small" color="action" />
        case 'USER_CREATED':
            return <PersonAdd fontSize="small" color="success" />
        case 'FAILED_LOGIN_ATTEMPT':
        case 'USER_LOGIN_FAILED':
            return <ErrorIcon fontSize="small" color="error" />
        case 'BIOMETRIC_ENROLLED':
        case 'BIOMETRIC_VERIFIED':
        case 'BIOMETRIC_VERIFICATION_FAILED':
        case 'BIOMETRIC_DELETED':
            return <Fingerprint fontSize="small" color="primary" />
        case 'PASSWORD_RESET':
        case 'PASSWORD_RESET_REQUEST':
        case 'PASSWORD_CHANGE':
            return <LockReset fontSize="small" color="warning" />
        case 'SECURITY_SETTINGS_UPDATED':
            return <Security fontSize="small" color="warning" />
        case 'SETTINGS_UPDATED':
        case 'NOTIFICATION_SETTINGS_UPDATED':
        case 'APPEARANCE_SETTINGS_UPDATED':
            return <Settings fontSize="small" color="action" />
        case 'ROLE_CREATED':
        case 'ROLE_UPDATED':
        case 'ROLE_DELETED':
        case 'USER_ROLE_ASSIGNED':
        case 'USER_ROLE_REMOVED':
        case 'PERMISSION_ADDED':
        case 'PERMISSION_REMOVED':
            return <AdminPanelSettings fontSize="small" color="action" />
        case 'TOKEN_REFRESH':
            return <VpnKey fontSize="small" color="action" />
        default:
            return <CheckCircle fontSize="small" color="action" />
    }
}

// --- Time formatting ---

/**
 * Format `date` as a relative label ("az önce" / "2 minutes ago").
 *
 * The `_now` param is unused by the formatter but is accepted so the
 * caller (driven by `useNow(60_000)`) triggers a fresh re-render each
 * minute — otherwise the first-render "Az önce" would stay on screen
 * frozen for the lifetime of the component.
 */
function formatTimeAgo(date: Date, language: string, _now: Date): string {
    return formatDistanceToNow(date, {
        addSuffix: true,
        locale: language.startsWith('tr') ? trLocale : enUS,
    })
}

// --- Date grouping ---

type DateGroup = 'today' | 'yesterday' | 'earlier'

function getDateGroup(date: Date): DateGroup {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86_400_000)

    if (date >= today) return 'today'
    if (date >= yesterday) return 'yesterday'
    return 'earlier'
}

function getDateGroupLabel(group: DateGroup, t: (key: string) => string): string {
    switch (group) {
        case 'today': return t('notifications.today')
        case 'yesterday': return t('notifications.yesterday')
        case 'earlier': return t('notifications.earlier')
    }
}

// --- Read state management (localStorage) ---

function getReadIds(): Set<string> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_READ_IDS)
        if (stored) {
            const parsed = JSON.parse(stored) as string[]
            return new Set(parsed)
        }
    } catch { /* ignore */ }
    return new Set()
}

function saveReadIds(ids: Set<string>) {
    // Keep only the most recent 100 IDs to avoid unbounded storage growth
    const arr = Array.from(ids).slice(-100)
    localStorage.setItem(STORAGE_KEY_READ_IDS, JSON.stringify(arr))
}

// --- Extended action descriptions ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getActionDescription(action: string, t: any, details?: Record<string, unknown>): string {
    // Show OAuth client name for login events
    if (action === 'USER_LOGIN' && details?.oauthClient) {
        return `${t('notifications.actions.USER_LOGIN', { defaultValue: 'User logged in' })} via ${details.oauthClient}`
    }
    const key = `notifications.actions.${action}`
    const translated = t(key, { defaultValue: '' })
    if (translated && translated !== key) return translated
    // Fallback when a brand-new backend audit code arrives without an i18n
    // key yet. Title-case the tokens so the UI doesn't show a debug-looking
    // lowercase "mfa complete" string to the user.
    return action
        .split('_')
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .join(' ')
}

/**
 * NotificationPanel
 *
 * Polls audit logs and presents them as a notification feed with:
 * - Per-notification "mark as read" via localStorage
 * - Date grouping (Today / Yesterday / Earlier)
 * - Notification categories (Login / Security / Enrollment / System)
 * - Relative timestamps
 * - Unread count badge
 */
export default function NotificationPanel() {
    const { t, i18n } = useTranslation()
    const { user } = useAuth()
    const auditLogService = useService<IAuditLogService>(TYPES.AuditLogService)

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const [notifications, setNotifications] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(false)
    const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds())
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Tick once a minute so relative timestamps ("az önce" / "2 minutes ago")
    // update as time passes, even when the underlying audit-log list is idle.
    const now = useNow(60_000)

    const unreadCount = useMemo(
        () => notifications.filter((n) => !readIds.has(n.id)).length,
        [notifications, readIds]
    )

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true)
            const isAdmin = user?.isAdmin() ?? false
            if (isAdmin) {
                const result = await auditLogService.getAuditLogs(undefined, 0, MAX_NOTIFICATIONS)
                setNotifications(result.items)
            } else {
                // Non-admin: use own activity endpoint (no 403)
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                const response = await httpClient.get<{ content?: Array<Record<string, unknown>> }>('/my/activity', {
                    params: { page: 0, size: MAX_NOTIFICATIONS }
                })
                const items = response.data.content ?? []
                setNotifications(items.map((item: Record<string, unknown>) => ({
                    id: String(item.id ?? ''),
                    action: String(item.action ?? ''),
                    userId: String(item.userId ?? ''),
                    ipAddress: String(item.ipAddress ?? ''),
                    userAgent: String(item.userAgent ?? ''),
                    details: String(item.details ?? ''),
                    createdAt: item.createdAt ? new Date(String(item.createdAt)) : new Date(),
                    userName: String(item.userName ?? ''),
                    userEmail: String(item.userEmail ?? ''),
                }) as unknown as AuditLog))
            }
        } catch {
            // Silently fail - notifications are not critical
        } finally {
            setLoading(false)
        }
    }, [auditLogService, user])

    // Initial fetch and polling - works for all authenticated users
    useEffect(() => {

        fetchNotifications()
        pollRef.current = setInterval(fetchNotifications, POLL_INTERVAL)
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [fetchNotifications])

    // --- Handlers ---

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleMarkAllRead = () => {
        const newReadIds = new Set(readIds)
        for (const n of notifications) {
            newReadIds.add(n.id)
        }
        setReadIds(newReadIds)
        saveReadIds(newReadIds)
        localStorage.setItem(STORAGE_KEY_LAST_SEEN, new Date().toISOString())
    }

    const handleMarkRead = (id: string) => {
        const newReadIds = new Set(readIds)
        newReadIds.add(id)
        setReadIds(newReadIds)
        saveReadIds(newReadIds)
    }

    // --- Grouped notifications ---

    const groupedNotifications = useMemo(() => {
        const groups = new Map<DateGroup, AuditLog[]>()
        for (const n of notifications) {
            const group = getDateGroup(n.createdAt)
            const arr = groups.get(group)
            if (arr) {
                arr.push(n)
            } else {
                groups.set(group, [n])
            }
        }
        // Return in order: today, yesterday, earlier
        const ordered: Array<{ group: DateGroup; items: AuditLog[] }> = []
        for (const group of ['today', 'yesterday', 'earlier'] as DateGroup[]) {
            const items = groups.get(group)
            if (items && items.length > 0) {
                ordered.push({ group, items })
            }
        }
        return ordered
    }, [notifications])

    const open = Boolean(anchorEl)

    return (
        <>
            <Tooltip title={t('notifications.title')}>
                <IconButton color="inherit" onClick={handleOpen} aria-label={t('notifications.title')}>
                    <Badge badgeContent={unreadCount} color="error" max={9}>
                        <Notifications />
                    </Badge>
                </IconButton>
            </Tooltip>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: { width: 400, maxHeight: 520, overflow: 'hidden', borderRadius: '16px' },
                    },
                }}
            >
                {/* Header */}
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                            {t('notifications.title')}
                        </Typography>
                        {unreadCount > 0 && (
                            <Chip
                                label={unreadCount}
                                size="small"
                                color="error"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                            />
                        )}
                        {loading && <CircularProgress size={14} />}
                    </Box>
                    {unreadCount > 0 && (
                        <Button
                            size="small"
                            startIcon={<DoneAll sx={{ fontSize: 16 }} />}
                            onClick={handleMarkAllRead}
                            sx={{
                                fontSize: '0.75rem',
                                textTransform: 'none',
                                fontWeight: 600,
                                color: 'primary.main',
                            }}
                        >
                            {t('notifications.markAllRead')}
                        </Button>
                    )}
                </Box>
                <Divider />

                {/* a11y FE-H4: notification list is a polite live region so
                    screen readers announce new audit-log entries as they arrive. */}
                {notifications.length === 0 ? (
                    <Box
                        sx={{ p: 4, textAlign: 'center' }}
                        role="status"
                        aria-live="polite"
                    >
                        <Notifications sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            {t('notifications.empty')}
                        </Typography>
                    </Box>
                ) : (
                    <Box
                        sx={{ maxHeight: 420, overflow: 'auto' }}
                        role="status"
                        aria-live="polite"
                    >
                        {groupedNotifications.map(({ group, items }) => (
                            <Box key={group}>
                                {/* Date group header */}
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 0.75,
                                        bgcolor: 'action.hover',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1,
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        fontWeight={700}
                                        color="text.secondary"
                                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                                    >
                                        {getDateGroupLabel(group, t)}
                                    </Typography>
                                </Box>

                                <List sx={{ p: 0 }}>
                                    {items.map((log) => {
                                        const isRead = readIds.has(log.id)
                                        const category = getNotificationCategory(log.action)
                                        return (
                                            <ListItem
                                                key={log.id}
                                                onClick={() => handleMarkRead(log.id)}
                                                sx={{
                                                    py: 1.5,
                                                    px: 2,
                                                    cursor: 'pointer',
                                                    bgcolor: isRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                    borderLeft: (typeof log.isFailed === 'function' ? log.isFailed() : log.action?.includes('FAILED'))
                                                        ? '3px solid'
                                                        : isRead
                                                            ? 'none'
                                                            : '3px solid',
                                                    borderColor: (typeof log.isFailed === 'function' ? log.isFailed() : log.action?.includes('FAILED'))
                                                        ? 'error.main'
                                                        : 'primary.main',
                                                    transition: 'background-color 0.2s',
                                                }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    {getActionIcon(log.action)}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight={isRead ? 400 : 600}
                                                                sx={{ flex: 1 }}
                                                            >
                                                                {getActionDescription(log.action, t, log.details)}
                                                            </Typography>
                                                            <Chip
                                                                label={getCategoryLabel(category, t)}
                                                                size="small"
                                                                sx={{
                                                                    height: 18,
                                                                    fontSize: '0.6rem',
                                                                    fontWeight: 600,
                                                                    bgcolor: `${getCategoryColor(category)}15`,
                                                                    color: getCategoryColor(category),
                                                                    borderRadius: '4px',
                                                                }}
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatTimeAgo(log.createdAt, i18n.language, now)}
                                                            {log.ipAddress && ` \u00B7 ${log.ipAddress}`}
                                                        </Typography>
                                                    }
                                                />
                                            </ListItem>
                                        )
                                    })}
                                </List>
                            </Box>
                        ))}
                    </Box>
                )}
            </Popover>
        </>
    )
}
