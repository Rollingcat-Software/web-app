import {useLocation, useNavigate} from 'react-router-dom'
import {
    Box,
    Divider,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from '@mui/material'
import {
    AccountTree,
    Analytics,
    Business,
    Dashboard,
    DevicesOther,
    Fingerprint,
    HowToReg,
    LockClock,
    People,
    PersonAdd,
    Security,
    Settings,
    Shield,
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
}

const menuItems: MenuItem[] = [
    {labelKey: 'nav.dashboard', icon: <Dashboard/>, path: '/'},
    {labelKey: 'nav.users', icon: <People/>, path: '/users', adminOnly: true},
    {labelKey: 'nav.guests', icon: <PersonAdd/>, path: '/guests', adminOnly: true},
    {labelKey: 'nav.tenants', icon: <Business/>, path: '/tenants', adminOnly: true},
    {labelKey: 'nav.roles', icon: <Shield/>, path: '/roles', adminOnly: true},
    {labelKey: 'nav.authFlows', icon: <AccountTree/>, path: '/auth-flows', adminOnly: true},
    {labelKey: 'nav.authSessions', icon: <LockClock/>, path: '/auth-sessions', adminOnly: true},
    {labelKey: 'nav.devices', icon: <DevicesOther/>, path: '/devices', adminOnly: true},
    {labelKey: 'nav.enrollments', icon: <Fingerprint/>, path: '/enrollments', adminOnly: true},
    {labelKey: 'nav.userEnrollment', icon: <HowToReg/>, path: '/user-enrollment'},
    {labelKey: 'nav.auditLogs', icon: <Security/>, path: '/audit-logs', adminOnly: true},
    {labelKey: 'nav.analytics', icon: <Analytics/>, path: '/analytics', adminOnly: true},
    {labelKey: 'nav.settings', icon: <Settings/>, path: '/settings'},
]

export default function Sidebar({
                                    drawerWidth,
                                    mobileOpen,
                                    onMobileClose,
                                    isMobile,
                                }: SidebarProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const {t} = useTranslation()
    const {user} = useAuth()

    const visibleItems = menuItems.filter(item => !item.adminOnly || user?.isAdmin())

    const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

    const handleNavigation = (path: string) => {
        navigate(path)
        if (isMobile) {
            onMobileClose()
        }
    }

    const drawerContent = (
        <Box>
            <Toolbar>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Security sx={{color: 'primary.main', fontSize: 32}}/>
                    <Typography variant="h6" fontWeight={600} color="primary.main">
                        FIVUCSAS
                    </Typography>
                </Box>
            </Toolbar>
            <Divider/>
            <List>
                {visibleItems.map((item) => (
                    <ListItem key={item.labelKey} disablePadding>
                        <ListItemButton
                            selected={isActive(item.path)}
                            onClick={() => handleNavigation(item.path)}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: 'primary.lighter',
                                    borderRight: 3,
                                    borderColor: 'primary.main',
                                    '&:hover': {
                                        backgroundColor: 'primary.lighter',
                                    },
                                },
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                                }}
                            >
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={t(item.labelKey)}
                                sx={{
                                    '& .MuiTypography-root': {
                                        fontWeight: isActive(item.path) ? 600 : 400,
                                        color: isActive(item.path) ? 'primary.main' : 'text.primary',
                                    },
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    )

    return (
        <Box
            component="nav"
            sx={{width: {md: drawerWidth}, flexShrink: {md: 0}}}
        >
            {/* Mobile drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={onMobileClose}
                ModalProps={{
                    keepMounted: true, // Better open performance on mobile
                }}
                sx={{
                    display: {xs: 'block', md: 'none'},
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: drawerWidth,
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
