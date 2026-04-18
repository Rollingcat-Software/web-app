/**
 * HostedLoginApp — Top-level hosted OAuth 2.0 / OIDC sign-in surface
 *
 * Rendered at {@code verify.fivucsas.com/login}. Reads OAuth parameters from
 * the URL, shows tenant branding, runs the same {@link LoginMfaFlow} used by
 * the iframe widget, and on completion mints an authorization code by calling
 * {@code POST /oauth2/authorize/complete} — then redirects the browser to the
 * tenant's registered {@code redirect_uri} with {@code ?code=...&state=...}.
 *
 * This is the primary integration mode (hosted-first). The widget iframe is
 * kept for step-up MFA only.
 *
 * @see docs/plans/HOSTED_LOGIN_INTEGRATION.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    CssBaseline,
    Paper,
    Stack,
    ThemeProvider,
    Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { createAppTheme } from '../theme'
import { DependencyProvider } from '@app/providers/DependencyProvider'
import { createVerifyContainer } from './verifyContainer'
import LoginMfaFlow from './LoginMfaFlow'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { assertSafeRedirectScheme } from './sdk/FivucsasAuth'

// ─── URL Parameter Parsing ───────────────────────────────────────

interface HostedParams {
    clientId: string
    redirectUri: string
    scope: string
    state: string
    nonce: string
    codeChallenge: string
    codeChallengeMethod: string
    locale: 'en' | 'tr'
    theme: 'light' | 'dark'
    apiBaseUrl: string
}

/**
 * Resolve the UI locale for the hosted login page with the following priority:
 *   1. `ui_locales` (OIDC Core §3.1.2.1 — space-separated BCP47 tags; first match wins)
 *   2. `locale` (legacy SDK param kept for backward compat)
 *   3. `navigator.language` (browser preference)
 *   4. `'en'` (default)
 *
 * Only 'en' and 'tr' are currently supported — unknown tags fall through.
 */
function resolveLocale(params: URLSearchParams): 'en' | 'tr' {
    const SUPPORTED: ReadonlyArray<'en' | 'tr'> = ['en', 'tr']
    const match = (tag: string | null | undefined): 'en' | 'tr' | null => {
        if (!tag) return null
        // Take the primary subtag of the first preference (e.g. "tr-TR" -> "tr").
        const primary = tag.trim().split(/\s+/)[0]?.split('-')[0]?.toLowerCase()
        return (SUPPORTED as ReadonlyArray<string>).includes(primary ?? '')
            ? (primary as 'en' | 'tr')
            : null
    }
    return (
        match(params.get('ui_locales')) ||
        match(params.get('locale')) ||
        match(typeof navigator !== 'undefined' ? navigator.language : null) ||
        'en'
    )
}

function parseHostedParams(): HostedParams {
    const params = new URLSearchParams(window.location.search)
    return {
        clientId: params.get('client_id') ?? '',
        redirectUri: params.get('redirect_uri') ?? '',
        scope: params.get('scope') ?? 'openid profile email',
        state: params.get('state') ?? '',
        nonce: params.get('nonce') ?? '',
        codeChallenge: params.get('code_challenge') ?? '',
        codeChallengeMethod: params.get('code_challenge_method') ?? 'S256',
        locale: resolveLocale(params),
        theme: (params.get('theme') as 'light' | 'dark') || 'light',
        apiBaseUrl:
            params.get('api_base_url') ||
            import.meta.env.VITE_API_BASE_URL ||
            'https://api.fivucsas.com/api/v1',
    }
}

// ─── Types ───────────────────────────────────────────────────────

interface ClientPublicMeta {
    client_id: string
    client_name: string
    tenant_name?: string | null
}

interface AuthorizeCompleteResponse {
    code: string
    redirect_uri: string
    state?: string | null
}

// ─── Component ───────────────────────────────────────────────────

export default function HostedLoginApp() {
    // SECURITY (B9): Frame-bust defense-in-depth behind the `frame-ancestors 'none'`
    // CSP header. If a legacy browser honours CSP late (or ignores it), escaping the
    // frame early ensures the hosted OIDC sign-in page never renders inside a third
    // party's iframe (clickjacking / credential-theft defense). Evaluated once at
    // module load so the decision is stable across renders and hook ordering is
    // preserved (see rules-of-hooks).
    const isFramed =
        typeof window !== 'undefined' && window.top !== window.self

    const { t } = useTranslation()
    const [config] = useState(parseHostedParams)

    const theme = useMemo(() => createAppTheme(config.theme), [config.theme])
    const container = useMemo(() => createVerifyContainer(config.apiBaseUrl), [config.apiBaseUrl])

    const [clientMeta, setClientMeta] = useState<ClientPublicMeta | null>(null)
    const [paramError, setParamError] = useState<string | null>(null)
    const [metaLoading, setMetaLoading] = useState(true)
    const [metaLoadFailed, setMetaLoadFailed] = useState(false)
    const [metaReloadKey, setMetaReloadKey] = useState(0)
    const [redirecting, setRedirecting] = useState(false)
    const [finalError, setFinalError] = useState<string | null>(null)

    // Frame-bust redirect (B9): runs as an effect so hook order stays stable
    // regardless of whether the page happens to be framed. The early render
    // return below prevents any framed content from being shown.
    useEffect(() => {
        if (!isFramed) return
        try {
            // Prefer assigning to .location.href (works same-origin). For fully
            // cross-origin parents the browser blocks this — CSP frame-ancestors
            // 'none' is the authoritative guard; this is defense-in-depth.
            if (window.top && window.top.location) {
                window.top.location.href = window.location.href
            }
        } catch {
            // top is cross-origin and inaccessible — CSP will still deny framing.
        }
    }, [isFramed])

    // Set locale from URL (ui_locales, legacy locale, or browser fallback)
    // BEFORE any t()-driven render — we wait on metaLoading so the CircularProgress
    // label is already localized. The i18n bundle is tiny so the await is cheap.
    useEffect(() => {
        if (isFramed) return
        if (config.locale) {
            if (typeof document !== 'undefined') {
                document.documentElement.lang = config.locale
            }
            import('../i18n').then((mod) => {
                mod.default.changeLanguage(config.locale)
            })
        }
    }, [config.locale, isFramed])

    // Validate required params up front + fetch tenant-branding metadata.
    // The fetch is bounded by a 10s abort timeout so a stalled network does
    // not leave the user on an indefinite loading spinner. On timeout or any
    // network error (≠ invalid client) we surface a retry UI.
    useEffect(() => {
        // Skip meta fetch when framed — the frame-bust effect above will
        // navigate the top window, and nothing gets rendered anyway.
        if (isFramed) return

        if (!config.clientId || !config.redirectUri) {
            setParamError(t('hosted.missingParams'))
            setMetaLoading(false)
            return
        }

        // Dev-only hint: surface likely-malformed redirect_uri values (e.g. missing
        // scheme, stray whitespace, or a value the URL parser rejects). No
        // user-facing change — the authoritative scheme check runs in
        // `assertSafeRedirectScheme` during the complete handler.
        if (import.meta.env.DEV) {
            try {
                const parsed = new URL(config.redirectUri)
                if (!parsed.protocol || !/^(https?:|[a-z][a-z0-9+.-]*:)$/i.test(parsed.protocol)) {
                    console.warn(
                        '[HostedLoginApp] redirect_uri has unexpected protocol:',
                        config.redirectUri
                    )
                }
            } catch {
                console.warn(
                    '[HostedLoginApp] redirect_uri is not a valid URL:',
                    config.redirectUri
                )
            }
        }

        setMetaLoading(true)
        setMetaLoadFailed(false)

        const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 10000)
        let cancelled = false

        httpClient
            .get<ClientPublicMeta>(
                `/oauth2/clients/${encodeURIComponent(config.clientId)}/public`,
                {
                    timeout: 10000,
                    // signal isn't in RequestConfig, but axios passes through
                    // unknown keys unchanged. Cast narrowly to keep typecheck happy.
                    ...({ signal: controller.signal } as { signal: AbortSignal }),
                }
            )
            .then((res) => {
                if (cancelled) return
                setClientMeta(res.data)
                setMetaLoading(false)
            })
            .catch((err: unknown) => {
                if (cancelled) return
                const status = (err as { response?: { status?: number } })?.response?.status
                if (status === 404 || status === 400) {
                    setParamError(t('hosted.invalidClient'))
                } else {
                    setMetaLoadFailed(true)
                }
                setMetaLoading(false)
            })
            .finally(() => {
                window.clearTimeout(timeoutId)
            })

        return () => {
            cancelled = true
            window.clearTimeout(timeoutId)
            controller.abort()
        }
    }, [config.clientId, config.redirectUri, container, t, metaReloadKey, isFramed])

    // ─── Completion handler ─────────────────────────────────────

    const handleLoginComplete = useCallback(
        async (result: {
            accessToken: string
            refreshToken?: string
            userId: string
            email?: string
            completedMethods?: string[]
            mfaSessionToken?: string
            timestamp?: number
        }) => {
            if (!result.mfaSessionToken) {
                setFinalError(t('hosted.sessionLost'))
                return
            }

            setRedirecting(true)
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)

            try {
                const response = await httpClient.post<AuthorizeCompleteResponse>(
                    '/oauth2/authorize/complete',
                    {
                        mfaSessionToken: result.mfaSessionToken,
                        clientId: config.clientId,
                        redirectUri: config.redirectUri,
                        scope: config.scope,
                        state: config.state || null,
                        nonce: config.nonce || null,
                        codeChallenge: config.codeChallenge || null,
                        codeChallengeMethod: config.codeChallengeMethod || null,
                    }
                )

                const { code, redirect_uri: redirectUri } = response.data
                if (!code || !redirectUri) {
                    setRedirecting(false)
                    setFinalError(t('hosted.exchangeFailed'))
                    return
                }

                // Scheme allowlist (defense-in-depth). Backend already enforces
                // exact-match redirect_uri against the registered client, but a
                // compromised backend or registration bug must not become a
                // navigable XSS sink (`javascript:`, `data:`, …).
                try {
                    assertSafeRedirectScheme(redirectUri)
                } catch {
                    setRedirecting(false)
                    setFinalError(t('hosted.invalidRedirect'))
                    return
                }

                const target = new URL(redirectUri)
                target.searchParams.set('code', code)
                if (config.state) target.searchParams.set('state', config.state)
                window.location.replace(target.toString())
            } catch {
                setRedirecting(false)
                setFinalError(t('hosted.exchangeFailed'))
            }
        },
        [
            container,
            config.clientId,
            config.redirectUri,
            config.scope,
            config.state,
            config.nonce,
            config.codeChallenge,
            config.codeChallengeMethod,
            t,
        ]
    )

    const handleCancel = useCallback(() => {
        // Best-effort: return user to the origin of the redirect URI.
        if (config.redirectUri) {
            try {
                const origin = new URL(config.redirectUri).origin
                window.location.assign(origin)
                return
            } catch {
                // fall through
            }
        }
        window.history.length > 1 ? window.history.back() : window.close()
    }, [config.redirectUri])

    // ─── Render ─────────────────────────────────────────────────

    // If we're inside an iframe, render nothing while the frame-bust effect
    // (above) attempts to navigate the top window out of the frame. CSP
    // `frame-ancestors 'none'` is the authoritative guard.
    if (isFramed) {
        return null
    }

    if (metaLoading) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <HostedFrame>
                    <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
                        <CircularProgress />
                        <Typography variant="body2" color="text.secondary">
                            {t('hosted.loadingApp')}
                        </Typography>
                    </Stack>
                </HostedFrame>
            </ThemeProvider>
        )
    }

    if (paramError) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <HostedFrame>
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                            {t('widget.verificationError')}
                        </Typography>
                        <Typography variant="body2">{paramError}</Typography>
                    </Alert>
                </HostedFrame>
            </ThemeProvider>
        )
    }

    if (metaLoadFailed) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <HostedFrame>
                    <Stack spacing={2}>
                        <Alert severity="error" sx={{ borderRadius: 2 }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                                {t('hosted.loadError.title')}
                            </Typography>
                            <Typography variant="body2">
                                {t('hosted.loadError.body')}
                            </Typography>
                        </Alert>
                        <Button
                            variant="contained"
                            onClick={() => setMetaReloadKey((k) => k + 1)}
                        >
                            {t('hosted.loadError.retry')}
                        </Button>
                    </Stack>
                </HostedFrame>
            </ThemeProvider>
        )
    }

    const clientLabel =
        clientMeta?.tenant_name ?? clientMeta?.client_name ?? config.clientId

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <DependencyProvider container={container}>
                <HostedFrame>
                    <Stack spacing={3}>
                        <Box>
                            <Typography
                                variant="overline"
                                color="text.secondary"
                                sx={{ letterSpacing: 1 }}
                            >
                                {t('hosted.securedBy')}
                            </Typography>
                            <Typography variant="h5" fontWeight={600}>
                                {t('hosted.signingInTo', { tenant: clientLabel })}
                            </Typography>
                        </Box>

                        {redirecting ? (
                            <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
                                <CircularProgress />
                                <Typography variant="body2" color="text.secondary">
                                    {t('hosted.redirecting', { client: clientLabel })}
                                </Typography>
                            </Stack>
                        ) : finalError ? (
                            <Stack spacing={2}>
                                <Alert severity="error" sx={{ borderRadius: 2 }}>
                                    {finalError}
                                </Alert>
                                <Button variant="outlined" onClick={handleCancel}>
                                    {t('hosted.returnToApp')}
                                </Button>
                            </Stack>
                        ) : (
                            <LoginMfaFlow
                                clientId={config.clientId}
                                onComplete={handleLoginComplete}
                                onCancel={handleCancel}
                            />
                        )}
                    </Stack>
                </HostedFrame>
            </DependencyProvider>
        </ThemeProvider>
    )
}

// ─── Layout helper ───────────────────────────────────────────────

function HostedFrame({ children }: { children: React.ReactNode }) {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                pt: { xs: 3, sm: 6 },
                pb: { xs: 4, sm: 8 },
                px: { xs: 2, sm: 3 },
                bgcolor: 'background.default',
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 480,
                    p: { xs: 3, sm: 4 },
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                {children}
            </Paper>
        </Box>
    )
}
