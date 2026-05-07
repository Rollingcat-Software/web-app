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
    alpha,
    Alert,
    Box,
    Button,
    CircularProgress,
    CssBaseline,
    Link,
    Paper,
    Stack,
    ThemeProvider,
    Typography,
} from '@mui/material'
import { ArrowForwardOutlined, MenuBookOutlined, VerifiedUserOutlined } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { createAppTheme } from '../theme'
import { DependencyProvider } from '@app/providers'
import { createVerifyContainer } from './verifyContainer'
import LoginMfaFlow from './LoginMfaFlow'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { assertSafeRedirectScheme } from './sdk/FivucsasAuth'
import { config as envConfig } from '@config/env'

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
        apiBaseUrl: params.get('api_base_url') || envConfig.apiBaseUrl,
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
    // Distinguish "no params at all" (developer hits the bare URL) from "wrong params"
    // (active integration handed us a bad client_id). The first deserves an
    // explainer/integrator-landing card; the second is a user-facing error.
    const [paramsMissing, setParamsMissing] = useState(false)
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
            // Cold-load (developer typed the bare URL) — render the Integrator
            // Landing card rather than a red "Missing parameters" error. Genuine
            // half-broken redirects (one param present, the other missing) still
            // fall through to the landing rather than the error path so the
            // operator sees the same friendly explainer; the OAuth error itself
            // is then surfaced upstream by the tenant's integration code.
            setParamsMissing(true)
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
            setRedirecting(true)
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)

            // Two completion paths:
            //  (a) Multi-step flow → LoginMfaFlow returned an `mfaSessionToken`.
            //      Mint the code via `/oauth2/authorize/complete` which spends
            //      the session.
            //  (b) Single-step flow (e.g. Marmara Simple Login — PASSWORD only)
            //      → no mfaSessionToken exists; the user already holds a valid
            //      access token. Mint the code by re-hitting `GET /oauth2/authorize`
            //      with the Bearer token; the backend mints a code for the
            //      authenticated principal (see OAuth2Controller.authorize
            //      `authentication.isAuthenticated()` branch).
            try {
                let code: string | undefined
                let redirectUri: string | undefined

                if (result.mfaSessionToken) {
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
                    code = response.data.code
                    redirectUri = response.data.redirect_uri
                } else if (result.accessToken) {
                    // Single-factor flow: the user authenticated without an MFA
                    // session being minted. Call the authorize endpoint with the
                    // Bearer token and let the server mint the code.
                    const params = new URLSearchParams({
                        client_id: config.clientId,
                        redirect_uri: config.redirectUri,
                        response_type: 'code',
                        scope: config.scope || 'openid profile email',
                    })
                    if (config.state) params.set('state', config.state)
                    if (config.nonce) params.set('nonce', config.nonce)
                    if (config.codeChallenge) params.set('code_challenge', config.codeChallenge)
                    if (config.codeChallengeMethod) {
                        params.set('code_challenge_method', config.codeChallengeMethod)
                    }
                    const response = await httpClient.get<AuthorizeCompleteResponse>(
                        `/oauth2/authorize?${params.toString()}`,
                        {
                            headers: { Authorization: `Bearer ${result.accessToken}` },
                        }
                    )
                    code = response.data.code
                    redirectUri = response.data.redirect_uri
                } else {
                    setRedirecting(false)
                    setFinalError(t('hosted.sessionLost'))
                    return
                }

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
            } catch (err) {
                setRedirecting(false)
                // Surface a specific message when the backend rejects the
                // exchange because the authenticated user belongs to a
                // different tenant than the OAuth client. The generic
                // "try again from the original site" copy is misleading
                // here — the user should switch accounts, not retry.
                const response = (err as {
                    response?: { status?: number; data?: { error?: string; error_description?: string } }
                })?.response
                const code = response?.data?.error
                const detail = response?.data?.error_description ?? ''
                if (
                    response?.status === 400 &&
                    code === 'invalid_request' &&
                    /tenant/i.test(detail)
                ) {
                    const tenantLabel =
                        clientMeta?.tenant_name ??
                        clientMeta?.client_name ??
                        config.clientId
                    setFinalError(t('hosted.tenantMismatch', { tenant: tenantLabel }))
                } else {
                    setFinalError(t('hosted.exchangeFailed'))
                }
            }
        },
        [
            container,
            clientMeta,
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
                    <Stack alignItems="center" spacing={2.5} sx={{ py: 6 }}>
                        <CircularProgress size={32} thickness={4} />
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>
                            {t('hosted.loadingApp')}
                        </Typography>
                    </Stack>
                </HostedFrame>
            </ThemeProvider>
        )
    }

    if (paramsMissing) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <HostedFrame>
                    <IntegratorLanding />
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
                        <Typography variant="subtitle2" fontWeight={700}>
                            {t('widget.verificationError')}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>{paramError}</Typography>
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
                    <Stack spacing={2.5}>
                        <Alert severity="error" sx={{ borderRadius: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                                {t('hosted.loadError.title')}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                    px: 1.25,
                                    py: 0.5,
                                    mb: 1.25,
                                    borderRadius: 999,
                                    border: (th) => `1px solid ${alpha(th.palette.primary.main, 0.25)}`,
                                    backgroundColor: (th) => alpha(th.palette.primary.main, 0.08),
                                    color: 'primary.main',
                                }}
                            >
                                <VerifiedUserOutlined sx={{ fontSize: 14 }} />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 700,
                                        letterSpacing: '0.08em',
                                        textTransform: 'uppercase',
                                        fontSize: '0.68rem',
                                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                                    }}
                                >
                                    {t('hosted.securedBy')}
                                </Typography>
                            </Box>
                            <Typography
                                variant="h5"
                                sx={{
                                    fontFamily: '"Poppins", "Inter", sans-serif',
                                    fontWeight: 700,
                                    letterSpacing: '-0.018em',
                                    lineHeight: 1.25,
                                }}
                            >
                                {t('hosted.signingInTo', { tenant: clientLabel })}
                            </Typography>
                        </Box>

                        {redirecting ? (
                            <Stack alignItems="center" spacing={2.5} sx={{ py: 5 }}>
                                <CircularProgress size={32} thickness={4} />
                                <Typography variant="body2" color="text.secondary" fontWeight={500}>
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
                pt: { xs: 3, sm: 7 },
                pb: { xs: 4, sm: 9 },
                px: { xs: 2, sm: 3 },
                position: 'relative',
                overflow: 'hidden',
                // Ambient gradient canvas; works in both light and dark themes.
                background: (th) => th.palette.mode === 'dark'
                    ? 'radial-gradient(900px 450px at 50% -10%, rgba(99,102,241,0.14), transparent 60%), radial-gradient(700px 350px at 80% 90%, rgba(139,92,246,0.10), transparent 60%), #0f1220'
                    : 'radial-gradient(900px 450px at 50% -10%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 350px at 80% 90%, rgba(139,92,246,0.07), transparent 60%), #f8fafc',
            }}
        >
            {/* Brand mark — purely decorative, sits above the card. Mirrors the
                FIVUCSAS gradient shield used in the main dashboard shell so
                hosted login carries the same visual identity. */}
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    mb: 2.5,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 10px 28px -10px rgba(99,102,241,0.55)',
                    color: '#ffffff',
                }}
                aria-hidden
            >
                <VerifiedUserOutlined sx={{ fontSize: 24 }} />
            </Box>

            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 480,
                    p: { xs: 3, sm: 4 },
                    borderRadius: 3,
                    border: (th) => `1px solid ${th.palette.divider}`,
                    backgroundImage: 'none',
                    boxShadow: (th) => th.palette.mode === 'dark'
                        ? '0 24px 48px -12px rgba(0,0,0,0.6)'
                        : '0 24px 48px -12px rgba(15,23,42,0.14), 0 8px 16px -6px rgba(15,23,42,0.08)',
                }}
            >
                {children}
            </Paper>

            {/* Microcopy footer. Conveys that the origin is fivucsas.com without
                being intrusive. Static text, not user-configurable. */}
            <Typography
                variant="caption"
                sx={{
                    mt: 2.5,
                    color: 'text.disabled',
                    fontSize: '0.72rem',
                    letterSpacing: '0.02em',
                }}
            >
                verify.fivucsas.com
            </Typography>
        </Box>
    )
}

// ─── IntegratorLanding ───────────────────────────────────────────
//
// Rendered when a developer hits `verify.fivucsas.com` with no OAuth params.
// Reuses the HostedFrame card so the surface still reads as the same product
// (brand mark, pill chip, ambient gradient). Avoids the red "Missing
// parameters" alert which made the URL feel broken to anyone evaluating the
// SDK. P1-1 of SENIOR_UIUX_REVIEW_2026-05-04.

function IntegratorLanding() {
    const { t } = useTranslation()
    // App origin for "Open Developer Portal" / "View documentation" CTAs. We
    // can't link to a path on this same host (verify is a different bundle)
    // so the absolute origin keeps the destinations stable across envs.
    const appOrigin = 'https://app.fivucsas.com'
    const docsHref = `${appOrigin}/developer-portal`
    const portalHref = `${appOrigin}/developer-portal`

    return (
        <Stack spacing={3}>
            <Box>
                <Box
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.25,
                        py: 0.5,
                        mb: 1.25,
                        borderRadius: 999,
                        border: (th) => `1px solid ${alpha(th.palette.primary.main, 0.25)}`,
                        backgroundColor: (th) => alpha(th.palette.primary.main, 0.08),
                        color: 'primary.main',
                    }}
                >
                    <VerifiedUserOutlined sx={{ fontSize: 14 }} />
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            fontSize: '0.68rem',
                            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        }}
                    >
                        {t('hosted.integratorLanding.eyebrow')}
                    </Typography>
                </Box>
                <Typography
                    variant="h5"
                    sx={{
                        fontFamily: '"Poppins", "Inter", sans-serif',
                        fontWeight: 700,
                        letterSpacing: '-0.018em',
                        lineHeight: 1.25,
                        mb: 1,
                    }}
                >
                    {t('hosted.integratorLanding.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('hosted.integratorLanding.lead')}
                </Typography>
            </Box>

            <Stack spacing={2}>
                <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                        {t('hosted.integratorLanding.section1Title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('hosted.integratorLanding.section1Body')}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                        {t('hosted.integratorLanding.section2Title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('hosted.integratorLanding.section2Body')}
                    </Typography>
                    <Box
                        component="pre"
                        sx={{
                            m: 0,
                            p: 1.5,
                            borderRadius: 2,
                            backgroundColor: (th) => alpha(th.palette.primary.main, 0.06),
                            border: (th) => `1px solid ${alpha(th.palette.primary.main, 0.18)}`,
                            color: 'text.primary',
                            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                            fontSize: '0.78rem',
                            overflowX: 'auto',
                            lineHeight: 1.55,
                        }}
                    >{`import { FivucsasAuth } from '@fivucsas/auth-js'

FivucsasAuth.init({ clientId: 'YOUR_CLIENT_ID' })
FivucsasAuth.loginRedirect({
    redirectUri: 'https://your-app.com/callback',
    scope: 'openid profile email',
})`}</Box>
                </Box>

                <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                        {t('hosted.integratorLanding.section3Title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('hosted.integratorLanding.section3Body')}
                    </Typography>
                </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button
                    variant="contained"
                    component={Link}
                    href={portalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<ArrowForwardOutlined />}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                    {t('hosted.integratorLanding.section2Cta')}
                </Button>
                <Button
                    variant="outlined"
                    component={Link}
                    href={docsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<MenuBookOutlined />}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                    {t('hosted.integratorLanding.section3Cta')}
                </Button>
            </Stack>
        </Stack>
    )
}
