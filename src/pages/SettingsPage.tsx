import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Alert,
    Avatar,
    Box,
    Button,
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
    Typography,
} from '@mui/material'
import { Face, Language, Notifications, Palette, Person, PhonelinkLock, Save, Security } from '@mui/icons-material'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useSettings } from '@features/settings/hooks/useSettings'
import { useTranslation } from 'react-i18next'
import TotpEnrollment from '@features/auth/components/TotpEnrollment'
import FaceEnrollmentFlow from '@features/auth/components/FaceEnrollmentFlow'
import { getBiometricService } from '@core/services/BiometricService'

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

    // Profile settings
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')

    // Notification settings
    const [emailNotifications, setEmailNotifications] = useState(true)
    const [loginAlerts, setLoginAlerts] = useState(true)
    const [weeklyReports, setWeeklyReports] = useState(false)
    const [securityAlerts, setSecurityAlerts] = useState(true)

    // Security settings
    const [twoFactorAuth, setTwoFactorAuth] = useState(false)
    const [sessionTimeout, setSessionTimeout] = useState('30')

    // Appearance settings
    const [darkMode, setDarkMode] = useState(false)
    const [compactView, setCompactView] = useState(false)

    // TOTP enrollment dialog
    const [totpDialogOpen, setTotpDialogOpen] = useState(false)

    // Face ID enrollment
    const [faceEnrollOpen, setFaceEnrollOpen] = useState(false)
    const [faceEnrolled, setFaceEnrolled] = useState(false)
    const [faceEnrolling, setFaceEnrolling] = useState(false)

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
            setEmailNotifications(settings.emailNotifications)
            setLoginAlerts(settings.loginAlerts)
            setSecurityAlerts(settings.securityAlerts)
            setWeeklyReports(settings.weeklyReports)
            setTwoFactorAuth(settings.twoFactorEnabled)
            setSessionTimeout(String(settings.sessionTimeoutMinutes))
            setDarkMode(settings.darkMode)
            setCompactView(settings.compactView)
        }
    }, [settings, user])

    const handleSaveProfile = useCallback(async () => {
        try {
            setSaving('profile')
            await updateProfile({ firstName, lastName })
            showSuccessMessage('profile')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [firstName, lastName, updateProfile, showSuccessMessage])

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
        if (twoFactorAuth !== settings?.twoFactorEnabled || timeout !== settings?.sessionTimeoutMinutes) {
            const confirmed = window.confirm(t('settings.securityWarning'))
            if (!confirmed) return
        }

        try {
            setSaving('security')
            await updateSecurity({
                twoFactorEnabled: twoFactorAuth,
                sessionTimeoutMinutes: timeout,
            })
            showSuccessMessage('security')
        } catch {
            // Error handled by hook
        } finally {
            setSaving(null)
        }
    }, [twoFactorAuth, sessionTimeout, settings, updateSecurity, showSuccessMessage])

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
                            <Button variant="outlined" size="small">
                                {t('settings.changeAvatar')}
                            </Button>
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
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={twoFactorAuth}
                                        onChange={(e) => setTwoFactorAuth(e.target.checked)}
                                        disabled={saving === 'security'}
                                    />
                                }
                                label={t('settings.twoFactor')}
                            />
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                {t('settings.twoFactorHelper')}
                            </Typography>
                        </Box>

                        {!twoFactorAuth && (
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<PhonelinkLock />}
                                onClick={() => setTotpDialogOpen(true)}
                                sx={{ mb: 2 }}
                            >
                                {t('settings.setupTotp')}
                            </Button>
                        )}

                        <Divider sx={{ my: 2 }} />

                        {/* Face ID Enrollment */}
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Face sx={{ mr: 1, color: faceEnrolled ? 'success.main' : 'text.secondary', fontSize: 20 }} />
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Face ID
                                </Typography>
                                {faceEnrolled && (
                                    <Typography variant="caption" sx={{ ml: 1, color: 'success.main', fontWeight: 600 }}>
                                        Enrolled
                                    </Typography>
                                )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                Register your face for biometric login. Uses the camera to capture multiple angles.
                            </Typography>
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={faceEnrolling ? <CircularProgress size={16} /> : <Face />}
                                onClick={() => setFaceEnrollOpen(true)}
                                disabled={faceEnrolling}
                                color={faceEnrolled ? 'success' : 'primary'}
                            >
                                {faceEnrolled ? 'Re-enroll Face ID' : 'Enroll Face ID'}
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

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={weeklyReports}
                                        onChange={(e) => setWeeklyReports(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label={t('settings.weeklyReports')}
                            />
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
                                            checked={darkMode}
                                            onChange={(e) => setDarkMode(e.target.checked)}
                                            disabled={saving === 'appearance'}
                                        />
                                    }
                                    label={t('settings.darkMode')}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                    {t('settings.darkModeHelper')}
                                </Typography>
                            </Grid>

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
                onClose={() => setTotpDialogOpen(false)}
                onSuccess={() => {
                    setTotpDialogOpen(false)
                    setTwoFactorAuth(true)
                }}
            />

            {/* Face ID Enrollment Dialog */}
            <FaceEnrollmentFlow
                open={faceEnrollOpen}
                onClose={() => setFaceEnrollOpen(false)}
                onComplete={async (images) => {
                    if (!user?.id) return
                    setFaceEnrolling(true)
                    try {
                        const biometric = getBiometricService()
                        // Enroll with the best (frontal) capture
                        await biometric.enrollFace(user.id, images[1] || images[0])
                        setFaceEnrolled(true)
                        showSuccessMessage('faceId')
                    } catch {
                        // Enrollment failed silently — user can retry
                    } finally {
                        setFaceEnrolling(false)
                    }
                }}
            />
        </Box>
    )
}
