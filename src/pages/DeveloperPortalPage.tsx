import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add,
    ContentCopy,
    Delete,
    Visibility,
    VisibilityOff,
    Code,
    CheckCircle,
    Login,
    MenuBook,
    OpenInNew,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuth2App {
    id: string
    appName: string
    clientId: string
    clientSecret?: string // only present in creation response
    redirectUris: string[]
    scopes: string[]
    status: 'ACTIVE' | 'INACTIVE'
    createdAt: string
}

const AVAILABLE_SCOPES = ['openid', 'profile', 'email', 'auth'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskClientId(clientId: string): string {
    if (clientId.length <= 12) return clientId
    return clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 4)
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeveloperPortalPage() {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const logger = useService<ILogger>(TYPES.Logger)
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()

    // --- App state (from backend) ---
    const [apps, setApps] = useState<OAuth2App[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Register dialog
    const [registerOpen, setRegisterOpen] = useState(false)
    const [appName, setAppName] = useState('')
    const [redirectUris, setRedirectUris] = useState('')
    const [selectedScopes, setSelectedScopes] = useState<string[]>(['openid'])
    const [registerLoading, setRegisterLoading] = useState(false)

    // Credentials reveal dialog
    const [credentialsApp, setCredentialsApp] = useState<OAuth2App | null>(null)

    // View secret (not functional for existing apps — secret is hashed server-side)
    const [visibleSecrets] = useState<Record<string, boolean>>({})

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<OAuth2App | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // Feedback
    const [success, setSuccess] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null)

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg)
        setTimeout(() => setSuccess(null), 4000)
    }, [])

    // --- Load apps from backend ---
    const loadApps = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await httpClient.get<OAuth2App[]>('/oauth2/clients')
            setApps(res.data)
        } catch (err) {
            logger.error('Failed to load OAuth2 clients', err)
            setError(t('developerPortal.loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [httpClient, logger, t])

    useEffect(() => {
        if (isAuthenticated) {
            loadApps()
        }
    }, [loadApps, isAuthenticated])

    // --- Copy to clipboard ---
    const handleCopy = useCallback(async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(label)
            setTimeout(() => setCopied(null), 2000)
        } catch {
            // fallback: select text
        }
    }, [])

    // --- Register new app (real API) ---
    const handleRegister = useCallback(async () => {
        setRegisterLoading(true)
        try {
            const res = await httpClient.post<OAuth2App>('/oauth2/clients', {
                appName: appName.trim(),
                redirectUris: redirectUris.trim(),
                scopes: [...selectedScopes],
            })

            const newApp = res.data

            // Prepend to list
            setApps((prev) => [
                { ...newApp, clientSecret: undefined },
                ...prev.filter((a) => a.id !== newApp.id),
            ])

            setRegisterOpen(false)

            // Reset form
            setAppName('')
            setRedirectUris('')
            setSelectedScopes(['openid'])

            // Show credentials (secret is in the creation response only)
            setCredentialsApp(newApp)
        } catch (err) {
            logger.error('Failed to register OAuth2 client', err)
            setError(t('developerPortal.registerFailed'))
        } finally {
            setRegisterLoading(false)
        }
    }, [appName, redirectUris, selectedScopes, httpClient, logger, t])

    // --- Delete app (real API) ---
    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        setDeleteLoading(true)
        try {
            await httpClient.delete(`/oauth2/clients/${deleteTarget.id}`)
            setApps((prev) => prev.filter((a) => a.id !== deleteTarget.id))
            setDeleteTarget(null)
            showSuccess(t('developerPortal.deleteSuccess'))
        } catch (err) {
            logger.error('Failed to delete OAuth2 client', err)
            setError(t('developerPortal.deleteFailed'))
        } finally {
            setDeleteLoading(false)
        }
    }, [deleteTarget, httpClient, logger, showSuccess, t])

    // --- Toggle scope ---
    const toggleScope = (scope: string) => {
        setSelectedScopes((prev) =>
            prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
        )
    }

    // --- Quick Start code snippets ---
    const scriptSnippet = `<!-- Auth widget SDK (replace with your build or CDN URL) -->
<script src="https://api.fivucsas.com/sdk/auth-widget.js"></script>
<script>
  FivucsasAuth.init({
    clientId: 'YOUR_CLIENT_ID',
    redirectUri: 'https://yourapp.com/callback',
    scopes: ['openid', 'profile', 'email'],
  });
</script>`

    const callbackSnippet = `// Handle the OAuth2 callback
const params = new URLSearchParams(window.location.search);
const code = params.get('code');

if (code) {
  const response = await fetch('https://api.fivucsas.com/api/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      redirect_uri: 'https://yourapp.com/callback',
    }),
  });
  const { access_token, id_token } = await response.json();
}`

    return (
        <PageTransition>
            <Box>
                {/* --- Header --- */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between',
                            alignItems: { xs: 'stretch', sm: 'flex-start' },
                            gap: { xs: 2, sm: 0 },
                            mb: 3,
                        }}
                    >
                        <Box>
                            <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                                {t('developerPortal.title')}
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                {t('developerPortal.subtitle')}
                            </Typography>
                        </Box>
                        {isAuthenticated && (
                            <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={() => setRegisterOpen(true)}
                                sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                            >
                                {t('developerPortal.registerApp')}
                            </Button>
                        )}
                    </Box>
                </motion.div>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                        {success}
                    </Alert>
                )}

                {/* --- Integration Guide Banner --- */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: easeOut }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            gap: 2,
                            p: { xs: 2, sm: 2.5 },
                            mb: 3,
                            border: '1px solid',
                            borderColor: 'primary.main',
                            borderRadius: 2,
                            background: (theme) =>
                                theme.palette.mode === 'dark'
                                    ? 'rgba(99,102,241,0.08)'
                                    : 'rgba(99,102,241,0.04)',
                        }}
                    >
                        <MenuBook sx={{ fontSize: 36, color: 'primary.main', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle1" fontWeight={700}>
                                    {t('developerPortal.integrationGuide')}
                                </Typography>
                                <Chip
                                    label={t('developerPortal.integrationGuideBadge')}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ fontSize: 11 }}
                                />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {t('developerPortal.integrationGuideDesc')}
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                            href="https://github.com/fivucsas/docs/blob/main/INTEGRATION_GUIDE.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                        >
                            {t('developerPortal.integrationGuideBtn')}
                        </Button>
                    </Paper>
                </motion.div>

                {/* --- Sign-in CTA for unauthenticated users --- */}
                {!isAuthenticated && (
                    <Paper
                        sx={{
                            textAlign: 'center',
                            py: 5,
                            px: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            mb: 2,
                        }}
                        elevation={0}
                    >
                        <Login sx={{ fontSize: 48, color: 'primary.main', mb: 1.5 }} />
                        <Typography variant="h6" gutterBottom>
                            {t('developerPortal.signInToManage')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
                            {t('developerPortal.signInToManageDesc')}
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<Login />}
                            onClick={() => navigate('/login')}
                        >
                            {t('publicLayout.signIn')}
                        </Button>
                    </Paper>
                )}

                {/* --- Loading spinner (authenticated only) --- */}
                {isAuthenticated && loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {/* --- Registered Apps Table (authenticated only) --- */}
                {isAuthenticated && !loading && apps.length === 0 ? (
                    <Paper
                        sx={{
                            textAlign: 'center',
                            py: 8,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                        }}
                        elevation={0}
                    >
                        <Code sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            {t('developerPortal.noApps')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {t('developerPortal.noAppsHint')}
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<Add />}
                            onClick={() => setRegisterOpen(true)}
                        >
                            {t('developerPortal.registerApp')}
                        </Button>
                    </Paper>
                ) : isAuthenticated && !loading && (
                    <TableContainer
                        component={Paper}
                        elevation={0}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}
                    >
                        <Table sx={{ minWidth: 650 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('developerPortal.appName')}</TableCell>
                                    <TableCell>{t('developerPortal.clientId')}</TableCell>
                                    <TableCell>{t('developerPortal.scopes')}</TableCell>
                                    <TableCell>{t('developerPortal.created')}</TableCell>
                                    <TableCell>{t('common.status')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {apps.map((app) => (
                                    <TableRow key={app.id} hover>
                                        <TableCell>
                                            <Typography variant="subtitle2" fontWeight={600}>
                                                {app.appName}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {app.redirectUris.join(', ')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography
                                                    variant="body2"
                                                    fontFamily="monospace"
                                                    sx={{ fontSize: 13 }}
                                                >
                                                    {maskClientId(app.clientId)}
                                                </Typography>
                                                <Tooltip title={copied === app.clientId ? t('developerPortal.copied') : t('developerPortal.copyClientId')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopy(app.clientId, app.clientId)}
                                                        aria-label={t('common.aria.copy')}
                                                    >
                                                        <ContentCopy sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {app.scopes.map((scope) => (
                                                    <Chip key={scope} label={scope} size="small" variant="outlined" />
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{formatDate(app.createdAt)}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={app.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                                                size="small"
                                                color={app.status === 'ACTIVE' ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                                <Tooltip title={t('developerPortal.viewSecret')}>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            disabled
                                                            aria-label={t('common.aria.view')}
                                                        >
                                                            {visibleSecrets[app.id] ? (
                                                                <VisibilityOff fontSize="small" />
                                                            ) : (
                                                                <Visibility fontSize="small" />
                                                            )}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title={t('common.delete')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setDeleteTarget(app)}
                                                        sx={{ color: 'error.main' }}
                                                        aria-label={t('common.aria.delete')}
                                                    >
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* --- Quick Start Guide --- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: easeOut }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 2, sm: 3 },
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            mt: 2,
                        }}
                    >
                        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                            {t('developerPortal.quickStart')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {t('developerPortal.quickStartDesc')}
                        </Typography>

                        {/* Step 1 */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip label="1" size="small" color="primary" />
                                <Typography variant="subtitle1" fontWeight={600}>
                                    {t('developerPortal.step1Title')}
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                {t('developerPortal.step1Desc')}
                            </Typography>
                        </Box>

                        {/* Step 2 */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip label="2" size="small" color="primary" />
                                <Typography variant="subtitle1" fontWeight={600}>
                                    {t('developerPortal.step2Title')}
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {t('developerPortal.step2Desc')}
                            </Typography>
                            <Box
                                sx={{
                                    position: 'relative',
                                    bgcolor: 'grey.900',
                                    color: 'grey.100',
                                    p: { xs: 1.5, sm: 2 },
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    fontSize: { xs: 11, sm: 13 },
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre',
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(scriptSnippet, 'script')}
                                    aria-label={t('common.aria.copy')}
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        color: 'grey.400',
                                        '&:hover': { color: 'grey.100' },
                                    }}
                                >
                                    <ContentCopy sx={{ fontSize: 16 }} />
                                </IconButton>
                                {scriptSnippet}
                            </Box>
                            {copied === 'script' && (
                                <Typography variant="caption" color="success.main">
                                    {t('developerPortal.copiedToClipboard')}
                                </Typography>
                            )}
                        </Box>

                        {/* Step 3 */}
                        <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip label="3" size="small" color="primary" />
                                <Typography variant="subtitle1" fontWeight={600}>
                                    {t('developerPortal.step3Title')}
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {t('developerPortal.step3Desc')}
                            </Typography>
                            <Box
                                sx={{
                                    position: 'relative',
                                    bgcolor: 'grey.900',
                                    color: 'grey.100',
                                    p: { xs: 1.5, sm: 2 },
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    fontSize: { xs: 11, sm: 13 },
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre',
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(callbackSnippet, 'callback')}
                                    aria-label={t('common.aria.copy')}
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        color: 'grey.400',
                                        '&:hover': { color: 'grey.100' },
                                    }}
                                >
                                    <ContentCopy sx={{ fontSize: 16 }} />
                                </IconButton>
                                {callbackSnippet}
                            </Box>
                            {copied === 'callback' && (
                                <Typography variant="caption" color="success.main">
                                    {t('developerPortal.copiedToClipboard')}
                                </Typography>
                            )}
                        </Box>
                    </Paper>
                </motion.div>

                {/* ============================================================ */}
                {/* Register New App Dialog                                      */}
                {/* ============================================================ */}
                <Dialog
                    open={registerOpen}
                    onClose={() => setRegisterOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>{t('developerPortal.registerApp')}</DialogTitle>
                    <DialogContent
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}
                    >
                        <TextField
                            label={t('developerPortal.appName')}
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            fullWidth
                            required
                            autoFocus
                        />
                        <TextField
                            label={t('developerPortal.redirectUris')}
                            value={redirectUris}
                            onChange={(e) => setRedirectUris(e.target.value)}
                            fullWidth
                            required
                            placeholder="https://yourapp.com/callback, https://localhost:3000/callback"
                            helperText={t('developerPortal.redirectUrisHelper')}
                        />
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                {t('developerPortal.allowedScopes')}
                            </Typography>
                            <FormGroup row>
                                {AVAILABLE_SCOPES.map((scope) => (
                                    <FormControlLabel
                                        key={scope}
                                        control={
                                            <Checkbox
                                                checked={selectedScopes.includes(scope)}
                                                onChange={() => toggleScope(scope)}
                                            />
                                        }
                                        label={scope}
                                    />
                                ))}
                            </FormGroup>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRegisterOpen(false)}>{t('common.cancel')}</Button>
                        <Button
                            variant="contained"
                            onClick={handleRegister}
                            disabled={!appName.trim() || !redirectUris.trim() || registerLoading}
                            startIcon={
                                registerLoading ? <CircularProgress size={16} /> : <Add />
                            }
                        >
                            {t('developerPortal.register')}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* ============================================================ */}
                {/* Credentials Reveal Dialog (shown once after creation)         */}
                {/* ============================================================ */}
                <Dialog
                    open={!!credentialsApp}
                    onClose={() => setCredentialsApp(null)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle color="success" />
                        {t('developerPortal.appCreated')}
                    </DialogTitle>
                    <DialogContent>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {t('developerPortal.secretWarning')}
                        </Alert>

                        {credentialsApp && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {/* Client ID */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('developerPortal.clientId')}
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            bgcolor: 'action.hover',
                                            p: 1.5,
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            fontFamily="monospace"
                                            sx={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}
                                        >
                                            {credentialsApp.clientId}
                                        </Typography>
                                        <Tooltip title={copied === 'cred-id' ? t('developerPortal.copied') : t('developerPortal.copy')}>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleCopy(credentialsApp.clientId, 'cred-id')
                                                }
                                                aria-label={t('common.aria.copy')}
                                            >
                                                <ContentCopy sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>

                                {/* Client Secret */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('developerPortal.clientSecret')}
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            bgcolor: 'warning.lighter',
                                            border: '1px solid',
                                            borderColor: 'warning.main',
                                            p: 1.5,
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            fontFamily="monospace"
                                            sx={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}
                                        >
                                            {credentialsApp.clientSecret}
                                        </Typography>
                                        <Tooltip title={copied === 'cred-secret' ? t('developerPortal.copied') : t('developerPortal.copy')}>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleCopy(credentialsApp.clientSecret ?? '', 'cred-secret')
                                                }
                                                aria-label={t('common.aria.copy')}
                                            >
                                                <ContentCopy sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button variant="contained" onClick={() => setCredentialsApp(null)}>
                            {t('developerPortal.done')}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* ============================================================ */}
                {/* Delete Confirmation Dialog                                    */}
                {/* ============================================================ */}
                <Dialog
                    open={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle>{t('developerPortal.deleteApp')}</DialogTitle>
                    <DialogContent>
                        <Typography>
                            {t('developerPortal.deleteConfirm', { name: deleteTarget?.appName })}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            startIcon={deleteLoading ? <CircularProgress size={16} /> : undefined}
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </PageTransition>
    )
}
