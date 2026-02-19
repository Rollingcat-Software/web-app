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
import { Notifications, Palette, Person, Save, Security } from '@mui/icons-material'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useSettings } from '@features/settings/hooks/useSettings'

export default function SettingsPage() {
    const { user } = useAuth()
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
            const confirmed = window.confirm(
                'You are about to change security settings. This may affect your current session. Continue?'
            )
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
            setPasswordErrors(['Passwords do not match'])
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
                Settings
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Manage your account preferences and settings
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {saveSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                    {saveSuccess === 'password'
                        ? 'Password changed successfully!'
                        : `${saveSuccess.charAt(0).toUpperCase() + saveSuccess.slice(1)} settings saved successfully!`}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Profile Settings */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Person sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                                Profile Information
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
                                Change Avatar
                            </Button>
                        </Box>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="First Name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    disabled={saving === 'profile'}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Last Name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    disabled={saving === 'profile'}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Email"
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    helperText="Email cannot be changed"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Role"
                                    value={user?.role || ''}
                                    disabled
                                    helperText="Role is managed by administrators"
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
                                Save Profile
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
                                Security
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
                                label="Enable Two-Factor Authentication"
                            />
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                Add an extra layer of security to your account
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <TextField
                            fullWidth
                            select
                            label="Session Timeout"
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
                            Change Password
                        </Button>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                startIcon={saving === 'security' ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveSecurity}
                                disabled={saving === 'security'}
                            >
                                Save Security
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
                                Notifications
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
                                label="Email Notifications"
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={loginAlerts}
                                        onChange={(e) => setLoginAlerts(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label="Login Alerts"
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={securityAlerts}
                                        onChange={(e) => setSecurityAlerts(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label="Security Alerts"
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={weeklyReports}
                                        onChange={(e) => setWeeklyReports(e.target.checked)}
                                        disabled={saving === 'notifications'}
                                    />
                                }
                                label="Weekly Reports"
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
                                Save Notifications
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
                                Appearance
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
                                    label="Dark Mode"
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                    Use dark theme for reduced eye strain
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
                                    label="Compact View"
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                                    Show more content with reduced spacing
                                </Typography>
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                startIcon={saving === 'appearance' ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveAppearance}
                                disabled={saving === 'appearance'}
                            >
                                Save Appearance
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
                <DialogTitle>Change Password</DialogTitle>
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
                        label="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        margin="normal"
                        disabled={saving === 'password'}
                    />
                    <TextField
                        fullWidth
                        type="password"
                        label="New Password"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value)
                            setPasswordErrors([])
                        }}
                        margin="normal"
                        disabled={saving === 'password'}
                        helperText="Min 8 chars, uppercase, lowercase, number, special character"
                    />
                    <TextField
                        fullWidth
                        type="password"
                        label="Confirm New Password"
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
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handlePasswordChange}
                        disabled={saving === 'password' || !currentPassword || !newPassword || !confirmPassword}
                        startIcon={saving === 'password' ? <CircularProgress size={16} /> : null}
                    >
                        Change Password
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
