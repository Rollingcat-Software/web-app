import { useId, type ReactNode } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material'
import { ArrowForward } from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { ANIMATION } from '../../constants'
import { stepItemVariants } from './stepMotion'

/**
 * Shared shell for the 10 auth method step screens.
 *
 * Hoists the structural + motion + a11y scaffolding that every
 * *Step component was repeating verbatim (~40-60 LOC each):
 *   - staggered framer-motion root
 *   - centered icon tile + title + subtitle header block
 *   - animated error alert with aria-live="polite"
 *   - optional primary + secondary action buttons
 *   - optional expandable help section
 *
 * Styling is preserved verbatim from the original per-step copies.
 * Copy (titles, subtitles, button labels, errors) stays in each step via
 * their existing `t()` calls — StepLayout never hard-codes user-visible
 * strings. role="main" + aria-labelledby are added for screen readers.
 *
 * Out of scope: progress indicator (owned by StepProgress + MultiStepAuthFlow),
 * step-specific in-body motion (stays in each step's body), flow routing.
 */

export interface StepLayoutAction {
    label: ReactNode
    onClick: () => void
    /** When true, the button is disabled. Loading implies disabled regardless. */
    disabled?: boolean
    /** When true, the label is replaced with a white CircularProgress spinner. */
    loading?: boolean
}

export interface StepLayoutProps {
    /** Main step heading (pass the resolved `t()` string — never a raw key). */
    title: ReactNode
    /** Optional secondary line under the title. */
    subtitle?: ReactNode
    /** Hex/gradient used as the icon tile background. Defaults to the indigo→violet brand gradient. */
    iconGradient?: string
    /** Matching shadow color for the icon tile. Auto-derived from gradient if omitted. */
    iconShadow?: string
    /** Icon element rendered inside the 56×56 tile (pass an MUI icon node). */
    icon?: ReactNode
    /** Error text shown in the top Alert banner. Empty string / null / undefined hides the banner. */
    error?: string | null
    /** Primary action button. When omitted the step body is expected to render its own actions. */
    primaryAction?: StepLayoutAction
    /** Optional secondary/outlined action rendered next to primaryAction. */
    secondaryAction?: StepLayoutAction
    /** Optional extra help/hint block rendered below the actions. */
    help?: ReactNode
    /** The step-specific body rendered between the header and the actions. */
    children?: ReactNode
}

const DEFAULT_ICON_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
const DEFAULT_ICON_SHADOW = '0 8px 32px rgba(99, 102, 241, 0.3)'
const PRIMARY_BUTTON_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
const PRIMARY_BUTTON_HOVER = 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
const PRIMARY_BUTTON_SHADOW = '0 10px 40px rgba(99, 102, 241, 0.4)'

const rootVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: ANIMATION.STAGGER_CHILDREN },
    },
}

export default function StepLayout({
    title,
    subtitle,
    iconGradient = DEFAULT_ICON_GRADIENT,
    iconShadow = DEFAULT_ICON_SHADOW,
    icon,
    error,
    primaryAction,
    secondaryAction,
    help,
    children,
}: StepLayoutProps) {
    const titleId = useId()
    const subtitleId = useId()

    const hasActions = Boolean(primaryAction || secondaryAction)

    return (
        <motion.div
            role="main"
            aria-labelledby={titleId}
            aria-describedby={subtitle ? subtitleId : undefined}
            initial="hidden"
            animate="visible"
            variants={rootVariants}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                {icon && (
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '14px',
                            background: iconGradient,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 2,
                            boxShadow: iconShadow,
                        }}
                    >
                        {icon}
                    </Box>
                )}
                <Typography id={titleId} variant="h6" fontWeight={600}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography
                        id={subtitleId}
                        variant="body2"
                        color="text.secondary"
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: ANIMATION.STEP_TRANSITION }}
                >
                    <Alert
                        severity="error"
                        role="alert"
                        aria-live="polite"
                        sx={{ mb: 2, borderRadius: '12px' }}
                    >
                        {error}
                    </Alert>
                </motion.div>
            )}

            {children}

            {hasActions && (
                <motion.div variants={stepItemVariants}>
                    {secondaryAction && primaryAction ? (
                        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                            <Button
                                variant="outlined"
                                size="large"
                                onClick={secondaryAction.onClick}
                                disabled={secondaryAction.disabled || secondaryAction.loading}
                                sx={{
                                    flex: 1,
                                    py: 1.5,
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                }}
                            >
                                {secondaryAction.label}
                            </Button>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={primaryAction.onClick}
                                disabled={primaryAction.disabled || primaryAction.loading}
                                endIcon={!primaryAction.loading && <ArrowForward />}
                                sx={{
                                    flex: 1,
                                    py: 1.5,
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    background: PRIMARY_BUTTON_GRADIENT,
                                    boxShadow: PRIMARY_BUTTON_SHADOW,
                                    '&:hover': {
                                        background: PRIMARY_BUTTON_HOVER,
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {primaryAction.loading ? (
                                    <CircularProgress size={24} sx={{ color: 'white' }} />
                                ) : (
                                    primaryAction.label
                                )}
                            </Button>
                        </Box>
                    ) : primaryAction ? (
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={primaryAction.onClick}
                            disabled={primaryAction.disabled || primaryAction.loading}
                            endIcon={!primaryAction.loading && <ArrowForward />}
                            sx={{
                                mt: 3,
                                py: 1.5,
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                background: PRIMARY_BUTTON_GRADIENT,
                                boxShadow: PRIMARY_BUTTON_SHADOW,
                                '&:hover': {
                                    background: PRIMARY_BUTTON_HOVER,
                                },
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {primaryAction.loading ? (
                                <CircularProgress size={24} sx={{ color: 'white' }} />
                            ) : (
                                primaryAction.label
                            )}
                        </Button>
                    ) : null}
                </motion.div>
            )}

            {help && (
                <motion.div variants={stepItemVariants}>
                    {help}
                </motion.div>
            )}
        </motion.div>
    )
}
