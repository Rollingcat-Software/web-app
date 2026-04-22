import {useLocation, useNavigate} from 'react-router-dom'
import {
    alpha,
    Box,
    Chip,
    Divider,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    useTheme,
} from '@mui/material'
import {
    AccountTree,
    Analytics,
    Business,
    Biotech,
    Dashboard,
    DevicesOther,
    Fingerprint,
    LockClock,
    People,
    PersonAdd,
    PersonOutline,
    Security,
    Assessment,
    Settings,
    Shield,
    VerifiedUser,
} from '@mui/icons-material'
import {useTranslation} from 'react-i18next'
import {useAuth} from '@features/auth/hooks/useAuth'

interface SidebarProps {
    drawerWidth: number
    mobileOpen: boolean
    onMobileClose: () => void
    isMobile: boolean
}

interface MenuItem {
    labelKey: string
    icon: React.ReactNode
    path: string
    adminOnly?: boolean
    group: 'overview' | 'access' | 'security' | 'biometrics' | 'personal'
}

// NOTE: labelKey + path + adminOnly must not change — E2E specs query by
// translated label (en.json nav.*) and depend on admin visibility gating.
const menuItems: MenuItem[] = [
    {labelKey: 'nav.dashboard',              icon: <Dashboard/>,       path: '/',                         group: 'overview'},
    {labelKey: 'nav.users',                  icon: <People/>,          path: '/users',                    adminOnly: true, group: 'access'},
    {labelKey: 'nav.guests',                 icon: <PersonAdd/>,       path: '/guests',                   adminOnly: true, group: 'access'},
    {labelKey: 'nav.tenants',                icon: <Business/>,        path: '/tenants',                  adminOnly: true, group: 'access'},
    {labelKey: 'nav.roles',                  icon: <Shield/>,          path: '/roles',                    adminOnly: true, group: 'access'},
    {labelKey: 'nav.authFlows',              icon: <AccountTree/>,     path: '/auth-flows',               adminOnly: true, group: 'security'},
    {labelKey: 'nav.authSessions',           icon: <LockClock/>,       path: '/auth-sessions',            adminOnly: true, group: 'security'},
    {labelKey: 'nav.devices',                icon: <DevicesOther/>,    path: '/devices',                  adminOnly: true, group: 'security'},
    {labelKey: 'nav.enrollments',            icon: <Fingerprint/>,     path: '/enrollments',              adminOnly: true, group: 'biometrics'},
    {labelKey: 'nav.biometricEnrollment',    icon: <Fingerprint/>,     path: '/enrollment',                                 group: 'biometrics'},
    {labelKey: 'nav.biometricTools',         icon: <Biotech/>,         path: '/biometric-tools',                            group: 'biometrics'},
    {labelKey: 'nav.auditLogs',              icon: <Security/>,        path: '/audit-logs',               adminOnly: true, group: 'security'},
    {labelKey: 'nav.analytics',              icon: <Analytics/>,       path: '/analytics',                adminOnly: true, group: 'overview'},
    {labelKey: 'nav.verificationFlows',      icon: <VerifiedUser/>,    path: '/verification-flows',       adminOnly: true, group: 'security'},
    {labelKey: 'nav.verificationDashboard',  icon: <Assessment/>,      path: '/verification-dashboard',   adminOnly: true, group: 'security'},
    {labelKey: 'nav.myProfile',              icon: <PersonOutline/>,   path: '/my-profile',                                 group: 'personal'},
    {labelKey: 'nav.settings',               icon: <Settings/>,        path: '/settings',                                   group: 'personal'},
]

const GROUP_ORDER: Array<MenuItem['group']> = ['overview', 'access', 'security', 'biometrics', 'personal']
const GROUP_LABEL_KEY: Record<MenuItem['group'], string> = {
    overview:   'nav.group.overview',
    access:     'nav.group.access',
    security:   'nav.group.security',
    biometrics: 'nav.group.biometrics',
    personal:   'nav.group.personal',
}

export default function Sidebar({
    drawerWidth,
    mobileOpen,
    onMobileClose,
    isMobile,
}: SidebarProps) {
    const theme = useTheme()
    const location = useLocation()
    const navigate = useNavigate()
    const {t} = useTranslation()
    const {user} = useAuth()
    const isDark = theme.palette.mode === 'dark'

    const visibleItems = menuItems.filter(item => !item.adminOnly || user?.isAdmin())

    // Group items but preserve the overall flat order
    const grouped = GROUP_ORDER
        .map(group => ({ group, items: visibleItems.filter(i => i.group === group) }))
        .filter(g => g.items.length > 0)

    const isActive = (path: string) =>
        path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

    const handleNavigation = (path: string) => {
        navigate(path)
        if (isMobile) {
            onMobileClose()
        }
    }

    const drawerContent = (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: isDark
                    ? 'linear-gradient(180deg, #141828 0%, #0f1220 100%)'
                    : 'linear-gradient(180deg, #ffffff 0%, #fafbff 100%)',
            }}
        >
            {/* Brand */}
            <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: 2.5 }}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1.25}}>
                    <Box
                        sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 8px 20px -6px rgba(99,102,241,0.55)',
                            color: '#fff',
                        }}
                    >
                        <Security sx={{ fontSize: 20 }}/>
                    </Box>
                    <Box>
                        <Typography
                            variant="h6"
                            fontWeight={700}
                            sx={{
                                fontFamily: '"Poppins", sans-serif',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.1,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            FIVUCSAS
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                fontSize: '0.62rem',
                                letterSpacing: '0.14em',
                                fontWeight: 600,
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                            }}
                        >
                            Identity · Verified
                        </Typography>
                    </Box>
                </Box>
            </Toolbar>
            <Divider sx={{ opacity: 0.6 }} />

            {/* Nav list */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
                {grouped.map(({ group, items }, gi) => (
                    <Box key={group} sx={{ mb: gi === grouped.length - 1 ? 0 : 1.5 }}>
                        <Typography
                            variant="overline"
                            sx={{
                                display: 'block',
                                px: 3,
                                pt: gi === 0 ? 0.5 : 1.5,
                                pb: 0.75,
                                color: 'text.disabled',
                                fontSize: '0.64rem',
                                letterSpacing: '0.14em',
                                fontWeight: 700,
                            }}
                        >
                            {t(GROUP_LABEL_KEY[group])}
                        </Typography>
                        <List disablePadding sx={{ px: 1.5 }}>
                            {items.map((item) => {
                                const active = isActive(item.path)
                                return (
                                    <ListItem key={item.labelKey} disablePadding sx={{ mb: 0.25 }}>
                                        <ListItemButton
                                            selected={active}
                                            onClick={() => handleNavigation(item.path)}
                                            aria-current={active ? 'page' : undefined}
                                            sx={{
                                                position: 'relative',
                                                borderRadius: '10px',
                                                px: 1.5,
                                                py: 0.9,
                                                color: active ? 'primary.main' : 'text.primary',
                                                transition: 'all .18s ease',
                                                '&::before': active ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    left: -10,
                                                    top: '22%',
                                                    bottom: '22%',
                                                    width: 3,
                                                    borderRadius: '0 3px 3px 0',
                                                    background: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
                                                } : {},
                                                '&.Mui-selected': {
                                                    backgroundColor: isDark
                                                        ? alpha('#6366f1', 0.14)
                                                        : alpha('#6366f1', 0.08),
                                                    '&:hover': {
                                                        backgroundColor: isDark
                                                            ? alpha('#6366f1', 0.18)
                                                            : alpha('#6366f1', 0.12),
                                                    },
                                                },
                                                '&:hover': {
                                                    backgroundColor: isDark
                                                        ? alpha('#6366f1', 0.08)
                                                        : alpha('#6366f1', 0.05),
                                                },
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    minWidth: 36,
                                                    color: active ? 'primary.main' : 'text.secondary',
                                                    transition: 'color .18s',
                                                }}
                                            >
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={t(item.labelKey)}
                                                primaryTypographyProps={{
                                                    fontSize: '0.875rem',
                                                    fontWeight: active ? 600 : 500,
                                                    letterSpacing: '-0.005em',
                                                }}
                                            />
                                            {item.adminOnly && (
                                                <Chip
                                                    label={t('nav.badgeAdmin')}
                                                    size="small"
                                                    sx={{
                                                        height: 18,
                                                        fontSize: '0.6rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.05em',
                                                        backgroundColor: isDark
                                                            ? alpha('#f59e0b', 0.18)
                                                            : alpha('#f59e0b', 0.12),
                                                        color: isDark ? '#fbbf24' : '#b45309',
                                                        borderRadius: '5px',
                                                        '& .MuiChip-label': { px: 0.75 },
                                                    }}
                                                />
                                            )}
                                        </ListItemButton>
                                    </ListItem>
                                )
                            })}
                        </List>
                    </Box>
                ))}
            </Box>

            {/* Footer status tile */}
            <Box sx={{ p: 1.5 }}>
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        border: `1px solid ${alpha('#6366f1', isDark ? 0.2 : 0.14)}`,
                        background: isDark
                            ? `linear-gradient(135deg, ${alpha('#6366f1', 0.1)}, ${alpha('#8b5cf6', 0.05)})`
                            : `linear-gradient(135deg, ${alpha('#6366f1', 0.06)}, ${alpha('#8b5cf6', 0.03)})`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 8px #10b981',
                            flexShrink: 0,
                        }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                            {t('sidebar.systemStatus', 'All systems operational')}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                            status.fivucsas.com
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    )

    return (
        <Box
            component="nav"
            aria-label={t('nav.primary', 'Primary navigation')}
            sx={{width: {md: drawerWidth}, flexShrink: {md: 0}}}
        >
            {/* Mobile drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={onMobileClose}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: {xs: 'block', md: 'none'},
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: drawerWidth,
                        borderRight: 'none',
                    },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Desktop drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    display: {xs: 'none', md: 'block'},
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: drawerWidth,
                    },
                }}
                open
            >
                {drawerContent}
            </Drawer>
        </Box>
    )
}
