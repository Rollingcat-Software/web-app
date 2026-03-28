import {useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
    AppBar,
    Avatar,
    Box,
    Divider,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Toolbar,
    Tooltip,
    Typography,
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
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const { mode, toggleMode } = useThemeMode()
    const { t, i18n } = useTranslation()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    const toggleLanguage = () => {
        const newLang = i18n.language === 'tr' ? 'en' : 'tr'
        i18n.changeLanguage(newLang)
    }

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

    return (
        <AppBar
            position="fixed"
            sx={{
                width: {md: `calc(100% - ${drawerWidth}px)`},
                ml: {md: `${drawerWidth}px`},
                backgroundColor: 'background.paper',
                color: 'text.primary',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}
        >
            <Toolbar>
                {/* Mobile menu button */}
                <IconButton
                    color="inherit"
                    aria-label="Open navigation menu"
                    edge="start"
                    onClick={onMenuClick}
                    sx={{mr: 2, display: {md: 'none'}}}
                >
                    <MenuIcon/>
                </IconButton>

                {/* Page title */}
                <Typography variant="h6" noWrap component="div" sx={{flexGrow: 1}}>
                    {getPageTitle()}
                </Typography>

                {/* Right side icons */}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    {/* Language toggle */}
                    <Tooltip title={t('settings.language')}>
                        <IconButton
                            color="inherit"
                            onClick={toggleLanguage}
                            aria-label="Toggle language"
                            sx={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                width: 36,
                                height: 36,
                            }}
                        >
                            <Language sx={{ fontSize: 20, mr: 0.3 }} />
                            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
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

                    {/* User menu */}
                    <IconButton
                        onClick={handleMenu}
                        sx={{p: 0.5}}
                        aria-label={t('topbar.userMenu')}
                        aria-haspopup="true"
                    >
                        <Avatar
                            sx={{width: 36, height: 36, bgcolor: 'primary.main'}}
                        >
                            {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                        transformOrigin={{horizontal: 'right', vertical: 'top'}}
                        anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
                    >
                        <Box sx={{px: 2, py: 1}}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {user?.firstName} {user?.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {user?.email}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {user?.role}
                            </Typography>
                        </Box>
                        <Divider/>
                        <MenuItem onClick={handleSettings}>
                            <ListItemIcon>
                                <Settings fontSize="small"/>
                            </ListItemIcon>
                            {t('nav.settings')}
                        </MenuItem>
                        <Divider/>
                        <MenuItem onClick={() => { handleClose(); handleLogout() }}>
                            <ListItemIcon>
                                <Logout fontSize="small" color="error"/>
                            </ListItemIcon>
                            <Typography color="error">{t('topbar.logout')}</Typography>
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    )
}
