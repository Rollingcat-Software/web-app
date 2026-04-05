import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    Paper,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Fingerprint,
    Key,
    Language,
    Notifications,
    Palette,
    Person,
    PhonelinkLock,
    Save,
    Security,
    Lock,
    LockOpen,
} from '@mui/icons-material'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useSettings } from '@features/settings/hooks/useSettings'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import { container } from '@core/di/container'
import type { AuthFlowRepository, AuthFlowResponse } from '@core/repositories/AuthFlowRepository'
import TotpEnrollment from '@features/auth/components/TotpEnrollment'
import WebAuthnEnrollment from '@features/auth/components/WebAuthnEnrollment'
import SessionsSection from '@features/settings/components/SessionsSection'

export default function SettingsPage() {
    const { user } = useAuth()
    const { t, i18n } = useTranslation()
    const {
        settings,
        loading,
        error,
        updateProfile,
        updateNotifications,
        updateSecurity,
        updateAppearance,
        changePassword,
        validatePassword,
    } = useSettings()

    // Profile settings — pre-populated from auth context so names show even before settings load
    const [firstName, setFirstName] = useState(user?.firstName || '')
    const [lastName, setLastName] = useState(user?.lastName || '')
    const [phoneNumber, setPhoneNumber] = useState('')

    // Notification settings
    const [emailNotifications, setEmailNotifications] = useState(true)
    const [loginAlerts, setLoginAlerts] = useState(true)
    const [weeklyReports, setWeeklyReports] = useState(false)
    const [securityAlerts, setSecurityAlerts] = useState(true)

    // Security settings
    const [tenantRequires2FA, setTenantRequires2FA] = useState(false)
    const [sessionTimeout, setSessionTimeout] = useState('30')

    // Appearance settings
    const [darkMode, setDarkMode] = useState(false)
    const [compactView, setCompactView] = useState(false)

    // Fetch 2FA status from the user-accessible endpoint (no admin permission needed)
    const httpClient = useService<import('@domain/interfaces/IHttpClient').IHttpClient>(TYPES.HttpClient)
    useEffect(() => {
        httpClient.get<{ twoFactorRequired: boolean; flowName: string; stepCount: number }>('/auth/my/2fa-status')
            .then((response) => {
                setTenantRequires2FA(response.data.twoFactorRequired)
            })
            .catch(() => {
                // Fallback: try admin endpoint for admin users
                if (!user?.tenantId) return
                const authFlowRepo = container.get<AuthFlowRepository>(TYPES.AuthFlowRepository)
                authFlowRepo.listFlows(user.tenantId, 'APP_LOGIN')
                    .then((flows: AuthFlowResponse[]) => {
                        const defaultActive = flows.find(f => f.isDefault && f.isActive)
                        setTenantRequires2FA(defaultActive ? defaultActive.stepCount > 1 : false)
                    })
                    .catch(() => {
                        setTenantRequires2FA(false)
                    })
            })
    }, [httpClient, user?.tenantId])

    // TOTP enrollment dialog
    const [totpDialogOpen, setTotpDialogOpen] = useState(false)
    const [platformWebAuthnDialogOpen, setPlatformWebAuthnDialogOpen] = useState(false)
    const [hardwareKeyDialogOpen, setHardwareKeyDialogOpen] = useState(false)

    // Password change dialog
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordErrors, setPasswordErrors] = useState<string[]>([])

    // Save states
    const [saving, setSaving] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
    const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clear success timer on unmount to prevent state updates after unmount
    useEffect(() => {
        return () => {
            if (successTimerRef.current) {
                clearTimeout(successTimerRef.current)
            }
        }
    }, [])

    const showSuccessMessage = useCallback((section: string) => {
        setSaveSuccess(section)
        if (successTimerRef.current) {
            clearTimeout(successTimerRef.current)
        }
        successTimerRef.current = setTimeout(() => setSaveSuccess(null), 3000)
    }, [])

    // Sync local state with settings from API
    useEffect(() => {
        if (settings) {
            setFirstName(settings.firstName || user?.firstName || '')
            setLastName(settings.lastName || user?.lastName || '')
            setPhoneNumber(settings.phoneNumber || '')
            setEmailNotifications(settings.emailNotifications)
            setLoginAlerts(settings.loginAlerts)
            setSecurityAlerts(settings.securityAlerts)
            setWeeklyReports(settings.weeklyReports)
            setSessionTimeout(String(settings.sessionTimeoutMinutes))
            setDarkMode(settings.darkMode)
            setCompactView(settings.compactView)
        }
    }, [settings, user])

    const handleSaveProfile = useCallback(async () => {
        try {
            setSaving('profile')
            await updateProfile({ firstName, lastName, phoneNumber: phoneNumber || undefined })
            showSuccessMessage('profile')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [firstName, lastName, phoneNumber, updateProfile, showSuccessMessage])

    const handleSaveNotifications = useCallback(async () => {
        try {
            setSaving('notifications')
            await updateNotifications({
                emailNotifications,
                loginAlerts,
                weeklyReports,
                securityAlerts,
            })
            showSuccessMessage('notifications')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [emailNotifications, loginAlerts, weeklyReports, securityAlerts, updateNotifications, showSuccessMessage])

    const handleSaveSecurity = useCallback(async () => {
        const timeout = parseInt(sessionTimeout, 10)
        if (timeout !== settings?.sessionTimeoutMinutes) {
            const confirmed = window.confirm(t('settings.securityWarning'))
            if (!confirmed) return
        }

        try {
            setSaving('security')
            await updateSecurity({
                twoFactorEnabled: tenantRequires2FA,
                sessionTimeoutMinutes: timeout,
            })
            showSuccessMessage('security')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [tenantRequires2FA, sessionTimeout, settings, updateSecurity, showSuccessMessage, t])

    const handleSaveAppearance = useCallback(async () => {
        try {
            setSaving('appearance')
            await updateAppearance({ darkMode, compactView })
            showSuccessMessage('appearance')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [darkMode, compactView, updateAppearance, showSuccessMessage])

    const handlePasswordChange = useCallback(async () => {
        // Validate new password
        const validation = validatePassword(newPassword)
        if (!validation.valid) {
            setPasswordErrors(validation.errors)
            return
        }

        if (newPassword !== confirmPassword) {
            setPasswordErrors([t('settings.passwordsNoMatch')])
            return
        }

        try {
            setSaving('password')
            await changePassword({
                currentPassword,
                newPassword,
                confirmPassword,
            })
            setPasswordDialogOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setPasswordErrors([])
            showSuccessMessage('password')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [newPassword, confirmPassword, currentPassword, changePassword, validatePassword, showSuccessMessage])

    if (loading && !settings) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight={600}>
                {t('settings.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('settings.subtitle')}
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {saveSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                    {saveSuccess === 'password'
                        ? t('settings.passwordChanged')
                        : t('settings.settingsSaved', { section: saveSuccess.charAt(0).toUpperCase() + saveSuccess.slice(1) })}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Profile Settings */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Person sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                                {t('settings.profile')}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Avatar
                                sx={{
                                    width: 80,
                                    height: 80,
                                    mr: 3,
                                    bgcolor: 'primary.main',
                                    fontSize: '2rem',
                                }}
                            >
                                {firstName?.[0]}
                                {lastName?.[0]}
                            </Avatar>
                            <Tooltip title={t('settings.comingSoon')} arrow>
                                <span>
                                    <Button variant="outlined" size="small" disabled>
                                        {t('settings.changeAvatar')}
                                    </Button>
                                </span>
                            </Tooltip>
                        </Box>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label={t('settings.firstName')}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    disabled={saving === 'profile'}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label={t('settings.lastName')}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    disabled={saving === 'profile'}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Phone Number / Telefon Numaras\u0131"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    disabled={saving === 'profile'}
                                    placeholder="+905xxxxxxxxx"
                                    helperText="Required for SMS OTP verification"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={t('settings.email')}
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    helperText={t('settings.emailHelper')}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={t('settings.role')}
                                    value={user?.role || ''}
                                    disabled
                                    helperText={t('settings.roleHelper')}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                startIcon={saving === 'profile' ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveProfile}
                                disabled={saving === 'profile'}
                            >
                                {t('settings.saveProfile')}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Security Settings */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Security sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                                {t('settings.security')}
                            </Typography>
                        </Box>

                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                {tenantRequires2FA ? (
                                    <Lock sx={{ color: 'success.main', fontSize: 20 }} />
                                ) : (
                                    <LockOpen sx={{ color: 'text.secondary', fontSize: 20 }} />
                                )}
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mr: 'auto' }}>
                                    {t('settings.twoFactor')}
                                </Typography>
                            </Box>
                            <Chip
                                label={tenantRequires2FA
                                    ? t('settings.twoFactorRequired')
                                    : t('settings.twoFactorNotRequired')}
                                color={tenantRequires2FA ? 'success' : 'default'}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 4, mb: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                {t('settings.twoFactorHelper')}
                            </Typography>
                        </Box>

                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<PhonelinkLock />}
                            onClick={() => setTotpDialogOpen(true)}
                            disabled={!user?.id}
                            sx={{ mb: 2 }}
                        >
                            {t('settings.setupTotp')}
                        </Button>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<Fingerprint />}
                                onClick={() => setPlatformWebAuthnDialogOpen(true)}
                                disabled={!user?.id}
                            >
                                Register Device Biometric (Passkey)
                            </Button>
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<Key />}
                                onClick={() => setHardwareKeyDialogOpen(true)}
                                disabled={!user?.id}
                            >
                                Register Hardware Security Key
                            </Button>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <TextField
                            fullWidth
                            select
                            label={t('settings.sessionTimeout')}
                            value={sessionTimeout}
                            onChange={(e) => setSessionTimeout(e.target.value)}
                            SelectProps={{ native: true }}
                            sx={{ mb: 2 }}
                            disabled={saving === 'security'}
                        >
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="60">1 hour</option>
                            <option value="120">2 hours</option>
                            <option value="480">8 hours</option>
                        </TextField>

                        <Divider sx={{ my: 2 }} />

                        <Button
                            variant="outlined"
                            fullWidth
                            sx={{ mb: 1 }}
                            onClick={() => setPasswordDialogOpen(true)}
                        >
                            {t('settings.changePassword')}
                        </Button>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                startIcon={saving === 'security' ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveSecurity}
                                disabled={saving === 'security'}
                            >
                                {t('settings.saveSecurity')}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Notification Settings */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Notifications sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                                {t('settings.notifications')}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={emailNotifications}
                                        onChange={(e) => setEmailNotifications(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label={t('settings.emailNotifications')}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={loginAlerts}
                                        onChange={(e) => setLoginAlerts(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label={t('settings.loginAlerts')}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={securityAlerts}
                                        onChange={(e) => setSecurityAlerts(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label={t('settings.securityAlerts')}
                            />

                            <Tooltip title={t('settings.comingSoon')} arrow>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={false}
                                            disabled
                                        />
                                    }
                                    label={`${t('settings.weeklyReports')} (${t('settings.comingSoon')})`}
                                />
                            </Tooltip>
                        </Box>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                startIcon={
                                    saving === 'notifications' ? <CircularProgress size={16} /> : <Save />
                                }
                                onClick={handleSaveNotifications}
                                disabled={saving === 'notifications'}
                            >
                                {t('settings.saveNotifications')}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Active Sessions */}
                <Grid item xs={12}>
                    <SessionsSection />
                </Grid>

                {/* Appearance Settings */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Palette sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                                {t('settings.appearance')}
                            </Typography>
                        </Box>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={compactView}
                                            onChange={(e) => setCompactView(e.target.checked)}
                                            disabled={saving === 'appearance'}
                                        />
                                    }
                                    label={t('settings.compactView')}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                    {t('settings.compactViewHelper')}
                                </Typography>
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 3 }} />

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Language sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                                {t('settings.language')}
                            </Typography>
                        </Box>

                        <TextField
                            fullWidth
                            select
                            label={t('settings.language')}
                            value={i18n.language.startsWith('tr') ? 'tr' : 'en'}
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                            SelectProps={{ native: true }}
                            helperText={t('settings.languageHelper')}
                            sx={{ maxWidth: 300 }}
                        >
                            <option value="en">{t('language.en')}</option>
                            <option value="tr">{t('language.tr')}</option>
                        </TextField>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                startIcon={saving === 'appearance' ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveAppearance}
                                disabled={saving === 'appearance'}
                            >
                                {t('settings.saveAppearance')}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Password Change Dialog */}
            <Dialog open={passwordDialogOpen} onClose={() => {
                setPasswordDialogOpen(false)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
                setPasswordErrors([])
            }} maxWidth="sm" fullWidth>
                <DialogTitle>{t('settings.changePassword')}</DialogTitle>
                <DialogContent>
                    {passwordErrors.length > 0 && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {passwordErrors.map((err, i) => (
                                <div key={i}>{err}</div>
                            ))}
                        </Alert>
                    )}
                    <TextField
                        fullWidth
                        type="password"
                        label={t('settings.currentPassword')}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        margin="normal"
                        disabled={saving === 'password'}
                    />
                    <TextField
                        fullWidth
                        type="password"
                        label={t('settings.newPassword')}
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value)
                            setPasswordErrors([])
                        }}
                        margin="normal"
                        disabled={saving === 'password'}
                        helperText={t('settings.passwordHelper')}
                    />
                    <TextField
                        fullWidth
                        type="password"
                        label={t('settings.confirmPassword')}
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value)
                            setPasswordErrors([])
                        }}
                        margin="normal"
                        disabled={saving === 'password'}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPasswordDialogOpen(false)} disabled={saving === 'password'}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handlePasswordChange}
                        disabled={saving === 'password' || !currentPassword || !newPassword || !confirmPassword}
                        startIcon={saving === 'password' ? <CircularProgress size={16} /> : null}
                    >
                        {t('settings.changePassword')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* TOTP Enrollment Dialog */}
            <TotpEnrollment
                open={totpDialogOpen}
                userId={user?.id ?? ''}
                onClose={() => setTotpDialogOpen(false)}
                onSuccess={() => {
                    setTotpDialogOpen(false)
                    showSuccessMessage('security')
                }}
            />

            <WebAuthnEnrollment
                open={platformWebAuthnDialogOpen}
                userId={user?.id ?? ''}
                mode="platform"
                onClose={() => setPlatformWebAuthnDialogOpen(false)}
                onSuccess={() => {
                    setPlatformWebAuthnDialogOpen(false)
                    showSuccessMessage('security')
                }}
            />

            <WebAuthnEnrollment
                open={hardwareKeyDialogOpen}
                userId={user?.id ?? ''}
                mode="hardware-key"
                onClose={() => setHardwareKeyDialogOpen(false)}
                onSuccess={() => {
                    setHardwareKeyDialogOpen(false)
                    showSuccessMessage('security')
                }}
            />

        </Box>
    )
}
