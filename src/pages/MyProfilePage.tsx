import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    Paper,
    Skeleton,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import {
    ArrowForward,
    Business,
    CalendarToday,
    CheckCircle,
    Computer,
    Delete,
    Download,
    Email,
    ExpandLess,
    ExpandMore,
    Face,
    Fingerprint,
    GppGood,
    Key,
    Login,
    Mic,
    Nfc,
    PersonOutline,
    PhoneAndroid,
    PhonelinkLock,
    QrCode2,
    Security,
    Shield,
    SmsOutlined,
    Tablet,
    Timer,
    VerifiedUser,
    Warning,
} from '@mui/icons-material'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUserEnrollments } from '@features/enrollments/hooks/useEnrollments'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ITenantRepository } from '@domain/interfaces/ITenantRepository'
import type { Enrollment } from '@domain/models/Enrollment'

/** Map auth method type to icon */
const METHOD_ICONS: Record<string, React.ReactNode> = {
    FACE: <Face sx={{ fontSize: 20 }} />,
    FINGERPRINT: <Fingerprint sx={{ fontSize: 20 }} />,
    VOICE: <Mic sx={{ fontSize: 20 }} />,
    TOTP: <PhonelinkLock sx={{ fontSize: 20 }} />,
    EMAIL_OTP: <Email sx={{ fontSize: 20 }} />,
    SMS_OTP: <SmsOutlined sx={{ fontSize: 20 }} />,
    QR_CODE: <QrCode2 sx={{ fontSize: 20 }} />,
    HARDWARE_KEY: <Key sx={{ fontSize: 20 }} />,
    NFC_DOCUMENT: <Nfc sx={{ fontSize: 20 }} />,
}

/** i18n translation keys for each auth method */
const METHOD_LABEL_KEYS: Record<string, string> = {
    FACE: 'methods.face',
    FINGERPRINT: 'methods.fingerprint',
    VOICE: 'methods.voice',
    TOTP: 'methods.totp',
    EMAIL_OTP: 'methods.emailOtp',
    SMS_OTP: 'methods.smsOtp',
    QR_CODE: 'methods.qrCode',
    HARDWARE_KEY: 'methods.hardwareKey',
    NFC_DOCUMENT: 'methods.nfcDocument',
}

interface ActivityLog {
    id?: string
    action: string
    ipAddress?: string
    deviceInfo?: string
    createdAt?: string
    timestamp?: string
}

function getDeviceIcon(deviceInfo: string) {
    const lower = deviceInfo.toLowerCase()
    if (lower.includes('android') || lower.includes('iphone')) return <PhoneAndroid fontSize="small" />
    if (lower.includes('ipad') || lower.includes('tablet')) return <Tablet fontSize="small" />
    return <Computer fontSize="small" />
}

function formatDate(dateStr: string | Date | undefined): string {
    if (!dateStr) return 'N/A'
    try {
        return format(new Date(dateStr), 'MMM dd, yyyy HH:mm')
    } catch {
        return 'N/A'
    }
}

function formatDateShort(dateStr: string | Date | undefined): string {
    if (!dateStr) return 'N/A'
    try {
        return format(new Date(dateStr), 'MMM dd, yyyy')
    } catch {
        return 'N/A'
    }
}

export default function MyProfilePage() {
    const { user } = useAuth()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const userId = user?.id ?? ''
    const { enrollments, loading: enrollmentsLoading, revokeEnrollment, refetch: refetchEnrollments } = useUserEnrollments(userId)

    // Activity logs state
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
    const [activityLoading, setActivityLoading] = useState(true)
    const [activityPage, setActivityPage] = useState(0)
    const [activityHasMore, setActivityHasMore] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)

    // Sessions count
    const [sessionsCount, setSessionsCount] = useState<number>(0)

    // Tenant name
    const [tenantName, setTenantName] = useState<string>('')

    // Expanded enrollments
    const [expandedEnrollment, setExpandedEnrollment] = useState<string | null>(null)

    // Delete confirmation dialog
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; methodType: string; label: string }>({
        open: false,
        methodType: '',
        label: '',
    })
    const [deleteLoading, setDeleteLoading] = useState(false)

    // Biometric data delete dialog
    const [deleteAllDialog, setDeleteAllDialog] = useState(false)
    const [deleteAllLoading, setDeleteAllLoading] = useState(false)

    // Export loading
    const [exportLoading, setExportLoading] = useState(false)

    // Snackbar
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    })

    // Fetch activity logs
    const fetchActivity = useCallback(async (page: number, append = false) => {
        try {
            if (!append) setActivityLoading(true)
            else setLoadingMore(true)
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            const response = await httpClient.get<{ content?: ActivityLog[]; items?: ActivityLog[] }>('/my/activity', {
                params: { page, size: 10 },
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawLogs: any[] = response.data.content ?? response.data.items ?? (Array.isArray(response.data) ? response.data : [])
            const mapped: ActivityLog[] = rawLogs.map((l) => ({
                ...l,
                createdAt: l.createdAt ?? l.timestamp ?? null,
            }))
            if (append) {
                setActivityLogs((prev) => [...prev, ...mapped])
            } else {
                setActivityLogs(mapped)
            }
            setActivityHasMore(mapped.length >= 10)
        } catch {
            // Silently handle 403
        } finally {
            setActivityLoading(false)
            setLoadingMore(false)
        }
    }, [])

    // Fetch sessions count
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                const response = await httpClient.get<unknown[]>('/auth/sessions/my')
                setSessionsCount(Array.isArray(response.data) ? response.data.length : 0)
            } catch {
                // Silently handle errors
            }
        }
        if (userId) fetchSessions()
    }, [userId])

    // Fetch tenant name
    useEffect(() => {
        const fetchTenantName = async () => {
            if (!user?.tenantId) return
            try {
                const tenantRepo = container.get<ITenantRepository>(TYPES.TenantRepository)
                const tenant = await tenantRepo.findById(user.tenantId)
                if (tenant) setTenantName(tenant.name)
            } catch {
                // Silently handle errors — fallback to tenantId
            }
        }
        fetchTenantName()
    }, [user?.tenantId])

    useEffect(() => {
        if (userId) fetchActivity(0)
    }, [userId, fetchActivity])

    const handleLoadMore = () => {
        const nextPage = activityPage + 1
        setActivityPage(nextPage)
        fetchActivity(nextPage, true)
    }

    const enrolledMethods = enrollments.filter(
        (e) => (typeof e.isSuccessful === 'function' ? e.isSuccessful() : e.status === 'ENROLLED' || e.status === 'SUCCESS')
    )

    const pendingMethods = enrollments.filter(
        (e) => (typeof e.isInProgress === 'function' ? e.isInProgress() : e.status === 'PENDING' || e.status === 'PROCESSING')
    )

    // Computed stats
    const daysSinceRegistration = user?.createdAt
        ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    const loginCount = activityLogs.filter((l) => l.action === 'USER_LOGIN').length
    const totalEnrollments = enrolledMethods.length

    // Delete enrollment handler
    const handleDeleteEnrollment = async () => {
        if (!deleteDialog.methodType) return
        setDeleteLoading(true)
        try {
            await revokeEnrollment(deleteDialog.methodType)
            setSnackbar({ open: true, message: t('myProfile.enrollmentDeleted'), severity: 'success' })
            setDeleteDialog({ open: false, methodType: '', label: '' })
        } catch {
            setSnackbar({ open: true, message: t('myProfile.enrollmentDeleteError'), severity: 'error' })
        } finally {
            setDeleteLoading(false)
        }
    }

    // Delete all biometric data
    const handleDeleteAllBiometric = async () => {
        setDeleteAllLoading(true)
        try {
            for (const enrollment of enrolledMethods) {
                if (enrollment.authMethodType) {
                    await revokeEnrollment(enrollment.authMethodType)
                }
            }
            await refetchEnrollments()
            setSnackbar({ open: true, message: t('myProfile.allBiometricDeleted'), severity: 'success' })
            setDeleteAllDialog(false)
        } catch {
            setSnackbar({ open: true, message: t('myProfile.deleteBiometricError'), severity: 'error' })
        } finally {
            setDeleteAllLoading(false)
        }
    }

    // Export data handler
    const handleExportData = async () => {
        setExportLoading(true)
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                profile: user?.toJSON() ?? {},
                enrollments: enrollments.map((e) => e.toJSON()),
                recentActivity: activityLogs,
            }
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `fivucsas-profile-export-${format(new Date(), 'yyyy-MM-dd')}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            setSnackbar({ open: true, message: t('myProfile.exportSuccess'), severity: 'success' })
        } catch {
            setSnackbar({ open: true, message: t('myProfile.exportError'), severity: 'error' })
        } finally {
            setExportLoading(false)
        }
    }

    const isLoading = enrollmentsLoading || activityLoading

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight={600}>
                {t('myProfile.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('myProfile.subtitle')}
            </Typography>

            {isLoading && <LinearProgress sx={{ mb: 2 }} />}

            <Grid container spacing={3}>
                {/* ===== Section 1: Account Overview ===== */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                                <PersonOutline sx={{ color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {t('myProfile.accountOverview')}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
                                <Avatar
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        bgcolor: 'primary.main',
                                        fontSize: '2rem',
                                        fontWeight: 700,
                                    }}
                                >
                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                                </Avatar>

                                <Grid container spacing={2} sx={{ flex: 1 }}>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Typography variant="caption" color="text.secondary">{t('myProfile.fullName')}</Typography>
                                        <Typography variant="body1" fontWeight={500}>{user?.fullName || 'N/A'}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Typography variant="caption" color="text.secondary">{t('common.email')}</Typography>
                                        <Typography variant="body1" fontWeight={500}>{user?.email || 'N/A'}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Typography variant="caption" color="text.secondary">{t('common.role')}</Typography>
                                        <Box>
                                            <Chip
                                                label={user?.role?.replace(/_/g, ' ')}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Typography variant="caption" color="text.secondary">{t('common.tenant')}</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Business sx={{ fontSize: 16, color: 'text.secondary' }} />
                                            <Typography variant="body1">{tenantName || user?.tenantId || t('common.default')}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Typography variant="caption" color="text.secondary">{t('myProfile.memberSince')}</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                                            <Typography variant="body1">{formatDateShort(user?.createdAt)}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Typography variant="caption" color="text.secondary">{t('myProfile.accountStatus')}</Typography>
                                        <Box>
                                            <Chip
                                                icon={user?.isActive() ? <CheckCircle /> : <Warning />}
                                                label={user?.status?.replace(/_/g, ' ') || t('common.active')}
                                                size="small"
                                                color={user?.isActive() ? 'success' : 'warning'}
                                            />
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* ===== Section 5: Account Statistics ===== */}
                <Grid item xs={6} sm={3}>
                    <Card sx={{ textAlign: 'center' }}>
                        <CardContent sx={{ py: 2 }}>
                            <Login sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
                            <Typography variant="h5" fontWeight={700}>{loginCount}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('myProfile.recentLogins')}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ textAlign: 'center' }}>
                        <CardContent sx={{ py: 2 }}>
                            <Fingerprint sx={{ fontSize: 28, color: 'success.main', mb: 0.5 }} />
                            <Typography variant="h5" fontWeight={700}>{totalEnrollments}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('myProfile.enrolledMethodsCount')}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ textAlign: 'center' }}>
                        <CardContent sx={{ py: 2 }}>
                            <CalendarToday sx={{ fontSize: 28, color: 'info.main', mb: 0.5 }} />
                            <Typography variant="h5" fontWeight={700}>{daysSinceRegistration}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('myProfile.daysSinceRegistration')}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card sx={{ textAlign: 'center' }}>
                        <CardContent sx={{ py: 2 }}>
                            <Timer sx={{ fontSize: 28, color: 'warning.main', mb: 0.5 }} />
                            <Typography variant="h5" fontWeight={700} sx={{ fontSize: user?.lastLoginAt ? '0.9rem' : undefined }}>
                                {user?.lastLoginAt ? formatDate(user.lastLoginAt) : 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{t('myProfile.lastLogin')}</Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* ===== Section 2: Enrolled Biometric Methods ===== */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Fingerprint sx={{ color: 'primary.main' }} />
                                    <Typography variant="h6" fontWeight={600}>
                                        {t('myProfile.enrolledMethods')}
                                    </Typography>
                                </Box>
                                <Chip
                                    label={`${enrolledMethods.length} ${t('myProfile.active')}`}
                                    size="small"
                                    color={enrolledMethods.length > 0 ? 'success' : 'default'}
                                />
                            </Box>

                            {enrollmentsLoading ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={48} />)}
                                </Box>
                            ) : enrollments.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {t('myProfile.noEnrollments')}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate('/enrollment')}
                                        endIcon={<ArrowForward />}
                                    >
                                        {t('myProfile.enrollNow')}
                                    </Button>
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {enrollments.map((enrollment) => (
                                        <EnrollmentCard
                                            key={enrollment.id}
                                            enrollment={enrollment}
                                            expanded={expandedEnrollment === enrollment.id}
                                            onToggle={() => setExpandedEnrollment(
                                                expandedEnrollment === enrollment.id ? null : enrollment.id
                                            )}
                                            onDelete={() => {
                                                const methodType = enrollment.authMethodType || ''
                                                const labelKey = METHOD_LABEL_KEYS[methodType]
                                                setDeleteDialog({
                                                    open: true,
                                                    methodType,
                                                    label: labelKey ? t(labelKey) : methodType.replace(/_/g, ' '),
                                                })
                                            }}
                                            t={t}
                                        />
                                    ))}

                                    {pendingMethods.length > 0 && (
                                        <Alert severity="info" sx={{ mt: 1 }}>
                                            {t('myProfile.pendingEnrollments', { count: pendingMethods.length })}
                                        </Alert>
                                    )}

                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => navigate('/enrollment')}
                                        endIcon={<ArrowForward />}
                                        sx={{ mt: 1 }}
                                    >
                                        {t('myProfile.enrollNew')}
                                    </Button>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* ===== Section 4: Security Status ===== */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <GppGood sx={{ color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {t('myProfile.securityStatus')}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <SecurityRow
                                    icon={<Shield />}
                                    label={t('myProfile.twoFactorAuth')}
                                    value={
                                        enrolledMethods.some((e) =>
                                            e.authMethodType === 'TOTP' || e.authMethodType === 'HARDWARE_KEY' || e.authMethodType === 'FINGERPRINT'
                                        )
                                            ? t('myProfile.enabled')
                                            : t('myProfile.disabled')
                                    }
                                    color={
                                        enrolledMethods.some((e) =>
                                            e.authMethodType === 'TOTP' || e.authMethodType === 'HARDWARE_KEY' || e.authMethodType === 'FINGERPRINT'
                                        )
                                            ? 'success'
                                            : 'warning'
                                    }
                                />

                                <SecurityRow
                                    icon={<Computer />}
                                    label={t('myProfile.activeSessions')}
                                    value={String(sessionsCount)}
                                    color="info"
                                />

                                <SecurityRow
                                    icon={<Fingerprint />}
                                    label={t('myProfile.enrolledMethodsLabel')}
                                    value={`${enrolledMethods.length} / 9`}
                                    color={enrolledMethods.length > 0 ? 'success' : 'warning'}
                                />

                                <SecurityRow
                                    icon={<VerifiedUser />}
                                    label={t('myProfile.emailVerified')}
                                    value={user?.emailVerified ? t('myProfile.verified') : t('myProfile.notVerified')}
                                    color={user?.emailVerified ? 'success' : 'warning'}
                                />
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => navigate('/settings')}
                                endIcon={<ArrowForward />}
                            >
                                {t('myProfile.manageSecuritySettings')}
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                {/* ===== Section 3: Login History & Activity ===== */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Security sx={{ color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {t('myProfile.loginHistory')}
                                </Typography>
                            </Box>

                            {activityLoading ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}
                                </Box>
                            ) : activityLogs.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                    {t('myProfile.noActivity')}
                                </Typography>
                            ) : (
                                <>
                                    <TableContainer component={Paper} variant="outlined">
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>{t('myProfile.activityAction')}</TableCell>
                                                    <TableCell>{t('myProfile.activityTimestamp')}</TableCell>
                                                    <TableCell>{t('myProfile.activityIp')}</TableCell>
                                                    <TableCell>{t('myProfile.activityDevice')}</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {activityLogs.map((log, index) => (
                                                    <TableRow key={log.id || index} hover>
                                                        <TableCell>
                                                            <Chip
                                                                label={log.action.replace(/_/g, ' ')}
                                                                size="small"
                                                                color={
                                                                    log.action.includes('LOGIN') && !log.action.includes('FAILED')
                                                                        ? 'success'
                                                                        : log.action.includes('FAILED')
                                                                            ? 'error'
                                                                            : 'default'
                                                                }
                                                                sx={{ fontSize: '0.7rem' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {formatDate(log.createdAt)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                                {log.ipAddress || '-'}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                {log.deviceInfo ? getDeviceIcon(log.deviceInfo) : null}
                                                                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                                                    {log.deviceInfo || '-'}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    {activityHasMore && (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                            <Button
                                                variant="text"
                                                onClick={handleLoadMore}
                                                disabled={loadingMore}
                                                startIcon={loadingMore ? <CircularProgress size={16} /> : null}
                                            >
                                                {loadingMore ? t('common.loading') : t('myProfile.loadMore')}
                                            </Button>
                                        </Box>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* ===== Section 6: Data Management ===== */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Download sx={{ color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {t('myProfile.dataManagement')}
                                </Typography>
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                {t('myProfile.kvkkText')}
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={exportLoading ? <CircularProgress size={16} /> : <Download />}
                                    onClick={handleExportData}
                                    disabled={exportLoading}
                                >
                                    {t('myProfile.exportData')}
                                </Button>

                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<Delete />}
                                    onClick={() => setDeleteAllDialog(true)}
                                    disabled={enrolledMethods.length === 0}
                                >
                                    {t('myProfile.deleteAllBiometric')}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Delete enrollment confirmation dialog */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, methodType: '', label: '' })}>
                <DialogTitle>{t('myProfile.deleteEnrollmentTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('myProfile.deleteEnrollmentConfirm', { method: deleteDialog.label })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, methodType: '', label: '' })} disabled={deleteLoading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleDeleteEnrollment}
                        color="error"
                        variant="contained"
                        disabled={deleteLoading}
                        startIcon={deleteLoading ? <CircularProgress size={16} /> : <Delete />}
                    >
                        {t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete all biometric data confirmation dialog */}
            <Dialog open={deleteAllDialog} onClose={() => setDeleteAllDialog(false)}>
                <DialogTitle>{t('myProfile.deleteAllBiometricTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('myProfile.deleteAllBiometricConfirm')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteAllDialog(false)} disabled={deleteAllLoading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleDeleteAllBiometric}
                        color="error"
                        variant="contained"
                        disabled={deleteAllLoading}
                        startIcon={deleteAllLoading ? <CircularProgress size={16} /> : <Delete />}
                    >
                        {t('myProfile.deleteAllConfirm')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

/** Individual enrollment card with expand/collapse */
function EnrollmentCard({
    enrollment,
    expanded,
    onToggle,
    onDelete,
    t,
}: {
    enrollment: Enrollment
    expanded: boolean
    onToggle: () => void
    onDelete: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}) {
    const methodType = enrollment.authMethodType || ''
    const icon = METHOD_ICONS[methodType] || <Security sx={{ fontSize: 20 }} />
    const labelKey = METHOD_LABEL_KEYS[methodType]
    const label = labelKey ? t(labelKey) : methodType.replace(/_/g, ' ')
    const isEnrolled = typeof enrollment.isSuccessful === 'function' ? enrollment.isSuccessful() : enrollment.status === 'ENROLLED' || enrollment.status === 'SUCCESS'

    return (
        <Paper
            variant="outlined"
            sx={{
                borderColor: isEnrolled ? 'success.light' : 'warning.light',
                bgcolor: isEnrolled ? 'rgba(16, 185, 129, 0.04)' : 'rgba(245, 158, 11, 0.04)',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    cursor: 'pointer',
                }}
                onClick={onToggle}
            >
                <Box sx={{ color: isEnrolled ? 'success.main' : 'warning.main' }}>{icon}</Box>
                <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                    {label}
                </Typography>
                <Chip
                    label={isEnrolled ? t('myProfile.enrolled') : t('myProfile.pending')}
                    size="small"
                    color={isEnrolled ? 'success' : 'warning'}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                />
                <IconButton size="small">
                    {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
            </Box>

            <Collapse in={expanded}>
                <Divider />
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">{t('myProfile.enrolledDate')}</Typography>
                        <Typography variant="caption">{formatDate(enrollment.createdAt)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">{t('myProfile.lastUpdated')}</Typography>
                        <Typography variant="caption">{formatDate(enrollment.updatedAt)}</Typography>
                    </Box>
                    {(methodType === 'FACE' || methodType === 'VOICE') && enrollment.qualityScore !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">{t('myProfile.qualityScore')}</Typography>
                            <Typography variant="caption">{Math.round(enrollment.qualityScore * 100)}%</Typography>
                        </Box>
                    )}
                    <Divider sx={{ my: 0.5 }} />
                    <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<Delete />}
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete()
                        }}
                    >
                        {t('myProfile.deleteEnrollment')}
                    </Button>
                </Box>
            </Collapse>
        </Paper>
    )
}

/** Security status row */
function SecurityRow({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode
    label: string
    value: string
    color: 'success' | 'warning' | 'error' | 'info'
}) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ color: `${color}.main` }}>{icon}</Box>
            <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{label}</Typography>
            </Box>
            <Chip
                label={value}
                size="small"
                color={color}
                variant="outlined"
            />
        </Box>
    )
}
