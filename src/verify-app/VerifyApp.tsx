/**
 * VerifyApp — Embeddable auth verification widget
 *
 * This is the root component for the standalone verify-app.
 * It supports TWO modes:
 *
 * **Session mode** (session_id present): Wraps MultiStepAuthFlow with a
 * pre-created auth session on the backend.
 *
 * **Login mode** (client_id present, no session_id): Shows a login form
 * followed by N-step MFA flow using the new /auth/login + /auth/mfa/step
 * endpoints.
 *
 * Communicates auth events to the parent via postMessage.
 *
 * @see docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { CssBaseline, ThemeProvider, Box, CircularProgress, Alert, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { createAppTheme } from '../theme'
import { DependencyProvider } from '@app/providers/DependencyProvider'
import { createVerifyContainer } from './verifyContainer'
import MultiStepAuthFlow from '@features/auth/components/MultiStepAuthFlow'
import LoginMfaFlow from './LoginMfaFlow'
import { AuthSessionRepository, type AuthSessionResponse } from '@core/repositories/AuthSessionRepository'
import { TYPES } from '@core/di/types'
import {
    sendReady,
    sendStepChange,
    sendComplete,
    sendCancel,
    sendError,
    onParentMessage,
    setParentOrigin,
} from './postMessageBridge'
import { useResizeObserver } from './useResizeObserver'

// ─── URL Parameter Parsing ───────────────────────────────────────

type WidgetMode = 'session' | 'login'

interface VerifyParams {
    clientId: string
    sessionId: string
    flow: string
    theme: 'light' | 'dark'
    locale: 'en' | 'tr'
    userId: string
    apiBaseUrl: string
    mode: WidgetMode
}

function parseUrlParams(): VerifyParams {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id') || ''
    const clientId = params.get('client_id') || ''
    const explicitMode = params.get('mode') as WidgetMode | null

    // Auto-detect mode: session_id present => session mode, otherwise login mode
    let mode: WidgetMode
    if (explicitMode === 'login' || explicitMode === 'session') {
        mode = explicitMode
    } else {
        mode = sessionId ? 'session' : 'login'
    }

    return {
        clientId,
        sessionId,
        flow: params.get('flow') || '',
        theme: (params.get('theme') as 'light' | 'dark') || 'light',
        locale: (params.get('locale') as 'en' | 'tr') || 'en',
        userId: params.get('user_id') || '',
        apiBaseUrl:
            params.get('api_base_url') ||
            import.meta.env.VITE_API_BASE_URL ||
            'https://api.fivucsas.com/api/v1',
        mode,
    }
}

// ─── VerifyApp Component ─────────────────────────────────────────

export default function VerifyApp() {
    const [config] = useState(() => parseUrlParams())
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(config.theme)
    const [session, setSession] = useState<AuthSessionResponse | null>(null)
    const [loading, setLoading] = useState(config.mode === 'session')
    const [error, setError] = useState<string | null>(null)
    const { t } = useTranslation()

    // Create the minimal DI container
    const container = useMemo(
        () => createVerifyContainer(config.apiBaseUrl),
        [config.apiBaseUrl]
    )

    // Build the MUI theme
    const theme = useMemo(() => createAppTheme(themeMode), [themeMode])

    // Listen for parent config messages (theme/locale overrides)
    useEffect(() => {
        return onParentMessage((msg) => {
            if (msg.type === 'fivucsas:config') {
                if (msg.payload.allowedOrigin) {
                    setParentOrigin(msg.payload.allowedOrigin)
                }
                if (msg.payload.theme) setThemeMode(msg.payload.theme)
                if (msg.payload.locale) {
                    // i18n language change if needed
                    import('../i18n').then((mod) => {
                        mod.default.changeLanguage(msg.payload.locale!)
                    })
                }
            }
        })
    }, [])

    // Set i18n locale from URL params on mount
    useEffect(() => {
        if (config.locale) {
            import('../i18n').then((mod) => {
                mod.default.changeLanguage(config.locale)
            })
        }
    }, [config.locale])

    // Observe body resize for iframe auto-sizing
    useResizeObserver()

    // Fetch the auth session on mount (session mode only)
    useEffect(() => {
        if (config.mode !== 'session') {
            // Login mode — validate that client_id is present
            if (!config.clientId) {
                setError(t('widget.missingParams'))
                sendError(t('widget.missingParams'), 'MISSING_PARAMS')
            } else {
                sendReady()
            }
            return
        }

        if (!config.sessionId) {
            setError(t('widget.missingParams'))
            setLoading(false)
            sendError(t('widget.missingParams'), 'MISSING_SESSION_ID')
            return
        }

        const repo = container.get<AuthSessionRepository>(TYPES.AuthSessionRepository)
        repo.getSession(config.sessionId)
            .then((sessionData) => {
                setSession(sessionData)
                setLoading(false)
                sendReady()
            })
            .catch((err) => {
                const message = err instanceof Error ? err.message : 'Failed to load session'
                setError(message)
                setLoading(false)
                sendError(message, 'SESSION_LOAD_FAILED')
            })
    }, [config.sessionId, config.mode, config.clientId, container, t])

    // Forward step changes from MultiStepAuthFlow / LoginMfaFlow to the postMessage bridge
    const handleStepChangeTracking = useCallback(
        (stepIndex: number, methodType: string, totalSteps: number) => {
            sendStepChange(stepIndex, methodType, totalSteps)
        },
        []
    )

    // Handle auth completion (session mode)
    const handleSessionComplete = useCallback(
        (result: { accessToken: string; userId: string }) => {
            sendComplete({
                accessToken: result.accessToken,
                userId: result.userId,
                sessionId: config.sessionId,
            })
        },
        [config.sessionId]
    )

    // Handle auth completion (login mode)
    const handleLoginComplete = useCallback(
        (result: { accessToken: string; refreshToken?: string; userId: string; email?: string; completedMethods?: string[]; mfaSessionToken?: string; timestamp?: number }) => {
            sendComplete({
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                userId: result.userId,
                email: result.email,
                completedMethods: result.completedMethods,
                timestamp: result.timestamp,
            })
        },
        []
    )

    // Handle cancel
    const handleCancel = useCallback(() => {
        sendCancel(config.sessionId || config.clientId)
    }, [config.sessionId, config.clientId])

    // ─── Render ──────────────────────────────────────────────────

    if (loading) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '200px',
                    }}
                >
                    <CircularProgress />
                </Box>
            </ThemeProvider>
        )
    }

    if (error) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{ p: 3, maxWidth: 520, mx: 'auto' }}>
                    <Alert severity="error" sx={{ borderRadius: '12px' }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                            {t('widget.verificationError')}
                        </Typography>
                        <Typography variant="body2">{error}</Typography>
                    </Alert>
                </Box>
            </ThemeProvider>
        )
    }

    // ─── Login Mode ─────────────────────────────────────────────
    if (config.mode === 'login') {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <DependencyProvider container={container}>
                    <Box
                        sx={{
                            minHeight: '100vh',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            justifyContent: 'flex-start',
                            pt: { xs: 2, sm: 4 },
                            pb: { xs: 3, sm: 5 },
                            px: { xs: 1.5, sm: 2 },
                            background: 'transparent',
                        }}
                    >
                        <LoginMfaFlow
                            clientId={config.clientId}
                            onComplete={handleLoginComplete}
                            onCancel={handleCancel}
                            onStepChange={handleStepChangeTracking}
                        />
                    </Box>
                </DependencyProvider>
            </ThemeProvider>
        )
    }

    // ─── Session Mode ───────────────────────────────────────────

    if (!session) {
        return null
    }

    // Map session steps to the format expected by MultiStepAuthFlow
    const flowSteps = session.steps.map((s) => ({
        stepOrder: s.stepOrder,
        methodType: s.authMethodType,
        status: s.status,
        isRequired: s.isRequired,
    }))

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <DependencyProvider container={container}>
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        pt: { xs: 2, sm: 4 },
                        pb: { xs: 3, sm: 5 },
                        px: { xs: 1.5, sm: 2 },
                        background: 'transparent',
                    }}
                >
                    <MultiStepAuthFlow
                        sessionId={config.sessionId}
                        steps={flowSteps}
                        onComplete={handleSessionComplete}
                        onCancel={handleCancel}
                        onStepChange={handleStepChangeTracking}
                    />
                </Box>
            </DependencyProvider>
        </ThemeProvider>
    )
}
