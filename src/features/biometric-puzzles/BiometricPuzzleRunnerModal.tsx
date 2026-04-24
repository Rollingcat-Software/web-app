/**
 * BiometricPuzzleRunnerModal — mounts the selected puzzle inside a dialog.
 *
 * Structurally identical to `AuthMethodRunnerModal` but bound to
 * `BiometricPuzzleEntry`. Kept separate so the biometric puzzles page
 * can evolve (add SVG overlay for shape-trace challenges, etc.) without
 * touching the auth-methods surface.
 */
import { useCallback, useEffect, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Close } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { BiometricPuzzleEntry } from './biometricPuzzleRegistry'

type RunnerState = 'running' | 'success' | 'error'

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
    const title = t(`${puzzle.i18nKey}.title`)

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={fullScreen}
            maxWidth="sm"
            fullWidth
            aria-labelledby="biometric-puzzle-dialog-title"
        >
            <DialogTitle
                id="biometric-puzzle-dialog-title"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {title}
                </Typography>
                <IconButton
                    onClick={onClose}
                    aria-label={t('biometricPuzzle.closeButton')}
                    size="small"
                >
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
                {state === 'running' && (
                    <Box key={runId}>
                        <PuzzleComponent
                            onSuccess={handleSuccess}
                            onError={handleError}
                            onClose={onClose}
                        />
                    </Box>
                )}
                {state === 'success' && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {t('biometricPuzzle.successMessage')}
                        </Alert>
                    </Box>
                )}
                {state === 'error' && (
                    <Box sx={{ p: 3 }}>
                        <Alert severity="error">
                            {errorMessage || t('biometricPuzzle.errorMessage')}
                        </Alert>
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                {state !== 'running' && (
                    <Button onClick={handleRetry}>
                        {t('biometricPuzzle.tryAgainButton')}
                    </Button>
                )}
                <Button onClick={onClose}>{t('biometricPuzzle.closeButton')}</Button>
            </DialogActions>
        </Dialog>
    )
}
