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
    Typography,
} from '@mui/material'
import {AccountCircle, Logout, Menu as MenuIcon, Notifications, Settings,} from '@mui/icons-material'
import {useAuth} from '@features/auth/hooks/useAuth'

interface TopBarProps {
    drawerWidth: number
    onMenuClick: () => void
}

export default function TopBar({drawerWidth, onMenuClick}: TopBarProps) {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    const getPageTitle = () => {
        const path = location.pathname
        if (path === '/') return 'Dashboard'
        if (path.startsWith('/users')) return 'Users'
        if (path.startsWith('/tenants')) return 'Tenants'
        if (path.startsWith('/enrollments')) return 'Enrollments'
        if (path.startsWith('/audit-logs')) return 'Audit Logs'
        if (path.startsWith('/settings')) return 'Settings'
        return 'Dashboard'
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
                    {/* Notifications */}
                    <IconButton color="inherit" aria-label="Notifications">
                        <Notifications/>
                    </IconButton>

                    {/* User menu */}
                    <IconButton
                        onClick={handleMenu}
                        sx={{p: 0.5}}
                        aria-label="User menu"
                        aria-haspopup="true"
                    >
                        <Avatar
                            sx={{width: 36, height: 36, bgcolor: 'primary.main'}}
                        >
                            {user?.firstName?.[0] || 'A'}
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
                        <MenuItem onClick={() => {
                            handleClose();
                            navigate('/settings')
                        }}>
                            <ListItemIcon>
                                <AccountCircle fontSize="small"/>
                            </ListItemIcon>
                            Profile
                        </MenuItem>
                        <MenuItem onClick={handleSettings}>
                            <ListItemIcon>
                                <Settings fontSize="small"/>
                            </ListItemIcon>
                            Settings
                        </MenuItem>
                        <Divider/>
                        <MenuItem onClick={() => { handleClose(); handleLogout() }}>
                            <ListItemIcon>
                                <Logout fontSize="small" color="error"/>
                            </ListItemIcon>
                            <Typography color="error">Logout</Typography>
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    )
}
