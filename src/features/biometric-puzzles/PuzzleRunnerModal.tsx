/**
 * PuzzleRunnerModal
 *
 * Dialog container that mounts the selected puzzle's component under a
 * `PuzzleModeProvider` in `stub` mode. Tracks three UI states:
 *
 *   - `running` — puzzle mounted, awaiting user interaction
 *   - `success` — the stubbed backend accepted the challenge
 *   - `error`   — rare in stub mode; surfaced with a retry button
 *
 * The dialog is intentionally mobile-friendly (`fullScreen` on xs).
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
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { CheckCircle, Close, Replay } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { PuzzleModeProvider } from './PuzzleMode'
import PuzzleTaskbar from './PuzzleTaskbar'
import type { Puzzle } from './puzzleRegistry'

type RunnerState = 'running' | 'success' | 'error'

export interface PuzzleRunnerModalProps {
    puzzle: Puzzle | null
    open: boolean
    onClose: () => void
}

export default function PuzzleRunnerModal({
    puzzle,
    open,
    onClose,
}: PuzzleRunnerModalProps) {
    const { t } = useTranslation()
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

    const [state, setState] = useState<RunnerState>('running')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    // Remount the puzzle tree on retry so internal state (camera, timers, …) resets.
    const [runId, setRunId] = useState(0)

    // Reset when the dialog opens or the puzzle changes.
    useEffect(() => {
        if (open) {
            setState('running')
            setErrorMessage(null)
            setRunId((n) => n + 1)
        }
    }, [open, puzzle?.id])

    const handleSuccess = useCallback(() => {
        setState('success')
    }, [])

    const handleError = useCallback((message: string) => {
        setErrorMessage(message)
        setState('error')
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
            fullWidth
            maxWidth="sm"
            aria-labelledby="puzzle-runner-title"
        >
            <DialogTitle
                id="puzzle-runner-title"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    pr: 1,
                }}
            >
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>
                            {title}
                        </Box>
                        <Box
                            component="span"
                            sx={{
                                ml: 'auto',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'primary.main',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                            }}
                        >
                            {t('biometricPuzzle.previewLabel')}
                        </Box>
                    </Box>
                    <PuzzleTaskbar platforms={puzzle.platforms} variant="compact" />
                </Box>
                <IconButton
                    aria-label={t('biometricPuzzle.closeButton')}
                    onClick={onClose}
                    size="small"
                >
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
                {state === 'success' ? (
                    <Alert
                        icon={<CheckCircle fontSize="inherit" />}
                        severity="success"
                        sx={{ borderRadius: '12px' }}
                    >
                        {t('biometricPuzzle.successMessage')}
                    </Alert>
                ) : state === 'error' ? (
                    <Alert severity="error" sx={{ borderRadius: '12px' }}>
                        {errorMessage ?? t('biometricPuzzle.errorMessage')}
                    </Alert>
                ) : (
                    <PuzzleModeProvider mode="stub">
                        {/* runId key forces a fresh mount on retry */}
                        <Box key={runId}>
                            <PuzzleComponent
                                onSuccess={handleSuccess}
                                onError={handleError}
                                onClose={onClose}
                            />
                        </Box>
                    </PuzzleModeProvider>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                {state === 'running' ? (
                    <Button onClick={onClose} color="inherit">
                        {t('biometricPuzzle.closeButton')}
                    </Button>
                ) : (
                    <>
                        <Button onClick={onClose} color="inherit">
                            {t('biometricPuzzle.closeButton')}
                        </Button>
                        <Button
                            onClick={handleRetry}
                            variant="contained"
                            startIcon={<Replay />}
                        >
                            {t('biometricPuzzle.tryAgainButton')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}
