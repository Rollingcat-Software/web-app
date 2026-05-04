/**
 * AppShell components — split out of `main.tsx` so the entry file is
 * pure side-effects (mount + DI wiring) and these components can take
 * advantage of fast-refresh during development.
 */
import {useMemo} from 'react'
import {Box, CircularProgress, CssBaseline, ThemeProvider} from '@mui/material'
import {SnackbarProvider} from 'notistack'
import {useTranslation} from 'react-i18next'
import App from './App'
import {AuthProvider} from '@features/auth/hooks/useAuth'
import {useThemeMode} from '@app/providers/ThemeModeContext'
import {createAppTheme} from './theme'
import {PerfProvider} from './contexts/PerfContext'

export function AppLoader() {
    const {t} = useTranslation()
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'}}>
            <CircularProgress aria-label={t('a11y.loadingApp')}/>
        </Box>
    )
}

export function ThemedApp() {
    const {mode} = useThemeMode()
    const theme = useMemo(() => createAppTheme(mode), [mode])

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <SnackbarProvider maxSnack={3} preventDuplicate anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                <AuthProvider>
                    <PerfProvider>
                        <App/>
                    </PerfProvider>
                </AuthProvider>
            </SnackbarProvider>
        </ThemeProvider>
    )
}
