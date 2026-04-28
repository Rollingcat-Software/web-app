/**
 * BiometricPuzzleRunnerModal — mounts the selected puzzle inside a dialog.
 *
 * Visual polish (2026-04-28): gradient hero header with avatar, animated
 * success / error states (framer-motion spring), accent bar matching the
 * puzzle modality, refined progress messaging. The underlying detection
 * pipeline is unchanged — this is purely a wrapper UX upgrade.
 */
import { useCallback, useEffect, useState } from 'react'
import {
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import {
    CheckCircle,
    Close,
    ErrorOutline,
    Refresh,
} from '@mui/icons-material'
import { motion, type Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type {
    BiometricPuzzleEntry,
    BiometricPuzzleModality,
} from './biometricPuzzleRegistry'

type RunnerState = 'running' | 'success' | 'error'

const MODALITY_GRADIENT: Record<BiometricPuzzleModality, string> = {
    face: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    hand: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
}

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const feedbackVariants: Variants = {
    hidden: { opacity: 0, scale: 0.85, y: 12 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

const iconBadgeVariants: Variants = {
    hidden: { scale: 0, rotate: -90 },
    visible: {
        scale: 1,
        rotate: 0,
        transition: {
            type: 'spring',
            stiffness: 220,
            damping: 16,
            delay: 0.1,
        },
    },
}

export interface BiometricPuzzleRunnerModalProps {
    puzzle: BiometricPuzzleEntry | null
    open: boolean
    onClose: () => void
}

export default function BiometricPuzzleRunnerModal({
    puzzle,
    open,
    onClose,
}: BiometricPuzzleRunnerModalProps) {
    const { t } = useTranslation()
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

    const [state, setState] = useState<RunnerState>('running')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [runId, setRunId] = useState(0)

    useEffect(() => {
        if (open) {
            setState('running')
            setErrorMessage(null)
            setRunId((n) => n + 1)
        }
    }, [open, puzzle?.id])

    const handleSuccess = useCallback(() => {
        setState('success')
        setErrorMessage(null)
    }, [])

    const handleError = useCallback((msg: string) => {
        setState('error')
        setErrorMessage(msg)
    }, [])

    const handleRetry = useCallback(() => {
        setState('running')
        setErrorMessage(null)
        setRunId((n) => n + 1)
    }, [])

    if (!puzzle) return null

    const PuzzleComponent = puzzle.component
    const Icon = puzzle.icon
    const title = t(`${puzzle.i18nKey}.title`)
    const description = t(`${puzzle.i18nKey}.description`)
    const difficultyLabel = t(`biometricPuzzle.difficulty.${puzzle.difficulty}`)
    const gradient = MODALITY_GRADIENT[puzzle.modality]

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={fullScreen}
            maxWidth="sm"
            fullWidth
            aria-labelledby="biometric-puzzle-dialog-title"
            PaperProps={{
                sx: {
                    borderRadius: { xs: 0, sm: '20px' },
                    overflow: 'hidden',
                },
            }}
        >
            <DialogTitle
                id="biometric-puzzle-dialog-title"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2.5,
                    background:
                        'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.06) 100%)',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'relative',
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 3,
                        background: gradient,
                    },
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                    <Avatar
                        sx={{
                            width: 44,
                            height: 44,
                            background: gradient,
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ color: 'white' }} />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 700,
                                lineHeight: 1.2,
                                wordBreak: 'break-word',
                            }}
                        >
                            {title}
                        </Typography>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                        >
                            {difficultyLabel}
                        </Typography>
                    </Box>
                </Stack>
                <IconButton
                    onClick={onClose}
                    aria-label={t('biometricPuzzle.closeButton')}
                    size="small"
                >
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {state === 'running' && (
                    <Box key={runId}>
                        <Box sx={{ p: 3, pb: 0 }}>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ lineHeight: 1.6 }}
                            >
                                {description}
                            </Typography>
                        </Box>
                        <PuzzleComponent
                            onSuccess={handleSuccess}
                            onError={handleError}
                            onClose={onClose}
                        />
                    </Box>
                )}
                {state === 'success' && (
                    <motion.div
                        variants={feedbackVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <Stack
                            spacing={2}
                            alignItems="center"
                            sx={{ p: 5, textAlign: 'center' }}
                        >
                            <motion.div variants={iconBadgeVariants}>
                                <Box
                                    sx={{
                                        width: 88,
                                        height: 88,
                                        borderRadius: '50%',
                                        background:
                                            'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 12px 32px rgba(16, 185, 129, 0.35)',
                                    }}
                                >
                                    <CheckCircle sx={{ fontSize: 56, color: 'white' }} />
                                </Box>
                            </motion.div>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {t('biometricPuzzle.successHeadline')}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ maxWidth: 360, lineHeight: 1.5 }}
                            >
                                {t('biometricPuzzle.successMessage')}
                            </Typography>
                        </Stack>
                    </motion.div>
                )}
                {state === 'error' && (
                    <motion.div
                        variants={feedbackVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <Stack
                            spacing={2}
                            alignItems="center"
                            sx={{ p: 5, textAlign: 'center' }}
                        >
                            <motion.div variants={iconBadgeVariants}>
                                <Box
                                    sx={{
                                        width: 88,
                                        height: 88,
                                        borderRadius: '50%',
                                        background:
                                            'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 12px 32px rgba(239, 68, 68, 0.35)',
                                    }}
                                >
                                    <ErrorOutline sx={{ fontSize: 56, color: 'white' }} />
                                </Box>
                            </motion.div>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {t('biometricPuzzle.errorHeadline')}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ maxWidth: 360, lineHeight: 1.5 }}
                            >
                                {errorMessage || t('biometricPuzzle.errorMessage')}
                            </Typography>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ maxWidth: 360, fontStyle: 'italic' }}
                            >
                                {t('biometricPuzzle.errorHint')}
                            </Typography>
                        </Stack>
                    </motion.div>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                {state !== 'running' && (
                    <Button
                        onClick={handleRetry}
                        startIcon={<Refresh />}
                        variant="contained"
                        sx={{
                            textTransform: 'none',
                            borderRadius: '10px',
                            fontWeight: 600,
                            background: gradient,
                            boxShadow: 'none',
                            '&:hover': {
                                background: gradient,
                                filter: 'brightness(1.1)',
                            },
                        }}
                    >
                        {t('biometricPuzzle.tryAgainButton')}
                    </Button>
                )}
                <Button
                    onClick={onClose}
                    sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600 }}
                >
                    {t('biometricPuzzle.closeButton')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
