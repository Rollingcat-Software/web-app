/**
 * AppShell components — split out of `main.tsx` so the entry file is
 * pure side-effects (mount + DI wiring) and these components can take
 * advantage of fast-refresh during development.
 */
import {useMemo} from 'react'
import {Box, CircularProgress, CssBaseline, ThemeProvider} from '@mui/material'
import {SnackbarProvider} from 'notistack'
import App from './App'
import {AuthProvider} from '@features/auth/hooks/useAuth'
import {useThemeMode} from '@app/providers/ThemeModeContext'
import {createAppTheme} from './theme'
import {PerfProvider} from './contexts/PerfContext'

export function AppLoader() {
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'}}>
            <CircularProgress aria-label="Loading application"/>
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
