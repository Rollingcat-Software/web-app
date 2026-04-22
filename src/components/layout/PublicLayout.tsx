import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom'
import {
    alpha,
    AppBar,
    Box,
    Button,
    Container,
    Link,
    Toolbar,
    Typography,
    useTheme,
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
    const theme = useTheme()
    const navigate = useNavigate()
    const { isAuthenticated } = useAuth()
    const { mode } = useThemeMode()
    const { t } = useTranslation()
    const isDark = mode === 'dark'

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: isDark
                    ? 'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.1), transparent 60%), #0f1220'
                    : 'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.08), transparent 60%), #f8fafc',
            }}
        >
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    bgcolor: isDark ? alpha('#0f1220', 0.75) : 'rgba(255, 255, 255, 0.8)',
                    color: 'text.primary',
                }}
            >
                <Toolbar sx={{ gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1 }}>
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '9px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 6px 16px -4px rgba(99,102,241,0.5)',
                                color: '#fff',
                            }}
                        >
                            <Security sx={{ fontSize: 18 }} />
                        </Box>
                        <Typography
                            variant="h6"
                            fontWeight={700}
                            sx={{
                                fontFamily: '"Poppins", sans-serif',
                                fontSize: { xs: '1rem', sm: '1.15rem' },
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            FIVUCSAS
                        </Typography>
                    </Box>

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
                            variant="contained"
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
                    py: 3,
                    textAlign: 'center',
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                }}
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ fontWeight: 600 }}
                >
                    {t('footer.platform')}
                </Typography>
                <Box sx={{ mt: 0.75, display: 'flex', justifyContent: 'center', gap: 2.5 }}>
                    <Link
                        component={RouterLink}
                        to="/terms"
                        variant="caption"
                        color="text.secondary"
                        underline="hover"
                        sx={{ fontWeight: 500, '&:hover': { color: 'primary.main' } }}
                    >
                        {t('footer.terms')}
                    </Link>
                    <Link
                        component={RouterLink}
                        to="/privacy"
                        variant="caption"
                        color="text.secondary"
                        underline="hover"
                        sx={{ fontWeight: 500, '&:hover': { color: 'primary.main' } }}
                    >
                        {t('footer.privacy')}
                    </Link>
                </Box>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                    {t('footer.copyright')}
                </Typography>
                <Typography
                    variant="caption"
                    color="text.disabled"
                    display="block"
                    sx={{ mt: 0.25, opacity: 0.65, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: '0.7rem' }}
                >
                    {t('footer.version')}
                </Typography>
            </Box>
        </Box>
    )
}
