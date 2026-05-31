import { Box, Card, CardActionArea, Typography, Chip, Avatar, CircularProgress } from '@mui/material'
import { Star } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { METHOD_ICONS } from '../StepProgress.helpers'

/**
 * i18n keys for each MFA method type descriptions
 */
const METHOD_I18N_KEYS: Record<string, string> = {
    PASSWORD: 'mfa.password.subtitle',
    EMAIL_OTP: 'mfa.emailOtp.subtitle',
    SMS_OTP: 'mfa.smsOtp.subtitle',
    TOTP: 'mfa.totp.subtitle',
    FACE: 'mfa.face.subtitle',
    VOICE: 'mfa.voice.subtitle',
    FINGERPRINT: 'mfa.fingerprint.subtitle',
    HARDWARE_KEY: 'mfa.hardwareKey.subtitle',
    QR_CODE: 'mfa.qrCode.subtitle',
    NFC_DOCUMENT: 'mfa.nfc.subtitle',
}

interface AvailableMethod {
    methodType: string
    name: string
    category: string
    enrolled: boolean
    preferred: boolean
    requiresEnrollment: boolean
}

interface MethodPickerStepProps {
    availableMethods: AvailableMethod[]
    onMethodSelected: (methodType: string) => void
    loading?: boolean
    /**
     * Method types already completed in an EARLIER layer of this login. They are
     * shown DISABLED with an "Already used" label (not hidden) — a multi-factor
     * login requires a different factor per layer. The server enforces this too
     * (METHOD_ALREADY_USED), this is the visual reflection.
     */
    usedMethods?: string[]
}

/** Display order: selectable (enrolled & not used) → already-used → not-enrolled. */
function methodRank(m: AvailableMethod, used: string[]): number {
    if (used.includes(m.methodType)) return 1
    if (!m.enrolled) return 2
    return 0
}

/**
 * MethodPickerStep
 *
 * Displays a list of available MFA methods as selectable cards.
 * Enrolled methods are clickable; non-enrolled methods are disabled.
 */
export default function MethodPickerStep({
    availableMethods,
    onMethodSelected,
    loading = false,
    usedMethods = [],
}: MethodPickerStepProps) {
    const { t } = useTranslation()

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <Typography
                variant="h5"
                sx={{ fontWeight: 700, mb: 0.5, textAlign: 'center' }}
            >
                {t('mfa.chooseMethod')}
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, textAlign: 'center' }}
            >
                {t('mfa.chooseMethodSubtitle')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Show ALL of the layer's configured methods — never hide. Each is
                    in one of three states: selectable (enrolled & not used), "Already
                    used" (a prior layer), or "Not enrolled". Order: actionable first,
                    then used, then not-enrolled. */}
                {[...availableMethods]
                .sort((a, b) => methodRank(a, usedMethods) - methodRank(b, usedMethods))
                .map((method) => {
                    const used = usedMethods.includes(method.methodType)
                    const iconKey = method.methodType.toLowerCase()
                    const icon = METHOD_ICONS[iconKey]
                    const i18nKey = METHOD_I18N_KEYS[method.methodType]
                    const description = i18nKey ? t(i18nKey) : method.name
                    const labelKey = `enrollmentPage.methods.${method.methodType}.label`
                    const translatedLabel = t(labelKey)
                    const displayName = translatedLabel === labelKey ? method.name : translatedLabel
                    // Used (in a prior layer) OR not enrolled → not selectable.
                    const disabled = used || !method.enrolled

                    return (
                        <Card
                            key={method.methodType}
                            variant="outlined"
                            sx={{
                                borderRadius: '12px',
                                opacity: disabled ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                                flexShrink: 0,
                                position: 'relative',
                                border: method.preferred ? '2px solid' : '1px solid',
                                borderColor: method.preferred
                                    ? 'primary.main'
                                    : 'divider',
                                ...(!disabled && {
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                                        transform: 'translateY(-1px)',
                                    },
                                }),
                            }}
                        >
                            <CardActionArea
                                disabled={disabled}
                                onClick={() => onMethodSelected(method.methodType)}
                                sx={{ p: 2, pr: 10 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    {/* Icon */}
                                    <Avatar
                                        sx={{
                                            bgcolor: disabled
                                                ? 'action.disabledBackground'
                                                : 'primary.main',
                                            width: 44,
                                            height: 44,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Box sx={{ color: 'white', display: 'flex' }}>
                                            {icon ?? null}
                                        </Box>
                                    </Avatar>

                                    {/* Text */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography
                                                variant="subtitle2"
                                                sx={{ fontWeight: 600 }}
                                            >
                                                {displayName}
                                            </Typography>
                                            {method.preferred && (
                                                <Star
                                                    sx={{
                                                        fontSize: 16,
                                                        color: 'warning.main',
                                                    }}
                                                />
                                            )}
                                        </Box>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {description}
                                        </Typography>
                                    </Box>

                                </Box>

                                {/* Status chip — three states: Ready / Already used / Not enrolled */}
                                <Chip
                                    label={
                                        used
                                            ? t('mfa.alreadyUsed')
                                            : method.enrolled
                                              ? t('mfa.enrolled')
                                              : t('mfa.notEnrolled')
                                    }
                                    size="small"
                                    color={used ? 'warning' : method.enrolled ? 'success' : 'default'}
                                    variant={!used && method.enrolled ? 'filled' : 'outlined'}
                                    sx={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 12,
                                        borderRadius: '8px',
                                        fontWeight: 500,
                                        flexShrink: 0,
                                    }}
                                />

                                {/* Setup hint — only for genuinely not-enrolled methods (not for already-used) */}
                                {!method.enrolled && !used && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: 'block', mt: 1, ml: 7.5 }}
                                    >
                                        {t('mfa.setupInSettings')}
                                    </Typography>
                                )}
                            </CardActionArea>
                        </Card>
                    )
                })}
            </Box>
        </Box>
    )
}
