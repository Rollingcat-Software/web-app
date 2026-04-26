/**
 * AuthMethodCard — a single auth-method tile on the AuthMethodsTestingPage.
 *
 * Visual language borrowed from MethodPickerStep so the playground feels like
 * a natural extension of the real MFA surface: 44px avatar with gradient,
 * subtitle description, secondary meta row.
 */
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Typography,
} from '@mui/material'
import { PlayArrow } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import AuthMethodTaskbar from './AuthMethodTaskbar'
import type { AuthMethodEntry, AuthMethodDifficulty } from './authMethodRegistry'

const DIFFICULTY_COLOR: Record<AuthMethodDifficulty, 'success' | 'warning' | 'error'> = {
    beginner: 'success',
    intermediate: 'warning',
    advanced: 'error',
}

export interface AuthMethodCardProps {
    method: AuthMethodEntry
    onLaunch: (method: AuthMethodEntry) => void
}

export default function AuthMethodCard({ method, onLaunch }: AuthMethodCardProps) {
    const { t } = useTranslation()
    const Icon = method.icon

    const title = t(`${method.i18nKey}.title`)
    const description = t(`${method.i18nKey}.description`)
    const difficultyLabel = t(`authMethodsTesting.difficulty.${method.difficulty}`)

    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: '14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.12)',
                    transform: 'translateY(-2px)',
                },
            }}
        >
            <CardContent
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    p: 2.5,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar
                        sx={{
                            width: 44,
                            height: 44,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ color: 'white' }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700, lineHeight: 1.25 }}
                        >
                            {title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                                label={difficultyLabel}
                                size="small"
                                color={DIFFICULTY_COLOR[method.difficulty]}
                                variant="outlined"
                                sx={{ borderRadius: '6px', fontSize: '0.68rem', height: 20 }}
                            />
                            {method.requiresEnrollment && (
                                <Chip
                                    label={t('authMethodsTesting.requiresEnrollment')}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        height: 20,
                                    }}
                                />
                            )}
                            {method.capability === 'stubbedOnly' && (
                                <Chip
                                    label={t('authMethodsTesting.stubbedOnly')}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        height: 20,
                                    }}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flex: 1 }}
                >
                    {description}
                </Typography>

                <AuthMethodTaskbar platforms={method.platforms} />

                <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    startIcon={<PlayArrow />}
                    onClick={() => onLaunch(method)}
                    sx={{
                        mt: 1,
                        py: 1,
                        textTransform: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                    }}
                >
                    {t('authMethodsTesting.tryButton')}
                </Button>
            </CardContent>
        </Card>
    )
}
