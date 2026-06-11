import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    ArrowBack,
    Badge,
    CheckCircle,
    Error as ErrorIcon,
    Fingerprint,
    Person,
    Schedule,
    Verified,
} from '@mui/icons-material'
import { useEnrollment } from '@features/enrollments'
import { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'
import { useTranslation } from 'react-i18next'
import { formatLocale } from '@utils/dateLocale'
import { formatApiError } from '@utils/formatApiError'
import { nullScoreDisplay } from '@utils/enrollmentScore'

function getStatusColor(
    status: EnrollmentStatus
): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
        case EnrollmentStatus.SUCCESS:
        case EnrollmentStatus.ENROLLED:
            return 'success'
        case EnrollmentStatus.PENDING:
            return 'warning'
        case EnrollmentStatus.PROCESSING:
            return 'info'
        case EnrollmentStatus.FAILED:
        case EnrollmentStatus.EXPIRED:
            return 'error'
        case EnrollmentStatus.REVOKED:
            return 'warning'
        case EnrollmentStatus.NOT_ENROLLED:
        default:
            return 'default'
    }
}

interface DetailRowProps {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
}

function DetailRow({ icon, label, value }: DetailRowProps) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
            <Box sx={{ color: 'text.secondary', mr: 2, display: 'flex' }}>{icon}</Box>
            <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                    {label}
                </Typography>
                <Typography variant="body1" component="div">
                    {value}
                </Typography>
            </Box>
        </Box>
    )
}

/**
 * Renders a 0..1 biometric score as a coloured percentage chip, or — when the
 * score is null — either a muted "N/A" (non-biometric method) or a neutral "—"
 * placeholder (biometric method, score not recorded yet). See
 * `@utils/enrollmentScore` for the method classification.
 */
function ScoreValue({
    score,
    authMethodType,
    thresholds,
}: {
    score: number | undefined
    authMethodType: string | undefined
    thresholds: { good: number; ok: number }
}) {
    const { t } = useTranslation()

    if (score == null) {
        if (nullScoreDisplay(authMethodType) === 'notApplicable') {
            return (
                <Typography variant="body2" color="text.disabled">
                    {t('common.notApplicable')}
                </Typography>
            )
        }
        return <Typography variant="body2" color="text.secondary">—</Typography>
    }

    const color = score >= thresholds.good ? 'success' : score >= thresholds.ok ? 'warning' : 'error'
    return (
        <Chip
            label={`${(score * 100).toFixed(1)}%`}
            size="small"
            color={color}
            variant="outlined"
        />
    )
}

export default function EnrollmentDetailsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const { enrollment, loading, error } = useEnrollment(id ?? '')

    if (!id) {
        return <Navigate to="/enrollments" replace />
    }

    const backButton = (
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/enrollments')} sx={{ mb: 2 }}>
            {t('enrollments.backToList')}
        </Button>
    )

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress aria-label={t('a11y.loadingEnrollmentDetails')} />
            </Box>
        )
    }

    if (error) {
        return (
            <Box>
                {backButton}
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="error" gutterBottom>
                        {t('errors.failedToLoad')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {formatApiError(error, t)}
                    </Typography>
                </Paper>
            </Box>
        )
    }

    if (!enrollment) {
        return (
            <Box>
                {backButton}
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                        {t('enrollments.notFound')}
                    </Typography>
                </Paper>
            </Box>
        )
    }

    const e: Enrollment = enrollment
    const formatDate = (d?: Date) =>
        d ? formatLocale(d, i18n.language, 'PPp') : '—'

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/enrollments')}>
                    {t('enrollments.backToList')}
                </Button>
            </Box>

            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom fontWeight={600}>
                    {t('enrollments.detailsTitle')}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {t('enrollments.detailsSubtitle')}
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Summary Card */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <Box sx={{ color: 'primary.main', mb: 1 }}>
                            {e.isSuccessful() ? (
                                <CheckCircle sx={{ fontSize: 64 }} color="success" />
                            ) : e.hasFailed() ? (
                                <ErrorIcon sx={{ fontSize: 64 }} color="error" />
                            ) : (
                                <Fingerprint sx={{ fontSize: 64 }} />
                            )}
                        </Box>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            {e.authMethodType ?? t('common.notApplicable')}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                            <Chip
                                label={e.status}
                                color={getStatusColor(e.status)}
                                size="small"
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* User Card */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            {t('enrollments.userSection')}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Person />}
                                    label={t('enrollments.userName')}
                                    value={e.userName ?? '—'}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Person />}
                                    label={t('enrollments.userEmail')}
                                    value={e.userEmail ?? '—'}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Badge />}
                                    label={t('common.userId')}
                                    value={
                                        <Typography variant="body2" fontFamily="monospace">
                                            {e.userId}
                                        </Typography>
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Badge />}
                                    label={t('enrollments.authMethod')}
                                    value={e.authMethodType ?? '—'}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* Scores + Timeline Card */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            {t('enrollments.resultsSection')}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Verified />}
                                    label={t('enrollments.qualityScore')}
                                    value={
                                        <ScoreValue
                                            score={e.qualityScore}
                                            authMethodType={e.authMethodType}
                                            thresholds={{ good: 0.7, ok: 0.4 }}
                                        />
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Verified />}
                                    label={t('enrollments.livenessScore')}
                                    value={
                                        <ScoreValue
                                            score={e.livenessScore}
                                            authMethodType={e.authMethodType}
                                            thresholds={{ good: 0.8, ok: 0.5 }}
                                        />
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Schedule />}
                                    label={t('enrollments.createdAt')}
                                    value={formatDate(e.createdAt)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Schedule />}
                                    label={t('enrollments.completedAt')}
                                    value={formatDate(e.completedAt)}
                                />
                            </Grid>
                        </Grid>

                        {(e.errorCode || e.errorMessage) && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle2" color="error" gutterBottom>
                                    {t('enrollments.errorSection')}
                                </Typography>
                                {e.errorCode && (
                                    <DetailRow
                                        icon={<ErrorIcon color="error" />}
                                        label={t('enrollments.errorCode')}
                                        value={
                                            <Tooltip title={e.errorMessage ?? ''}>
                                                <Typography variant="body2" color="error">
                                                    {e.errorCode}
                                                </Typography>
                                            </Tooltip>
                                        }
                                    />
                                )}
                                {e.errorMessage && (
                                    <DetailRow
                                        icon={<ErrorIcon color="error" />}
                                        label={t('enrollments.errorMessage')}
                                        value={
                                            <Typography variant="body2" color="error">
                                                {e.errorMessage}
                                            </Typography>
                                        }
                                    />
                                )}
                            </>
                        )}
                    </Paper>
                </Grid>

                {/* Enrollment ID Card */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default', height: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                            {t('enrollments.enrollmentId')}
                        </Typography>
                        <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                            {e.id}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    )
}
