/**
 * Renders the catalog of auth methods as a responsive card grid.
 * Each card shows icon, label, description, status chip, and Enroll/Test/Revoke actions.
 *
 * Extracted from EnrollmentPage.tsx during P1-Q7 decomposition. Pure presentation —
 * all action handlers + state come in via props. Behavior unchanged.
 */
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    Typography,
} from '@mui/material'
import { CheckCircle } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { MethodCardConfig } from '../types'
import { METHOD_CONFIGS } from '../methodConfigs'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface Props {
    isMethodEnrolled: (type: AuthMethodType) => boolean
    isMethodAvailable: (config: MethodCardConfig) => boolean
    actionLoading: string | null
    onEnroll: (type: AuthMethodType) => void
    onTest: (type: AuthMethodType) => void
    onRevoke: (type: AuthMethodType) => void
}

export default function MethodCardsGrid({
    isMethodEnrolled,
    isMethodAvailable,
    actionLoading,
    onEnroll,
    onTest,
    onRevoke,
}: Props) {
    const { t } = useTranslation()

    return (
        <Grid container spacing={3}>
            {METHOD_CONFIGS.map((config, index) => {
                const enrolled = isMethodEnrolled(config.type)
                const available = isMethodAvailable(config)
                const isLoading = actionLoading === config.type

                return (
                    <Grid item xs={12} sm={6} md={4} key={config.type}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.4,
                                delay: index * 0.05,
                                ease: easeOut,
                            }}
                        >
                            <Card
                                sx={{
                                    height: '100%',
                                    borderRadius: '16px',
                                    border: '1px solid',
                                    borderColor: enrolled
                                        ? 'success.light'
                                        : 'divider',
                                    opacity: available ? 1 : 0.6,
                                    transition: 'all 0.3s ease',
                                    '&:hover': available
                                        ? {
                                              transform: 'translateY(-4px)',
                                              boxShadow:
                                                  '0 12px 40px rgba(0, 0, 0, 0.1)',
                                          }
                                        : {},
                                }}
                            >
                                <CardContent sx={{ p: 3 }}>
                                    {/* Icon + status */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            mb: 2,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: '14px',
                                                background: config.gradient,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: `0 8px 24px ${config.bgColor}`,
                                            }}
                                        >
                                            {config.icon}
                                        </Box>
                                        {enrolled ? (
                                            <Chip
                                                icon={<CheckCircle />}
                                                label={t('enrollmentPage.statusEnrolled')}
                                                size="small"
                                                color="success"
                                                sx={{ fontWeight: 600 }}
                                            />
                                        ) : !available ? (
                                            <Chip
                                                label={t('enrollmentPage.statusUnavailable')}
                                                size="small"
                                                color="default"
                                                sx={{ fontWeight: 500 }}
                                            />
                                        ) : (
                                            <Chip
                                                label={t('enrollmentPage.statusNotEnrolled')}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontWeight: 500 }}
                                            />
                                        )}
                                    </Box>

                                    {/* Label + description */}
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={700}
                                        sx={{ mb: 0.5 }}
                                    >
                                        {t(config.label)}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 2, minHeight: 40 }}
                                    >
                                        {t(config.description)}
                                    </Typography>

                                    {/* Actions */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            gap: 1,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        {!enrolled && available && (
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() =>
                                                    onEnroll(config.type)
                                                }
                                                disabled={isLoading}
                                                sx={{
                                                    borderRadius: '8px',
                                                    fontWeight: 600,
                                                    textTransform: 'none',
                                                    background: config.gradient,
                                                    '&:hover': {
                                                        opacity: 0.9,
                                                    },
                                                }}
                                            >
                                                {isLoading ? (
                                                    <CircularProgress
                                                        size={16}
                                                        sx={{
                                                            color: 'white',
                                                            mr: 1,
                                                        }}
                                                    />
                                                ) : null}
                                                {t('enrollmentPage.enroll')}
                                            </Button>
                                        )}
                                        {enrolled && (
                                            <>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    color="primary"
                                                    onClick={() =>
                                                        onTest(config.type)
                                                    }
                                                    disabled={isLoading}
                                                    sx={{
                                                        borderRadius: '8px',
                                                        fontWeight: 600,
                                                        textTransform: 'none',
                                                    }}
                                                >
                                                    {t('enrollmentPage.test')}
                                                </Button>
                                                {/* EMAIL_OTP and QR_CODE are auto-bound (no per-user
                                                    secret). The API lazily upserts ENROLLED rows for
                                                    both in getUserEnrollments. Hiding Revoke avoids a
                                                    stuck "not enrolled" state since revoking just
                                                    flips the row back without removing the underlying
                                                    session capability. */}
                                                {config.type !== AuthMethodType.EMAIL_OTP &&
                                                    config.type !== AuthMethodType.QR_CODE && (
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    color="error"
                                                    onClick={() =>
                                                        onRevoke(config.type)
                                                    }
                                                    disabled={isLoading}
                                                    sx={{
                                                        borderRadius: '8px',
                                                        fontWeight: 600,
                                                        textTransform: 'none',
                                                    }}
                                                >
                                                    {t('enrollmentPage.revoke')}
                                                </Button>
                                                )}
                                            </>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                )
            })}
        </Grid>
    )
}
