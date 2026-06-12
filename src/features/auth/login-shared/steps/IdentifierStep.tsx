/**
 * IdentifierStep — the shared OPENING identity-entry block (email box + Continue)
 *
 * BOTH login surfaces hand-duplicated this identifier-first entry markup:
 *   - dashboard:  `LoginPage` (the non-password Layer-1 identifier block)
 *   - hosted:     `LoginMfaFlow` (FlowPhase.Identifier)
 * They render the same fields + behaviour (subtitle, an email TextField with a
 * mail adornment that submits on Enter, and a Continue button disabled until an
 * identifier is typed). Extracting them here means the two surfaces cannot drift.
 *
 * It is intentionally PRESENTATIONAL + controlled: the value + change/submit
 * handlers + busy flag are owned by the surface's flow. The legitimately-
 * different SHELL chrome (the dashboard's gradient glass card vs the hosted
 * in-card OIDC frame) is injected via the styling props so each surface keeps
 * its look byte-for-byte while sharing the structure/behaviour.
 *
 * i18n: ALL copy comes from `t()` (no hardcoded strings). Defaults match what
 * both surfaces used before extraction (`login.identifierFirstSubtitle`,
 * `auth.emailLabel`, `auth.continue`).
 */
import { Alert, Box, Button, CircularProgress, InputAdornment, TextField, Typography } from '@mui/material'
import { EmailOutlined } from '@mui/icons-material'
import type { SxProps, Theme } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface IdentifierStepProps {
    /** The current identifier (email) value — controlled by the surface. */
    value: string
    /** Update the identifier value. */
    onChange: (value: string) => void
    /** Submit the identifier (Enter key or the Continue button). */
    onSubmit: () => void
    /**
     * True while the surface is processing the submit — drives the button
     * SPINNER (and, unless `disabled` is given, also disables the field+button).
     */
    loading?: boolean
    /**
     * Optional broader disabled override (without showing the spinner). The
     * dashboard disables on the wider `formBusy` while spinning only on
     * `identifierSubmitting`; pass both to preserve that split exactly. When
     * omitted, `loading` alone governs the disabled state.
     */
    disabled?: boolean
    /**
     * Inline error to show above the field (hosted surface shows it here; the
     * dashboard renders its error in a shared Alert higher up and passes none).
     * When omitted, no inline Alert is rendered.
     */
    error?: string
    /**
     * Continue-button styling, so each surface keeps its own look (the dashboard
     * uses a gradient pill; the hosted uses the theme contained button). Defaults
     * to a plain full-width contained button.
     */
    buttonSx?: SxProps<Theme>
    /** Mail-adornment colour token, matching each surface's palette. */
    iconColor?: string
    /** TextField wrapper sx (border radius etc.) — surface-specific. */
    fieldSx?: SxProps<Theme>
    /**
     * Optional Continue-button end icon, shown only when NOT loading (the
     * dashboard shows an ArrowForward; the hosted shows none).
     */
    endIcon?: React.ReactNode
}

/**
 * Render the opening email-entry step. Behaviour is identical on both surfaces;
 * only the injected chrome (button gradient, icon colour, end icon) differs. The
 * caller wraps the whole component if it needs an entrance animation.
 */
export default function IdentifierStep({
    value,
    onChange,
    onSubmit,
    loading = false,
    disabled,
    error,
    buttonSx,
    iconColor = 'text.secondary',
    fieldSx,
    endIcon,
}: IdentifierStepProps) {
    const { t } = useTranslation()
    // `disabled` (broader busy) governs interactivity when given; otherwise the
    // spinner flag does. The button is additionally disabled with an empty value.
    const inputsDisabled = disabled ?? loading

    return (
        <Box>
            {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                    {error}
                </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('login.identifierFirstSubtitle')}
            </Typography>
            <TextField
                fullWidth
                type="email"
                label={t('auth.emailLabel')}
                autoComplete="username"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !inputsDisabled) {
                        e.preventDefault()
                        onSubmit()
                    }
                }}
                autoFocus
                disabled={inputsDisabled}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <EmailOutlined sx={{ color: iconColor }} />
                        </InputAdornment>
                    ),
                }}
                sx={fieldSx ?? { mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={onSubmit}
                disabled={inputsDisabled || !value.trim()}
                // Hide the end icon while busy (matches the dashboard's
                // `!formBusy && <ArrowForward/>`). Uses the broader `inputsDisabled`
                // so it tracks the surface's full busy state, not just the spinner.
                endIcon={!inputsDisabled ? endIcon : undefined}
                sx={buttonSx ?? { py: 1.5, borderRadius: '12px', fontWeight: 600 }}
            >
                {loading ? (
                    <CircularProgress size={24} sx={{ color: 'white' }} />
                ) : (
                    t('auth.continue')
                )}
            </Button>
        </Box>
    )
}
