/**
 * VerifyApp — Embeddable auth verification widget
 *
 * This is the root component for the standalone verify-app.
 * It wraps MultiStepAuthFlow with minimal providers (Theme, DI, i18n)
 * and communicates auth events to the parent via postMessage.
 *
 * No sidebar, no header, no admin dashboard — just the auth flow.
 *
 * @see docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { CssBaseline, ThemeProvider, Box, CircularProgress, Alert, Typography } from '@mui/material'
import { createAppTheme } from '../theme'
import { DependencyProvider } from '@app/providers/DependencyProvider'
import { createVerifyContainer } from './verifyContainer'
import MultiStepAuthFlow from '@features/auth/components/MultiStepAuthFlow'
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

interface VerifyParams {
    clientId: string
    sessionId: string
    flow: string
    theme: 'light' | 'dark'
    locale: 'en' | 'tr'
    userId: string
    apiBaseUrl: string
}

function parseUrlParams(): VerifyParams {
    const params = new URLSearchParams(window.location.search)
    return {
        clientId: params.get('client_id') || '',
        sessionId: params.get('session_id') || '',
        flow: params.get('flow') || '',
        theme: (params.get('theme') as 'light' | 'dark') || 'light',
        locale: (params.get('locale') as 'en' | 'tr') || 'en',
        userId: params.get('user_id') || '',
        apiBaseUrl:
            params.get('api_base_url') ||
            import.meta.env.VITE_API_BASE_URL ||
            'https://api.fivucsas.com/api/v1',
    }
}

// ─── VerifyApp Component ─────────────────────────────────────────

export default function VerifyApp() {
    const [config] = useState(() => parseUrlParams())
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(config.theme)
    const [session, setSession] = useState<AuthSessionResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

    // Fetch the auth session on mount
    useEffect(() => {
        if (!config.sessionId) {
            setError('Missing session_id parameter')
            setLoading(false)
            sendError('Missing session_id parameter', 'MISSING_SESSION_ID')
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
    }, [config.sessionId, container])

    // Track step changes via a MutationObserver on the step counter text
    // Instead, we use a ref-based approach via the MultiStepAuthFlow step data
    const handleStepChangeTracking = useCallback(
        (stepIndex: number, methodType: string, totalSteps: number) => {
            sendStepChange(stepIndex, methodType, totalSteps)
        },
        []
    )

    // Handle auth completion
    const handleComplete = useCallback(
        (result: { accessToken: string; userId: string }) => {
            sendComplete({
                accessToken: result.accessToken,
                userId: result.userId,
                sessionId: config.sessionId,
            })
        },
        [config.sessionId]
    )

    // Handle cancel
    const handleCancel = useCallback(() => {
        sendCancel(config.sessionId)
    }, [config.sessionId])

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
                            Verification Error
                        </Typography>
                        <Typography variant="body2">{error}</Typography>
                    </Alert>
                </Box>
            </ThemeProvider>
        )
    }

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

    // Track step changes by watching the steps array
    // We pass this data upstream via the postMessage bridge
    const currentPendingIdx = flowSteps.findIndex(
        (s) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED' && s.status !== 'FAILED'
    )
    if (currentPendingIdx >= 0) {
        // Fire step-change on render (debounced by the parent)
        handleStepChangeTracking(
            currentPendingIdx,
            flowSteps[currentPendingIdx].methodType,
            flowSteps.length
        )
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <DependencyProvider container={container}>
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: { xs: 1, sm: 2 },
                        background: 'transparent',
                    }}
                >
                    <MultiStepAuthFlow
                        sessionId={config.sessionId}
                        steps={flowSteps}
                        onComplete={handleComplete}
                        onCancel={handleCancel}
                    />
                </Box>
            </DependencyProvider>
        </ThemeProvider>
    )
}
