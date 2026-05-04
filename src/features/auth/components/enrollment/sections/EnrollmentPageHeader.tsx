/**
 * EnrollmentPage header strip — title, subtitle, refresh button, and the
 * enrolled / unavailable count chips.
 *
 * Extracted from EnrollmentPage.tsx during P1-Q7 decomposition.
 */
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { Refresh, VerifiedUser, WarningAmber } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

interface Props {
    enrolledCount: number
    unavailableCount: number
    loading: boolean
    onRefresh: () => void
}

export default function EnrollmentPageHeader({
    enrolledCount,
    unavailableCount,
    loading,
    onRefresh,
}: Props) {
    const { t } = useTranslation()

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                }}
            >
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        {t('enrollmentPage.title')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('enrollmentPage.subtitle')}
                    </Typography>
                </Box>
                <Tooltip title={t('enrollmentPage.refreshTooltip')}>
                    <IconButton
                        onClick={onRefresh}
                        disabled={loading}
                        aria-label={t('common.aria.refresh')}
                        sx={{
                            bgcolor: 'action.hover',
                            '&:hover': { bgcolor: 'action.selected' },
                        }}
                    >
                        <Refresh />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Chip
                    icon={<VerifiedUser />}
                    label={t('enrollmentPage.enrolledCount', { count: enrolledCount })}
                    color="success"
                    variant="outlined"
                />
                <Chip
                    icon={<WarningAmber />}
                    label={t('enrollmentPage.unavailableCount', { count: unavailableCount })}
                    color="warning"
                    variant="outlined"
                />
            </Box>
        </>
    )
}
