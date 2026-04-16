import 'reflect-metadata'
import './i18n'
import React, {useMemo} from 'react'
import ReactDOM from 'react-dom/client'
import {Provider} from 'react-redux'
import {PersistGate} from 'redux-persist/integration/react'
import {BrowserRouter} from 'react-router-dom'
import {Box, CircularProgress, CssBaseline, ThemeProvider} from '@mui/material'
import {SnackbarProvider} from 'notistack'
import App from './App'
import {persistor, store} from './store'
import {DependencyProvider} from '@app/providers'
import {AuthProvider} from '@features/auth/hooks/useAuth'
import {ThemeModeProvider, useThemeMode} from '@app/providers/ThemeModeProvider'
import {createAppTheme} from './theme'
import {PerfProvider} from './contexts/PerfContext'
import './index.css'

function AppLoader() {
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'}}>
            <CircularProgress aria-label="Loading application"/>
        </Box>
    )
}

function ThemedApp() {
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

const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element not found. Ensure index.html contains <div id="root"></div>')
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <DependencyProvider>
            <Provider store={store}>
                <PersistGate loading={<AppLoader/>} persistor={persistor}>
                    <BrowserRouter
                        future={{
                            v7_startTransition: true,
                            v7_relativeSplatPath: true,
                        }}
                    >
                        <ThemeModeProvider>
                            <ThemedApp/>
                        </ThemeModeProvider>
                    </BrowserRouter>
                </PersistGate>
            </Provider>
        </DependencyProvider>
    </React.StrictMode>,
)
