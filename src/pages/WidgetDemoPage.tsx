import { useRef, useState, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Grid,
    Paper,
    Tab,
    Tabs,
    Typography,
} from '@mui/material'
import {
    AccountTree,
    Code,
    ContentCopy,
    Face,
    Fingerprint,
    HourglassEmpty,
    CheckCircle,
    ErrorOutline,
    Inventory2,
    Key,
    Layers,
    Nfc,
    Password,
    PlayArrow,
    QrCode2,
    RecordVoiceOver,
    Security,
    Sms,
    Stop,
    Timer,
    VerifiedUser,
    Verified,
    Web,
} from '@mui/icons-material'
import { FivucsasAuth } from '@/verify-app/sdk/FivucsasAuth'
import type { VerifyResult } from '@/verify-app/sdk/FivucsasAuth'
import { useAuth } from '@features/auth/hooks/useAuth'

// ─── Status ─────────────────────────────────────────────────────────

type DemoStatus = 'idle' | 'verifying' | 'complete' | 'error' | 'cancelled'

function StatusIndicator({ status }: { status: DemoStatus }) {
    const config: Record<DemoStatus, { label: string; color: string; icon: React.ReactNode }> = {
        idle: {
            label: 'Idle',
            color: 'text.secondary',
            icon: <HourglassEmpty sx={{ fontSize: 16 }} />,
        },
        verifying: {
            label: 'Verifying...',
            color: 'info.main',
            icon: <Timer sx={{ fontSize: 16 }} />,
        },
        complete: {
            label: 'Complete',
            color: 'success.main',
            icon: <CheckCircle sx={{ fontSize: 16 }} />,
        },
        error: {
            label: 'Error',
            color: 'error.main',
            icon: <ErrorOutline sx={{ fontSize: 16 }} />,
        },
        cancelled: {
            label: 'Cancelled',
            color: 'warning.main',
            icon: <ErrorOutline sx={{ fontSize: 16 }} />,
        },
    }

    const { label, color, icon } = config[status]

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Status:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color }}>
                {icon}
                <Typography variant="caption" fontWeight={600} color="inherit">
                    {label}
                </Typography>
            </Box>
        </Box>
    )
}

// ─── Code Examples ──────────────────────────────────────────────────

const SCRIPT_TAG_EXAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FIVUCSAS Auth Demo</title>
</head>
<body>
  <h1>My App</h1>

  <!-- 1. Include the SDK (9.5KB gzipped, zero dependencies) -->
  <script src="https://cdn.fivucsas.com/auth.min.js">${'<'}/script>

  <!-- 2. Add the Web Component -->
  <fivucsas-verify
    client-id="your-client-id"
    flow="login"
    locale="en"
    base-url="https://verify.fivucsas.com"
    api-base-url="https://auth.rollingcatsoftware.com/api/v1"
  ></fivucsas-verify>

  <!-- 3. Listen for events -->
  <script>
    const el = document.querySelector('fivucsas-verify');

    el.addEventListener('fivucsas-complete', (e) => {
      console.log('Verified!', e.detail);
      // e.detail = { success, sessionId, completedMethods, authCode }
    });

    el.addEventListener('fivucsas-error', (e) => {
      console.error('Error:', e.detail.message);
    });

    el.addEventListener('fivucsas-cancel', () => {
      console.log('User cancelled');
    });

    el.addEventListener('fivucsas-step-change', (e) => {
      console.log('Step:', e.detail.method, e.detail.progress + '/' + e.detail.total);
    });
  ${'<'}/script>
</body>
</html>`

const PROGRAMMATIC_EXAMPLE = `import { FivucsasAuth } from '@fivucsas/auth-js';

const auth = new FivucsasAuth({
  clientId: 'your-client-id',
  baseUrl: 'https://verify.fivucsas.com',
  apiBaseUrl: 'https://auth.rollingcatsoftware.com/api/v1',
  locale: 'en',
  theme: { primaryColor: '#6366f1', mode: 'light' },
});

// Option A: Modal overlay (no container)
const result = await auth.verify({ flow: 'login', userId: 'user-123' });

// Option B: Inline embed
const result = await auth.verify({
  flow: 'login',
  userId: 'user-123',
  container: '#verify-container',  // CSS selector or HTMLElement
  onStepChange: (step) => console.log(step),
  onError: (err) => console.error(err),
  onCancel: () => console.log('cancelled'),
});

console.log(result.success, result.completedMethods);`

const REACT_EXAMPLE = `import { useRef, useState, useCallback } from 'react';
import { FivucsasAuth } from '@fivucsas/auth-js';
import type { VerifyResult } from '@fivucsas/auth-js';

interface VerifyButtonProps {
  userId: string;
  onComplete: (result: VerifyResult) => void;
}

export function VerifyButton({ userId, onComplete }: VerifyButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = useCallback(async () => {
    setLoading(true);
    setError(null);

    const auth = new FivucsasAuth({
      clientId: 'your-client-id',
      baseUrl: window.location.origin + '/verify',
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      locale: 'en',
      theme: { primaryColor: '#6366f1', borderRadius: '12px' },
    });

    try {
      const result = await auth.verify({
        flow: 'login',
        userId,
        container: containerRef.current ?? undefined,
        onStepChange: (step) => console.log('Step:', step),
        onError: (err) => setError(err.message),
        onCancel: () => setError('Cancelled by user'),
      });
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }, [userId, onComplete]);

  return (
    <div>
      <button onClick={handleVerify} disabled={loading}>
        {loading ? 'Verifying...' : 'Verify Identity'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div ref={containerRef} />
    </div>
  );
}`

// ─── Sub-components ─────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }, [code])

    return (
        <Box sx={{ position: 'relative' }}>
            <Button
                size="small"
                startIcon={copied ? <Verified /> : <ContentCopy />}
                onClick={handleCopy}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    fontSize: '0.75rem',
                    color: copied ? 'success.main' : 'grey.400',
                    bgcolor: 'rgba(30,30,46,0.9)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid',
                    borderColor: copied ? 'success.main' : 'rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: 'rgba(30,30,46,1)', borderColor: 'rgba(255,255,255,0.2)' },
                }}
            >
                {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Chip
                label={language}
                size="small"
                sx={{
                    position: 'absolute',
                    top: 10,
                    left: 12,
                    zIndex: 1,
                    fontSize: '0.65rem',
                    height: 20,
                    bgcolor: 'rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                    fontWeight: 600,
                    letterSpacing: 0.5,
                }}
            />
            <Box
                component="pre"
                sx={{
                    p: 2,
                    pt: 4.5,
                    borderRadius: '8px',
                    bgcolor: '#1e1e2e',
                    color: '#cdd6f4',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                    overflow: 'auto',
                    maxHeight: 420,
                    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                    border: '1px solid',
                    borderColor: 'rgba(255,255,255,0.06)',
                    '&::-webkit-scrollbar': { height: 6, width: 6 },
                    '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'rgba(255,255,255,0.15)',
                        borderRadius: 3,
                    },
                }}
            >
                <Box component="code" data-language={language}>
                    {code}
                </Box>
            </Box>
        </Box>
    )
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
    return (
        <Card
            variant="outlined"
            sx={{
                height: '100%',
                borderRadius: '12px',
                borderColor: 'divider',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 0 0 1px rgba(99,102,241,0.2)',
                },
            }}
        >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ color: 'primary.main', mb: 1 }}>{icon}</Box>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {label}
                </Typography>
            </CardContent>
        </Card>
    )
}

function ArchitectureLayer({
    title,
    subtitle,
    items,
    color,
}: {
    title: string
    subtitle: string
    items: string[]
    color: string
}) {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2.5,
                borderRadius: '12px',
                borderColor: color,
                borderWidth: 1,
                borderLeftWidth: 4,
            }}
        >
            <Typography variant="subtitle1" fontWeight={700} sx={{ color, mb: 0.25 }}>
                {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {subtitle}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {items.map((item) => (
                    <Chip
                        key={item}
                        label={item}
                        size="small"
                        sx={{
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            bgcolor: `${color}14`,
                            color,
                            border: '1px solid',
                            borderColor: `${color}30`,
                        }}
                    />
                ))}
            </Box>
        </Paper>
    )
}

const AUTH_METHODS = [
    { name: 'Password', icon: <Password sx={{ fontSize: 20 }} /> },
    { name: 'Face', icon: <Face sx={{ fontSize: 20 }} /> },
    { name: 'Fingerprint', icon: <Fingerprint sx={{ fontSize: 20 }} /> },
    { name: 'Voice', icon: <RecordVoiceOver sx={{ fontSize: 20 }} /> },
    { name: 'TOTP', icon: <Timer sx={{ fontSize: 20 }} /> },
    { name: 'Email OTP', icon: <Sms sx={{ fontSize: 20 }} /> },
    { name: 'SMS OTP', icon: <Sms sx={{ fontSize: 20 }} /> },
    { name: 'QR Code', icon: <QrCode2 sx={{ fontSize: 20 }} /> },
    { name: 'Hardware Key', icon: <Key sx={{ fontSize: 20 }} /> },
    { name: 'NFC', icon: <Nfc sx={{ fontSize: 20 }} /> },
] as const

// ─── Main Component ─────────────────────────────────────────────────

export default function WidgetDemoPage() {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState(0)
    const [demoResult, setDemoResult] = useState<VerifyResult | null>(null)
    const [demoError, setDemoError] = useState<string | null>(null)
    const [demoStatus, setDemoStatus] = useState<DemoStatus>('idle')
    const inlineContainerRef = useRef<HTMLDivElement>(null)
    const authRef = useRef<FivucsasAuth | null>(null)

    const handleLiveDemo = useCallback(
        async (mode: 'modal' | 'inline') => {
            setDemoResult(null)
            setDemoError(null)
            setDemoStatus('verifying')

            const apiBaseUrl =
                import.meta.env.VITE_API_BASE_URL || 'https://auth.rollingcatsoftware.com/api/v1'
            const baseUrl = window.location.origin + '/verify'

            const auth = new FivucsasAuth({
                clientId: 'fivucsas-web-app',
                baseUrl,
                apiBaseUrl,
                locale: (document.documentElement.lang as 'en' | 'tr') || 'en',
                theme: { primaryColor: '#6366f1', borderRadius: '12px' },
            })
            authRef.current = auth

            try {
                const result = await auth.verify({
                    flow: 'login',
                    userId: user?.id,
                    container:
                        mode === 'inline' ? (inlineContainerRef.current ?? undefined) : undefined,
                    onStepChange: (step) => {
                        if (import.meta.env.DEV) {
                            console.log('[WidgetDemo] Step:', step)
                        }
                    },
                    onError: (err) => {
                        setDemoError(err.message)
                        setDemoStatus('error')
                    },
                    onCancel: () => {
                        setDemoError('Verification cancelled by user')
                        setDemoStatus('cancelled')
                    },
                })
                setDemoResult(result)
                setDemoStatus('complete')
            } catch (err) {
                if (
                    err instanceof Error &&
                    !err.message.includes('cancelled') &&
                    !err.message.includes('destroyed')
                ) {
                    setDemoError(err.message)
                    setDemoStatus('error')
                }
            } finally {
                authRef.current = null
            }
        },
        [user?.id],
    )

    const handleStopDemo = useCallback(() => {
        authRef.current?.destroy()
        authRef.current = null
        setDemoStatus('cancelled')
    }, [])

    const isRunning = demoStatus === 'verifying'

    return (
        <Box sx={{ maxWidth: 960, mx: 'auto' }}>
            {/* ── Page Header ────────────────────────────────────── */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Web sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="h5" fontWeight={700}>
                        Auth Widget
                    </Typography>
                    <Chip
                        label="Embeddable SDK"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
                    The FIVUCSAS embeddable authentication widget -- like Stripe Elements, but for
                    biometric identity verification. Drop a single script tag into any website to add
                    multi-factor biometric auth.
                </Typography>
            </Box>

            {/* ── Platform Stats ──────────────────────────────────── */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        value="10"
                        label="Auth Methods"
                        icon={<Security sx={{ fontSize: 28 }} />}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        value="9.5KB"
                        label="SDK Size (gzip)"
                        icon={<Inventory2 sx={{ fontSize: 28 }} />}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        value="Zero"
                        label="Dependencies"
                        icon={<Layers sx={{ fontSize: 28 }} />}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        value="OAuth 2.0"
                        label="OIDC Compatible"
                        icon={<VerifiedUser sx={{ fontSize: 28 }} />}
                    />
                </Grid>
            </Grid>

            {/* ── Live Demo ───────────────────────────────────────── */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                        Live Demo
                    </Typography>
                    <StatusIndicator status={demoStatus} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Try the widget in real time. The SDK communicates with the verify-app via
                    postMessage and renders inside an isolated iframe.
                </Typography>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={5}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<PlayArrow />}
                            onClick={() => handleLiveDemo('modal')}
                            disabled={isRunning}
                            sx={{
                                py: 1.5,
                                borderRadius: '10px',
                                background:
                                    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                '&:hover': {
                                    background:
                                        'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                },
                            }}
                        >
                            Try Modal Demo
                        </Button>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
                        >
                            Opens verification in a centered overlay
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={5}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<PlayArrow />}
                            onClick={() => handleLiveDemo('inline')}
                            disabled={isRunning}
                            sx={{ py: 1.5, borderRadius: '10px' }}
                        >
                            Try Inline Demo
                        </Button>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
                        >
                            Embeds verification directly in the page below
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={2} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                        {isRunning && (
                            <Button
                                fullWidth
                                variant="text"
                                color="error"
                                startIcon={<Stop />}
                                onClick={handleStopDemo}
                                sx={{ py: 1.5, borderRadius: '10px' }}
                            >
                                Stop
                            </Button>
                        )}
                    </Grid>
                </Grid>

                {/* Inline widget container */}
                <Box
                    ref={inlineContainerRef}
                    sx={{
                        minHeight: isRunning ? 400 : 0,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: isRunning ? '2px dashed' : 'none',
                        borderColor: 'primary.main',
                        bgcolor: isRunning ? 'action.hover' : 'transparent',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                    }}
                >
                    {isRunning && (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                position: 'absolute',
                                top: 8,
                                left: 12,
                                opacity: 0.6,
                                fontSize: '0.7rem',
                            }}
                        >
                            Inline widget container
                        </Typography>
                    )}
                </Box>

                {demoResult && (
                    <Alert severity="success" sx={{ mt: 2, borderRadius: '8px' }}>
                        <strong>Verification complete.</strong> Session: {demoResult.sessionId}.
                        Methods: {demoResult.completedMethods.join(', ') || 'none'}.
                    </Alert>
                )}

                {demoError && (
                    <Alert severity={demoStatus === 'cancelled' ? 'warning' : 'error'} sx={{ mt: 2, borderRadius: '8px' }}>
                        {demoError}
                    </Alert>
                )}
            </Paper>

            {/* ── Architecture ────────────────────────────────────── */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AccountTree sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                        Architecture
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Three-layer architecture isolating sensitive biometric capture inside a sandboxed
                    iframe. The host page never touches raw biometric data.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                    <ArchitectureLayer
                        title="Layer 1 -- Developer API"
                        subtitle="Your application integrates here"
                        items={[
                            'FivucsasAuth SDK',
                            'Web Component',
                            'postMessage Bridge',
                            'Promise-based API',
                            'Event Callbacks',
                        ]}
                        color="#6366f1"
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'center', color: 'text.disabled' }}>
                        <Typography variant="caption">postMessage</Typography>
                    </Box>
                    <ArchitectureLayer
                        title="Layer 2 -- Orchestration"
                        subtitle="Manages auth flow steps inside the iframe"
                        items={[
                            'Multi-Step Controller',
                            'Session Manager',
                            'Step Router',
                            'Theme Engine',
                            'i18n (EN/TR)',
                        ]}
                        color="#8b5cf6"
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'center', color: 'text.disabled' }}>
                        <Typography variant="caption">Internal API calls</Typography>
                    </Box>
                    <ArchitectureLayer
                        title="Layer 3 -- Secure Capture"
                        subtitle="Biometric data stays within the sandboxed origin"
                        items={[
                            'Camera (Face)',
                            'Microphone (Voice)',
                            'WebAuthn (Fingerprint/Key)',
                            'NFC Reader',
                            'TOTP / OTP Input',
                        ]}
                        color="#10b981"
                    />
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                    Supported Auth Methods
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {AUTH_METHODS.map(({ name, icon }) => (
                        <Chip
                            key={name}
                            icon={icon}
                            label={name}
                            variant="outlined"
                            size="small"
                            sx={{
                                borderRadius: '8px',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                                '& .MuiChip-icon': { color: 'primary.main' },
                            }}
                        />
                    ))}
                </Box>
            </Paper>

            {/* ── Integration Examples ────────────────────────────── */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Code sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                        Integration Examples
                    </Typography>
                </Box>

                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    sx={{
                        mb: 2,
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40 },
                    }}
                >
                    <Tab label="HTML / Script Tag" />
                    <Tab label="JavaScript / TypeScript" />
                    <Tab label="React" />
                </Tabs>

                <Divider sx={{ mb: 2 }} />

                {activeTab === 0 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            The simplest integration. Drop the script tag and Web Component into any
                            HTML page. No build tools required -- just a complete working page.
                        </Typography>
                        <CodeBlock code={SCRIPT_TAG_EXAMPLE} language="html" />

                        <Card variant="outlined" sx={{ mt: 2, p: 2, borderRadius: '8px' }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Web Component Events
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="div">
                                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                    <li>
                                        <code>fivucsas-complete</code> -- Verification succeeded
                                        (detail: VerifyResult)
                                    </li>
                                    <li>
                                        <code>fivucsas-error</code> -- An error occurred (detail: {'{'}{' '}
                                        message {'}'})
                                    </li>
                                    <li>
                                        <code>fivucsas-cancel</code> -- User cancelled the flow
                                    </li>
                                    <li>
                                        <code>fivucsas-step-change</code> -- Step progress (detail:{' '}
                                        {'{'} method, progress, total {'}'})
                                    </li>
                                </Box>
                            </Typography>
                        </Card>
                    </Box>
                )}

                {activeTab === 1 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Full programmatic control. Use the FivucsasAuth class directly for modal or
                            inline embedding with promise-based completion.
                        </Typography>
                        <CodeBlock code={PROGRAMMATIC_EXAMPLE} language="typescript" />

                        <Card variant="outlined" sx={{ mt: 2, p: 2, borderRadius: '8px' }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Configuration Options
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="div">
                                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                    <li>
                                        <code>clientId</code> -- Your application identifier
                                        (required)
                                    </li>
                                    <li>
                                        <code>baseUrl</code> -- Verify app URL (default:
                                        verify.fivucsas.com)
                                    </li>
                                    <li>
                                        <code>apiBaseUrl</code> -- Identity Core API URL
                                    </li>
                                    <li>
                                        <code>locale</code> -- &apos;en&apos; or &apos;tr&apos;
                                    </li>
                                    <li>
                                        <code>theme</code> -- {'{'} primaryColor, borderRadius,
                                        fontFamily, mode {'}'}
                                    </li>
                                </Box>
                            </Typography>
                        </Card>
                    </Box>
                )}

                {activeTab === 2 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Complete React component with TypeScript types, error handling, and inline
                            container support. This is the same pattern the FIVUCSAS dashboard uses
                            internally.
                        </Typography>
                        <CodeBlock code={REACT_EXAMPLE} language="tsx" />
                    </Box>
                )}
            </Paper>

            {/* ── Footer ──────────────────────────────────────────── */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    mt: 1,
                    mb: 2,
                    opacity: 0.45,
                }}
            >
                <VerifiedUser sx={{ fontSize: 14 }} />
                <Typography variant="caption" color="text.secondary">
                    FIVUCSAS dogfooding -- the platform consuming its own auth widget
                </Typography>
            </Box>
        </Box>
    )
}
