import { useState, useCallback } from 'react'
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
    Warning,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'
import { useTranslation } from 'react-i18next'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuth2App {
    id: string
    appName: string
    clientId: string
    clientSecret: string // stored only in local state for demo
    redirectUris: string[]
    scopes: string[]
    status: 'ACTIVE' | 'INACTIVE'
    createdAt: string
}

const AVAILABLE_SCOPES = ['openid', 'profile', 'email', 'auth'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = prefix
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

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
    const { t } = useTranslation()

    // --- App state (local / mock) ---
    const [apps, setApps] = useState<OAuth2App[]>([])

    // Register dialog
    const [registerOpen, setRegisterOpen] = useState(false)
    const [appName, setAppName] = useState('')
    const [redirectUris, setRedirectUris] = useState('')
    const [selectedScopes, setSelectedScopes] = useState<string[]>(['openid'])
    const [registerLoading, setRegisterLoading] = useState(false)

    // Credentials reveal dialog
    const [credentialsApp, setCredentialsApp] = useState<OAuth2App | null>(null)

    // View secret
    const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<OAuth2App | null>(null)

    // Feedback
    const [success, setSuccess] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null)

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg)
        setTimeout(() => setSuccess(null), 4000)
    }, [])

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

    // --- Register new app (mock) ---
    const handleRegister = useCallback(async () => {
        setRegisterLoading(true)
        // Simulate a network call
        await new Promise((r) => setTimeout(r, 600))

        const newApp: OAuth2App = {
            id: crypto.randomUUID?.() ?? generateId(''),
            appName: appName.trim(),
            clientId: generateId('fiv_'),
            clientSecret: generateId('fiv_secret_'),
            redirectUris: redirectUris
                .split(',')
                .map((u) => u.trim())
                .filter(Boolean),
            scopes: [...selectedScopes],
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
        }

        setApps((prev) => [newApp, ...prev])
        setRegisterLoading(false)
        setRegisterOpen(false)

        // Reset form
        setAppName('')
        setRedirectUris('')
        setSelectedScopes(['openid'])

        // Show credentials
        setCredentialsApp(newApp)
    }, [appName, redirectUris, selectedScopes])

    // --- Delete app (mock) ---
    const handleDelete = useCallback(() => {
        if (!deleteTarget) return
        setApps((prev) => prev.filter((a) => a.id !== deleteTarget.id))
        setDeleteTarget(null)
        showSuccess(t('developerPortal.deleteSuccess'))
    }, [deleteTarget, showSuccess, t])

    // --- Toggle scope ---
    const toggleScope = (scope: string) => {
        setSelectedScopes((prev) =>
            prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
        )
    }

    // --- Toggle secret visibility ---
    const toggleSecretVisibility = (id: string) => {
        setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    // --- Quick Start code snippets ---
    const scriptSnippet = `<script src="https://cdn.fivucsas.com/auth-widget.js"></script>
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
  const response = await fetch('https://auth.rollingcatsoftware.com/api/v1/oauth2/token', {
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
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 3,
                        }}
                    >
                        <Box>
                            <Typography variant="h4" fontWeight={700}>
                                {t('developerPortal.title')}
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                {t('developerPortal.subtitle')}
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => setRegisterOpen(true)}
                        >
                            {t('developerPortal.registerApp')}
                        </Button>
                    </Box>
                </motion.div>

                {/* --- Backend integration notice --- */}
                <Alert severity="info" icon={<Warning />} sx={{ mb: 2 }}>
                    {t('developerPortal.backendPending')}
                </Alert>

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                        {success}
                    </Alert>
                )}

                {/* --- Registered Apps Table --- */}
                {apps.length === 0 ? (
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
                ) : (
                    <TableContainer
                        component={Paper}
                        elevation={0}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 4 }}
                    >
                        <Table>
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
                                                <Tooltip title={copied === app.clientId ? 'Copied!' : 'Copy Client ID'}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopy(app.clientId, app.clientId)}
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
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => toggleSecretVisibility(app.id)}
                                                    >
                                                        {visibleSecrets[app.id] ? (
                                                            <VisibilityOff fontSize="small" />
                                                        ) : (
                                                            <Visibility fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('common.delete')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setDeleteTarget(app)}
                                                        sx={{ color: 'error.main' }}
                                                    >
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                            {visibleSecrets[app.id] && (
                                                <Box
                                                    sx={{
                                                        mt: 1,
                                                        p: 1,
                                                        bgcolor: 'action.hover',
                                                        borderRadius: 1,
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        fontFamily="monospace"
                                                        sx={{ wordBreak: 'break-all', fontSize: 11 }}
                                                    >
                                                        {app.clientSecret}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopy(app.clientSecret, 'secret')}
                                                        sx={{ ml: 0.5 }}
                                                    >
                                                        <ContentCopy sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                    {copied === 'secret' && (
                                                        <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
                                                            Copied!
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
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
                            p: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            mt: 2,
                        }}
                    >
                        <Typography variant="h5" fontWeight={700} gutterBottom>
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
                                    p: 2,
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    fontSize: 13,
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre',
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(scriptSnippet, 'script')}
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
                                    Copied to clipboard!
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
                                    p: 2,
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    fontSize: 13,
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre',
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(callbackSnippet, 'callback')}
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
                                    Copied to clipboard!
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
                                        Client ID
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
                                        <Tooltip title={copied === 'cred-id' ? 'Copied!' : 'Copy'}>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleCopy(credentialsApp.clientId, 'cred-id')
                                                }
                                            >
                                                <ContentCopy sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>

                                {/* Client Secret */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Client Secret
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
                                        <Tooltip title={copied === 'cred-secret' ? 'Copied!' : 'Copy'}>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleCopy(credentialsApp.clientSecret, 'cred-secret')
                                                }
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
                        <Button variant="contained" color="error" onClick={handleDelete}>
                            {t('common.delete')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </PageTransition>
    )
}
