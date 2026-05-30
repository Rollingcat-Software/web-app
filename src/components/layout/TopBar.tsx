import {useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
    alpha,
    AppBar,
    Avatar,
    Box,
    Chip,
    Divider,
    FormControl,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Select,
    Toolbar,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material'
import type {SelectChangeEvent} from '@mui/material'
import {AccessTime, Business, DarkMode, LightMode, Logout, Menu as MenuIcon, Settings,} from '@mui/icons-material'
import {useAuth} from '@features/auth/hooks/useAuth'
import {useThemeMode} from '@app/providers/ThemeModeContext'
import {useTranslation} from 'react-i18next'
import NotificationPanel from '@components/NotificationPanel'
import {useActiveTenant} from '@features/tenants/context/ActiveTenantContext'
import {useSessionCountdown} from '@features/auth/hooks/useSessionCountdown'
import AccountSwitcher from '@features/accountSwitcher/AccountSwitcher'

/**
 * Feature flag: the SUPER_ADMIN tenant switcher is hidden until the backend
 * cross-tenant scoping is unified (Hibernate tenantFilter / X-Tenant-ID +
 * currentScope) and covered by adversarial cross-tenant security tests.
 * Flip to true to re-enable. See TopBar switcher block (2026-05-29).
 */
const TENANT_SWITCHER_ENABLED = true

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
    const { t } = useTranslation()
    const { canSwitch, tenants, activeTenantId, activeTenantName, setActiveTenantId } = useActiveTenant()
    const { formatted: sessionRemaining, warning: sessionWarning } = useSessionCountdown()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const isDark = theme.palette.mode === 'dark'

    // "Who/where/how-long" context label: tenant name (falls back to the
    // active-tenant id, then a generic Platform label) plus the operator role.
    const contextScope = activeTenantName
        || (user?.isSuperAdmin() && !activeTenantName ? t('topbar.context.platform') : null)
        || user?.tenantName
        || null
    const contextRole = user?.role ?? null

    const handleTenantSwitch = (event: SelectChangeEvent) => {
        setActiveTenantId(event.target.value)
        // Reload so every already-fetched admin surface re-queries under the
        // new X-Active-Tenant scope (matches the app's per-page fetch model).
        window.location.reload()
    }

    // Language is driven globally by the shared <fivucsas-launcher> FAB
    // (public/launcher.js → `fivucsas:languagechange`), so the top bar no
    // longer carries its own EN/TR toggle. The per-user preference still lives
    // on the Settings page.

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
                    aria-label={t('a11y.openNavigationMenu')}
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
                    {/* Account / workspace switcher (Identity Phase 5). Changes WHO
                        you are — switches between a LINKED person's memberships via
                        POST /auth/switch-membership. Self-hides unless /identity/me
                        returns >1 membership. This is DISTINCT from the SUPER_ADMIN
                        tenant *data* switcher below ("Switch account" vs the tenant
                        view selector): that one keeps you the SAME user. */}
                    <AccountSwitcher />

                    {/* SUPER_ADMIN tenant switcher — TEMPORARILY HIDDEN (2026-05-29).
                        The backend cross-tenant scoping isn't unified yet (the Users
                        view scopes via the Hibernate tenantFilter / X-Tenant-ID, which
                        currently 403s for SUPER_ADMIN; X-Active-Tenant only covers the
                        currentScope() endpoints). Shipping a switcher that changes some
                        pages but not Users would be misleading + a cross-tenant risk.
                        Flip TENANT_SWITCHER_ENABLED to true once the unified backend fix
                        + adversarial cross-tenant security tests land. */}
                    {TENANT_SWITCHER_ENABLED && canSwitch && tenants.length > 0 && (
                        <Tooltip title={t('topbar.tenantSwitcher.tooltip')}>
                            <FormControl size="small" sx={{ minWidth: { xs: 116, sm: 150 }, mr: 0.5, display: 'block' }}>
                                <Select
                                    value={activeTenantId ?? ''}
                                    onChange={handleTenantSwitch}
                                    displayEmpty
                                    aria-label={t('topbar.tenantSwitcher.label')}
                                    startAdornment={<Business sx={{ fontSize: 18, mr: 0.75, color: 'primary.main' }} />}
                                    sx={{
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        '& .MuiSelect-select': { py: 0.75 },
                                        backgroundColor: alpha('#6366f1', isDark ? 0.14 : 0.07),
                                        borderRadius: '8px',
                                    }}
                                >
                                    {tenants.map((tnt) => (
                                        <MenuItem key={tnt.id} value={tnt.id} sx={{ fontSize: '0.85rem' }}>
                                            {tnt.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Tooltip>
                    )}

                    {/* Who/where context: tenant · role */}
                    {(contextScope || contextRole) && (
                        <Tooltip title={t('topbar.context.tooltip')}>
                            <Box
                                sx={{
                                    display: { xs: 'none', md: 'flex' },
                                    alignItems: 'center',
                                    gap: 0.75,
                                    px: 1.25,
                                    py: 0.5,
                                    mr: 0.5,
                                    borderRadius: '8px',
                                    backgroundColor: alpha(isDark ? '#fff' : '#000', 0.04),
                                    maxWidth: 280,
                                }}
                            >
                                <Business sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                                <Typography variant="caption" noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                    {contextScope ?? t('topbar.context.platform')}
                                    {contextRole && (
                                        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                            {' · '}{contextRole}
                                        </Box>
                                    )}
                                </Typography>
                            </Box>
                        </Tooltip>
                    )}

                    {/* Session time remaining */}
                    {sessionRemaining && (
                        <Tooltip title={t('topbar.session.tooltip')}>
                            <Chip
                                size="small"
                                icon={<AccessTime sx={{ fontSize: '16px !important' }} />}
                                label={t('topbar.session.remaining', { time: sessionRemaining })}
                                color={sessionWarning ? 'warning' : 'default'}
                                variant={sessionWarning ? 'filled' : 'outlined'}
                                aria-label={t('topbar.session.remaining', { time: sessionRemaining })}
                                sx={{
                                    mr: 0.5,
                                    display: { xs: 'none', sm: 'flex' },
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            />
                        </Tooltip>
                    )}

                    {/* Dark mode toggle */}
                    <Tooltip title={mode === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}>
                        <IconButton color="inherit" onClick={toggleMode} aria-label={t('a11y.toggleDarkMode')}>
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
