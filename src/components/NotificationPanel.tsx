import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Badge,
    Box,
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
    Error as ErrorIcon,
    Fingerprint,
    Login,
    Notifications,
    PersonAdd,
    Security,
    Settings,
} from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuditLogService } from '@domain/interfaces/IAuditLogService'
import type { AuditLog } from '@domain/models/AuditLog'
import { useTranslation } from 'react-i18next'

const POLL_INTERVAL = 30_000 // 30 seconds
const MAX_NOTIFICATIONS = 10

function getActionIcon(action: string) {
    switch (action) {
        case 'USER_LOGIN':
            return <Login fontSize="small" color="info" />
        case 'USER_CREATED':
            return <PersonAdd fontSize="small" color="success" />
        case 'FAILED_LOGIN_ATTEMPT':
            return <ErrorIcon fontSize="small" color="error" />
        case 'BIOMETRIC_VERIFICATION':
            return <Fingerprint fontSize="small" color="primary" />
        case 'PASSWORD_RESET':
            return <Security fontSize="small" color="warning" />
        case 'SETTINGS_UPDATED':
            return <Settings fontSize="small" color="action" />
        default:
            return <CheckCircle fontSize="small" color="action" />
    }
}

function formatTimeAgo(date: Date, t: (key: string) => string): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays = Math.floor(diffMs / 86_400_000)

    if (diffMin < 1) return t('notifications.justNow')
    if (diffMin < 60) return t('notifications.minutesAgo').replace('{{n}}', String(diffMin))
    if (diffHours < 24) return t('notifications.hoursAgo').replace('{{n}}', String(diffHours))
    return t('notifications.daysAgo').replace('{{n}}', String(diffDays))
}

export default function NotificationPanel() {
    const { t } = useTranslation()
    const auditLogService = useService<IAuditLogService>(TYPES.AuditLogService)

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const [notifications, setNotifications] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const lastSeenRef = useRef<string | null>(null)

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true)
            const result = await auditLogService.getAuditLogs(
                undefined,
                0,
                MAX_NOTIFICATIONS
            )
            setNotifications(result.items)

            // Count new items since last seen
            if (lastSeenRef.current) {
                const newCount = result.items.filter(
                    (item) => item.id !== lastSeenRef.current && item.createdAt > new Date(localStorage.getItem('fivucsas_last_notification') || 0)
                ).length
                setUnreadCount(newCount)
            } else {
                // First load: mark all as read
                const stored = localStorage.getItem('fivucsas_last_notification')
                if (stored) {
                    const lastTime = new Date(stored)
                    const newCount = result.items.filter((item) => item.createdAt > lastTime).length
                    setUnreadCount(newCount)
                }
            }
        } catch {
            // Silently fail - notifications are not critical
        } finally {
            setLoading(false)
        }
    }, [auditLogService])

    // Initial fetch and polling
    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, POLL_INTERVAL)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget)
        // Mark all as read
        setUnreadCount(0)
        if (notifications.length > 0) {
            lastSeenRef.current = notifications[0].id
            localStorage.setItem('fivucsas_last_notification', new Date().toISOString())
        }
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

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
                        sx: { width: 360, maxHeight: 480, overflow: 'hidden' },
                    },
                }}
            >
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                        {t('notifications.title')}
                    </Typography>
                    {loading && <CircularProgress size={16} />}
                </Box>
                <Divider />

                {notifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Notifications sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            {t('notifications.empty')}
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                        {notifications.map((log) => (
                            <ListItem
                                key={log.id}
                                sx={{
                                    py: 1.5,
                                    '&:hover': { bgcolor: 'action.hover' },
                                    borderLeft: log.isFailed() ? '3px solid' : 'none',
                                    borderColor: 'error.main',
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    {getActionIcon(log.action)}
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Typography variant="body2" fontWeight={500}>
                                            {log.getActionDescription()}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTimeAgo(log.createdAt, t)}
                                            {log.ipAddress && ` \u00B7 ${log.ipAddress}`}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Popover>
        </>
    )
}
