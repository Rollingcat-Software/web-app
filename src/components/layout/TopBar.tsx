import {useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
    alpha,
    AppBar,
    Avatar,
    Box,
    Chip,
    Divider,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Toolbar,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material'
import {DarkMode, Language, LightMode, Logout, Menu as MenuIcon, Settings,} from '@mui/icons-material'
import {useAuth} from '@features/auth/hooks/useAuth'
import {useThemeMode} from '@app/providers/ThemeModeProvider'
import {useTranslation} from 'react-i18next'
import NotificationPanel from '@components/NotificationPanel'

interface TopBarProps {
    drawerWidth: number
    onMenuClick: () => void
}

export default function TopBar({drawerWidth, onMenuClick}: TopBarProps) {
    const theme = useTheme()
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const { mode, toggleMode } = useThemeMode()
    const { t, i18n } = useTranslation()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const isDark = theme.palette.mode === 'dark'

    const toggleLanguage = () => {
        const newLang = i18n.language === 'tr' ? 'en' : 'tr'
        i18n.changeLanguage(newLang)
    }

    // PRESERVED: path → translated title mapping (unchanged keys)
    const getPageTitle = () => {
        const path = location.pathname
        if (path === '/') return t('nav.dashboard')
        if (path.startsWith('/users')) return t('nav.users')
        if (path.startsWith('/tenants')) return t('nav.tenants')
        if (path.startsWith('/roles')) return t('nav.roles')
        if (path.startsWith('/enrollments')) return t('nav.enrollments')
        if (path.startsWith('/audit-logs')) return t('nav.auditLogs')
        if (path.startsWith('/analytics')) return t('nav.analytics')
        if (path.startsWith('/settings')) return t('nav.settings')
        if (path.startsWith('/my-profile')) return t('nav.myProfile')
        if (path.startsWith('/enrollment')) return t('nav.userEnrollment')
        if (path.startsWith('/auth-flows')) return t('nav.authFlows')
        if (path.startsWith('/auth-sessions')) return t('nav.authSessions')
        if (path.startsWith('/devices')) return t('nav.devices')
        if (path.startsWith('/verification')) return t('nav.verificationFlows')
        if (path.startsWith('/widget-demo')) return t('nav.widgetDemo')
        if (path.startsWith('/developer-portal')) return t('nav.developerPortal')
        if (path.startsWith('/biometric-tools')) return t('nav.biometricTools')
        return t('nav.dashboard')
    }

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const handleSettings = () => {
        handleClose()
        navigate('/settings')
    }

    const userInitial = (user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()

    return (
        <AppBar
            position="fixed"
            sx={{
                width: {md: `calc(100% - ${drawerWidth}px)`},
                ml: {md: `${drawerWidth}px`},
                backgroundColor: isDark ? alpha('#0f1220', 0.72) : 'rgba(255, 255, 255, 0.75)',
                color: 'text.primary',
            }}
        >
            <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, gap: 1 }}>
                {/* Mobile menu button */}
                <IconButton
                    color="inherit"
                    aria-label="Open navigation menu"
                    edge="start"
                    onClick={onMenuClick}
                    sx={{ mr: 1, display: {md: 'none'} }}
                >
                    <MenuIcon/>
                </IconButton>

                {/* Page title block */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                        variant="h6"
                        component="div"
                        noWrap
                        sx={{
                            fontFamily: '"Poppins", sans-serif',
                            fontWeight: 600,
                            letterSpacing: '-0.015em',
                            lineHeight: 1.2,
                            fontSize: { xs: '1rem', sm: '1.125rem' },
                        }}
                    >
                        {getPageTitle()}
                    </Typography>
                </Box>

                {/* Right cluster */}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                    {/* Language toggle */}
                    <Tooltip title={t('settings.language')}>
                        <IconButton
                            color="inherit"
                            onClick={toggleLanguage}
                            aria-label="Toggle language"
                            sx={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                width: 40,
                                height: 40,
                                gap: 0.3,
                            }}
                        >
                            <Language sx={{ fontSize: 18 }} />
                            <Typography
                                variant="caption"
                                fontWeight={700}
                                sx={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
                            >
                                {i18n.language === 'tr' ? 'TR' : 'EN'}
                            </Typography>
                        </IconButton>
                    </Tooltip>

                    {/* Dark mode toggle */}
                    <Tooltip title={mode === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}>
                        <IconButton color="inherit" onClick={toggleMode} aria-label="Toggle dark mode">
                            {mode === 'dark' ? <LightMode/> : <DarkMode/>}
                        </IconButton>
                    </Tooltip>

                    {/* Notifications */}
                    <NotificationPanel />

                    <Divider
                        orientation="vertical"
                        flexItem
                        sx={{ mx: 1, my: 1.5, display: { xs: 'none', sm: 'block' } }}
                    />

                    {/* User menu */}
                    <IconButton
                        onClick={handleMenu}
                        sx={{
                            p: 0.5,
                            ml: 0.5,
                            position: 'relative',
                            '&:hover .avatar-ring': {
                                opacity: 1,
                                transform: 'scale(1)',
                            },
                        }}
                        aria-label={t('topbar.userMenu')}
                        aria-haspopup="true"
                    >
                        <Box
                            className="avatar-ring"
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                padding: '2px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                opacity: anchorEl ? 1 : 0,
                                transform: anchorEl ? 'scale(1)' : 'scale(0.9)',
                                transition: 'opacity .2s, transform .2s',
                                pointerEvents: 'none',
                                mask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
                                WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
                                maskComposite: 'exclude',
                                WebkitMaskComposite: 'xor',
                            }}
                        />
                        <Avatar
                            sx={{
                                width: 36,
                                height: 36,
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 4px 12px -4px rgba(99,102,241,0.45)',
                            }}
                        >
                            {userInitial}
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                        transformOrigin={{horizontal: 'right', vertical: 'top'}}
                        anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
                        PaperProps={{ sx: { minWidth: 260 } }}
                    >
                        <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1.25, alignItems: 'center' }}>
                            <Avatar
                                sx={{
                                    width: 40,
                                    height: 40,
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    fontWeight: 700,
                                }}
                            >
                                {userInitial}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                <Typography variant="subtitle2" fontWeight={700} noWrap>
                                    {user?.firstName} {user?.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                    {user?.email}
                                </Typography>
                                {user?.role && (
                                    <Chip
                                        label={user.role}
                                        size="small"
                                        sx={{
                                            mt: 0.5,
                                            height: 20,
                                            fontSize: '0.64rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.04em',
                                            backgroundColor: alpha('#6366f1', isDark ? 0.18 : 0.1),
                                            color: isDark ? '#a5b4fc' : '#4338ca',
                                            borderRadius: '5px',
                                            '& .MuiChip-label': { px: 0.9 },
                                        }}
                                    />
                                )}
                            </Box>
                        </Box>
                        <Divider sx={{ my: 0.5 }} />
                        <MenuItem onClick={handleSettings}>
                            <ListItemIcon>
                                <Settings fontSize="small"/>
                            </ListItemIcon>
                            {t('nav.settings')}
                        </MenuItem>
                        <Divider sx={{ my: 0.5 }} />
                        <MenuItem onClick={() => { handleClose(); handleLogout() }}>
                            <ListItemIcon>
                                <Logout fontSize="small" color="error"/>
                            </ListItemIcon>
                            <Typography color="error" fontWeight={600}>{t('topbar.logout')}</Typography>
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    )
}
