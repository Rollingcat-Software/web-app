import { useRef, useState, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    Divider,
    Paper,
    Tab,
    Tabs,
    Typography,
} from '@mui/material'
import {
    Code,
    ContentCopy,
    PlayArrow,
    VerifiedUser,
    Web,
} from '@mui/icons-material'
import { FivucsasAuth } from '@/verify-app/sdk/FivucsasAuth'
import type { VerifyResult } from '@/verify-app/sdk/FivucsasAuth'
import { useAuth } from '@features/auth/hooks/useAuth'

// ─── Code Examples ──────────────────────────────────────────────────

const SCRIPT_TAG_EXAMPLE = `<!-- 1. Include the SDK -->
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
  document.querySelector('fivucsas-verify')
    .addEventListener('fivucsas-complete', (e) => {
      console.log('Verified!', e.detail);
    });
${'<'}/script>`

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

const REACT_EXAMPLE = `import { useRef, useEffect } from 'react';
import { FivucsasAuth } from '@fivucsas/auth-js';

function VerifyButton({ userId, onComplete }) {
  const containerRef = useRef(null);

  const handleVerify = async () => {
    const auth = new FivucsasAuth({
      clientId: 'your-client-id',
      baseUrl: window.location.origin + '/verify',
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    });

    try {
      const result = await auth.verify({
        flow: 'login',
        userId,
        container: containerRef.current,
      });
      onComplete(result);
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  return (
    <div>
      <button onClick={handleVerify}>Verify Identity</button>
      <div ref={containerRef} />
    </div>
  );
}`

// ─── Component ──────────────────────────────────────────────────────

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
                startIcon={copied ? <VerifiedUser /> : <ContentCopy />}
                onClick={handleCopy}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    fontSize: '0.75rem',
                    color: copied ? 'success.main' : 'text.secondary',
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' },
                }}
            >
                {copied ? 'Copied' : 'Copy'}
            </Button>
            <Box
                component="pre"
                sx={{
                    p: 2,
                    borderRadius: '8px',
                    bgcolor: '#1e1e2e',
                    color: '#cdd6f4',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                    overflow: 'auto',
                    maxHeight: 400,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    '&::-webkit-scrollbar': { height: 6, width: 6 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
                }}
            >
                <Box component="code" data-language={language}>
                    {code}
                </Box>
            </Box>
        </Box>
    )
}

export default function WidgetDemoPage() {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState(0)
    const [demoResult, setDemoResult] = useState<VerifyResult | null>(null)
    const [demoError, setDemoError] = useState<string | null>(null)
    const [demoRunning, setDemoRunning] = useState(false)
    const inlineContainerRef = useRef<HTMLDivElement>(null)
    const authRef = useRef<FivucsasAuth | null>(null)

    const handleLiveDemo = useCallback(async (mode: 'modal' | 'inline') => {
        setDemoResult(null)
        setDemoError(null)
        setDemoRunning(true)

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://auth.rollingcatsoftware.com/api/v1'
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
                container: mode === 'inline' ? inlineContainerRef.current ?? undefined : undefined,
                onStepChange: (step) => {
                    if (import.meta.env.DEV) {
                        console.log('[WidgetDemo] Step:', step)
                    }
                },
                onError: (err) => {
                    setDemoError(err.message)
                },
                onCancel: () => {
                    setDemoError('Verification cancelled by user')
                },
            })
            setDemoResult(result)
        } catch (err) {
            if (err instanceof Error && !err.message.includes('cancelled') && !err.message.includes('destroyed')) {
                setDemoError(err.message)
            }
        } finally {
            setDemoRunning(false)
            authRef.current = null
        }
    }, [user?.id])

    const handleStopDemo = useCallback(() => {
        authRef.current?.destroy()
        authRef.current = null
        setDemoRunning(false)
    }, [])

    return (
        <Box>
            {/* Page Header */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Web sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="h5" fontWeight={700}>
                        Auth Widget Integration
                    </Typography>
                    <Chip
                        label="Dogfooding"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    />
                </Box>
                <Typography variant="body2" color="text.secondary">
                    The FIVUCSAS embeddable authentication widget -- like Stripe Elements, but for biometric identity.
                    This platform uses its own widget for secondary authentication after password login.
                </Typography>
            </Box>

            {/* Live Demo Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    Live Demo
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Try the widget in modal or inline mode. The widget communicates with the
                    verify-app via postMessage and renders inside an iframe.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={() => handleLiveDemo('modal')}
                        disabled={demoRunning}
                        sx={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
                        }}
                    >
                        Launch Modal
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<PlayArrow />}
                        onClick={() => handleLiveDemo('inline')}
                        disabled={demoRunning}
                    >
                        Launch Inline (below)
                    </Button>
                    {demoRunning && (
                        <Button
                            variant="text"
                            color="error"
                            onClick={handleStopDemo}
                        >
                            Stop
                        </Button>
                    )}
                </Box>

                {/* Inline widget container */}
                <Box
                    ref={inlineContainerRef}
                    sx={{
                        minHeight: demoRunning ? 400 : 0,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: demoRunning ? '1px solid' : 'none',
                        borderColor: 'divider',
                        transition: 'min-height 0.3s ease',
                    }}
                />

                {demoResult && (
                    <Alert severity="success" sx={{ mt: 2, borderRadius: '8px' }}>
                        Verification complete. Session: {demoResult.sessionId}.
                        Methods: {demoResult.completedMethods.join(', ') || 'none'}.
                    </Alert>
                )}

                {demoError && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: '8px' }}>
                        {demoError}
                    </Alert>
                )}
            </Paper>

            {/* Integration Examples */}
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Code sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                        Integration Examples
                    </Typography>
                </Box>

                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    sx={{ mb: 2 }}
                >
                    <Tab label="Script Tag" />
                    <Tab label="Programmatic (JS/TS)" />
                    <Tab label="React" />
                </Tabs>

                <Divider sx={{ mb: 2 }} />

                {activeTab === 0 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            The simplest integration. Drop the script tag and Web Component into any HTML page.
                            No build tools required.
                        </Typography>
                        <CodeBlock code={SCRIPT_TAG_EXAMPLE} language="html" />

                        <Card variant="outlined" sx={{ mt: 2, p: 2, borderRadius: '8px' }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Web Component Events
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="div">
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    <li><code>fivucsas-complete</code> -- Verification succeeded (detail: VerifyResult)</li>
                                    <li><code>fivucsas-error</code> -- An error occurred (detail: {'{'} message {'}'} )</li>
                                    <li><code>fivucsas-cancel</code> -- User cancelled the flow</li>
                                    <li><code>fivucsas-step-change</code> -- Step progress update (detail: {'{'} method, progress, total {'}'} )</li>
                                </ul>
                            </Typography>
                        </Card>
                    </Box>
                )}

                {activeTab === 1 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Full programmatic control. Use the FivucsasAuth class directly for
                            modal or inline embedding with promise-based completion.
                        </Typography>
                        <CodeBlock code={PROGRAMMATIC_EXAMPLE} language="typescript" />

                        <Card variant="outlined" sx={{ mt: 2, p: 2, borderRadius: '8px' }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Configuration Options
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="div">
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    <li><code>clientId</code> -- Your application identifier (required)</li>
                                    <li><code>baseUrl</code> -- Verify app URL (default: verify.fivucsas.com)</li>
                                    <li><code>apiBaseUrl</code> -- Identity Core API URL</li>
                                    <li><code>locale</code> -- 'en' or 'tr'</li>
                                    <li><code>theme</code> -- {'{'} primaryColor, borderRadius, fontFamily, mode {'}'}</li>
                                </ul>
                            </Typography>
                        </Card>
                    </Box>
                )}

                {activeTab === 2 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            React integration using refs and async/await. This is exactly how the
                            FIVUCSAS admin dashboard (this app) integrates its own widget for secondary auth.
                        </Typography>
                        <CodeBlock code={REACT_EXAMPLE} language="tsx" />
                    </Box>
                )}
            </Paper>

            {/* Architecture note */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    mt: 3,
                    opacity: 0.5,
                }}
            >
                <VerifiedUser sx={{ fontSize: 14 }} />
                <Typography variant="caption" color="text.secondary">
                    This page demonstrates FIVUCSAS dogfooding -- the platform consuming its own auth widget
                </Typography>
            </Box>
        </Box>
    )
}
