import {useState} from 'react'
import {Outlet} from 'react-router-dom'
import {Box, useMediaQuery, useTheme} from '@mui/material'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const DRAWER_WIDTH = 260

export default function DashboardLayout() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleDrawerToggle = () => {
        setMobileOpen(prev => !prev)
    }

    return (
        <Box sx={{display: 'flex', minHeight: '100vh'}}>
            {/* Top Bar */}
            <TopBar
                drawerWidth={DRAWER_WIDTH}
                onMenuClick={handleDrawerToggle}
            />

            {/* Sidebar */}
            <Sidebar
                drawerWidth={DRAWER_WIDTH}
                mobileOpen={mobileOpen}
                onMobileClose={handleDrawerToggle}
                isMobile={isMobile}
            />

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: {md: `calc(100% - ${DRAWER_WIDTH}px)`},
                    mt: {xs: '56px', sm: '64px'},
                    backgroundColor: 'background.default',
                    minHeight: {xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)'},
                }}
            >
                <Outlet/>
            </Box>
        </Box>
    )
}
