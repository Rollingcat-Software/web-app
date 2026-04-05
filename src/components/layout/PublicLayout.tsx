import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom'
import {
    AppBar,
    Box,
    Button,
    Container,
    Link,
    Toolbar,
    Typography,
} from '@mui/material'
import { ArrowBack, Login, Security } from '@mui/icons-material'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useThemeMode } from '@app/providers/ThemeModeProvider'
import { useTranslation } from 'react-i18next'

/**
 * Minimal layout for public-facing developer pages (widget-demo, developer-portal).
 * Provides a simple AppBar with FIVUCSAS branding and contextual navigation
 * (back to dashboard if authenticated, or sign-in if not).
 */
export default function PublicLayout() {
    const navigate = useNavigate()
    const { isAuthenticated } = useAuth()
    const { mode } = useThemeMode()
    const { t } = useTranslation()

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    bgcolor: mode === 'dark' ? 'grey.900' : '#fff',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    color: 'text.primary',
                }}
            >
                <Toolbar sx={{ gap: 1.5 }}>
                    <Security sx={{ color: 'primary.main', fontSize: 28 }} />
                    <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{
                            flexGrow: 1,
                            fontSize: { xs: '1rem', sm: '1.25rem' },
                            letterSpacing: '-0.01em',
                        }}
                    >
                        FIVUCSAS
                    </Typography>

                    {isAuthenticated ? (
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={() => navigate('/')}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            {t('publicLayout.backToDashboard', 'Back to Dashboard')}
                        </Button>
                    ) : (
                        <Button
                            startIcon={<Login />}
                            variant="outlined"
                            onClick={() => navigate('/login')}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                            {t('publicLayout.signIn', 'Sign In')}
                        </Button>
                    )}
                </Toolbar>
            </AppBar>

            {/* Main content area below the AppBar */}
            <Container
                maxWidth="lg"
                sx={{
                    mt: { xs: '64px', sm: '72px' },
                    py: { xs: 2, sm: 3 },
                    flexGrow: 1,
                }}
            >
                <Outlet />
            </Container>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    py: 2,
                    textAlign: 'center',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="caption" color="text.disabled" display="block">
                    {t('footer.platform')}
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center', gap: 2 }}>
                    <Link component={RouterLink} to="/terms" variant="caption" color="text.disabled" underline="hover">
                        {t('footer.terms')}
                    </Link>
                    <Link component={RouterLink} to="/privacy" variant="caption" color="text.disabled" underline="hover">
                        {t('footer.privacy')}
                    </Link>
                </Box>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25 }}>
                    {t('footer.copyright')}
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25, opacity: 0.7 }}>
                    {t('footer.version')}
                </Typography>
            </Box>
        </Box>
    )
}
