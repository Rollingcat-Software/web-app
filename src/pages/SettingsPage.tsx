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
    Grid,
    Paper,
    TextField,
    Typography,
} from '@mui/material'
import {
    Fingerprint,
    Key,
    Language,
    Person,
    PhonelinkLock,
    Save,
    Security,
    Lock,
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
        updateSecurity,
        changePassword,
        validatePassword,
    } = useSettings()

    // Profile settings — pre-populated from auth context so names show even before settings load
    const [firstName, setFirstName] = useState(user?.firstName || '')
    const [lastName, setLastName] = useState(user?.lastName || '')
    const [phoneNumber, setPhoneNumber] = useState('')

    // NOTE (2026-04-24 trim): notification toggles (email / login alerts /
    // weekly reports / security alerts) and appearance toggles (dark mode /
    // compact view) were removed from this page — the backend had no
    // storage wired for them and the compact-view switch wasn't hooked up.
    // Dark mode lives in the top bar; language is still configurable below.
    // Re-introduce here when the backend endpoints land.

    // Security settings
    const [tenantRequires2FA, setTenantRequires2FA] = useState(false)
    const [sessionTimeout, setSessionTimeout] = useState('30')

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
            setPhoneNumber(settings.phoneNumber || user?.phoneNumber || '')
            setSessionTimeout(String(settings.sessionTimeoutMinutes))
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

    const handleSaveSecurity = useCallback(async () => {
        const timeout = parseInt(sessionTimeout, 10)
        if (timeout !== settings?.sessionTimeoutMinutes) {
            const confirmed = window.confirm(t('settings.securityWarning'))
            if (!confirmed) return
        }

        try {
            setSaving('security')
            await updateSecurity({
                sessionTimeoutMinutes: timeout,
            })
            showSuccessMessage('security')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [sessionTimeout, settings, updateSecurity, showSuccessMessage, t])

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
    }, [newPassword, confirmPassword, currentPassword, changePassword, validatePassword, showSuccessMessage, t])

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
                                    label={t('settings.phoneNumber')}
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    disabled={saving === 'profile'}
                                    placeholder="+905xxxxxxxxx"
                                    helperText={t('settings.phoneHelper')}
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

                        {/*
                          * 2FA status chip — only renders when the tenant actively
                          * requires 2FA (Rule: the user's ask 2026-04-24 "when no
                          * MFA enrolled: hide the whole section — it says 'not
                          * required', that's noise"). The enrollment buttons
                          * below are always shown so users can still opt in.
                          */}
                        {tenantRequires2FA && (
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                    <Lock sx={{ color: 'success.main', fontSize: 20 }} />
                                    <Typography variant="subtitle1" fontWeight={600} sx={{ mr: 'auto' }}>
                                        {t('settings.twoFactor')}
                                    </Typography>
                                </Box>
                                <Chip
                                    label={t('settings.twoFactorRequired')}
                                    color="success"
                                    size="small"
                                    variant="outlined"
                                    sx={{ ml: 4, mb: 1 }}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                    {t('settings.twoFactorHelper')}
                                </Typography>
                            </Box>
                        )}

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
                                {t('settings.registerPasskey')}
                            </Button>
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<Key />}
                                onClick={() => setHardwareKeyDialogOpen(true)}
                                disabled={!user?.id}
                            >
                                {t('settings.registerHardwareKey')}
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
                            <option value="15">{t('settings.sessionTimeout15')}</option>
                            <option value="30">{t('settings.sessionTimeout30')}</option>
                            <option value="60">{t('settings.sessionTimeout60')}</option>
                            <option value="120">{t('settings.sessionTimeout120')}</option>
                            <option value="480">{t('settings.sessionTimeout480')}</option>
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

                {/*
                 * Removed 2026-04-24:
                 *   - Notifications panel (email / login alerts / security
                 *     alerts / weekly reports): no backend persistence wired.
                 *   - Appearance panel > Compact View switch: not hooked up.
                 *   - Appearance panel header + dark-mode: dark mode lives in
                 *     the TopBar; remove the redundant panel to keep Settings
                 *     focused on Profile + Security + Sessions + Language.
                 * Re-introduce when the backend endpoints land.
                 */}

                {/* Active Sessions */}
                <Grid item xs={12}>
                    <SessionsSection />
                </Grid>

                {/* Language selector */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
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
