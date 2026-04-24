/**
 * AuthMethodRunnerModal
 *
 * Dialog container that mounts the selected auth method's component under an
 * `AuthMethodModeProvider` in `stub` mode. Tracks three UI states:
 *
 *   - `running` — preview mounted, awaiting user interaction
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
import { AuthMethodModeProvider } from './AuthMethodMode'
import AuthMethodTaskbar from './AuthMethodTaskbar'
import type { AuthMethodEntry } from './authMethodRegistry'

type RunnerState = 'running' | 'success' | 'error'

export interface AuthMethodRunnerModalProps {
    method: AuthMethodEntry | null
    open: boolean
    onClose: () => void
}

export default function AuthMethodRunnerModal({
    method,
    open,
    onClose,
}: AuthMethodRunnerModalProps) {
    const { t } = useTranslation()
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

    const [state, setState] = useState<RunnerState>('running')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    // Remount the preview tree on retry so internal state (camera, timers, …)
    // resets cleanly.
    const [runId, setRunId] = useState(0)

    // Reset when the dialog opens or the method changes.
    useEffect(() => {
        if (open) {
            setState('running')
            setErrorMessage(null)
            setRunId((n) => n + 1)
        }
    }, [open, method?.id])

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

    if (!method) return null

    const MethodComponent = method.component
    const title = t(`${method.i18nKey}.title`)

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={fullScreen}
            fullWidth
            maxWidth="sm"
            aria-labelledby="auth-method-runner-title"
        >
            <DialogTitle
                id="auth-method-runner-title"
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
                            {t('authMethodsTesting.previewLabel')}
                        </Box>
                    </Box>
                    <AuthMethodTaskbar platforms={method.platforms} variant="compact" />
                </Box>
                <IconButton
                    aria-label={t('authMethodsTesting.closeButton')}
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
                        {t('authMethodsTesting.successMessage')}
                    </Alert>
                ) : state === 'error' ? (
                    <Alert severity="error" sx={{ borderRadius: '12px' }}>
                        {errorMessage ?? t('authMethodsTesting.errorMessage')}
                    </Alert>
                ) : (
                    <AuthMethodModeProvider mode="stub">
                        {/* runId key forces a fresh mount on retry */}
                        <Box key={runId}>
                            <MethodComponent
                                onSuccess={handleSuccess}
                                onError={handleError}
                                onClose={onClose}
                            />
                        </Box>
                    </AuthMethodModeProvider>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                {state === 'running' ? (
                    <Button onClick={onClose} color="inherit">
                        {t('authMethodsTesting.closeButton')}
                    </Button>
                ) : (
                    <>
                        <Button onClick={onClose} color="inherit">
                            {t('authMethodsTesting.closeButton')}
                        </Button>
                        <Button
                            onClick={handleRetry}
                            variant="contained"
                            startIcon={<Replay />}
                        >
                            {t('authMethodsTesting.tryAgainButton')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}
