import 'reflect-metadata'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {Provider} from 'react-redux'
import {PersistGate} from 'redux-persist/integration/react'
import {BrowserRouter} from 'react-router-dom'
import {CssBaseline, ThemeProvider} from '@mui/material'
import {SnackbarProvider} from 'notistack'
import App from './App'
import {persistor, store} from './store'
import {DependencyProvider} from '@app/providers'
import theme from './theme'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <DependencyProvider>
            <Provider store={store}>
                <PersistGate loading={null} persistor={persistor}>
                    <BrowserRouter
                        future={{
                            v7_startTransition: true,
                            v7_relativeSplatPath: true,
                        }}
                    >
                        <ThemeProvider theme={theme}>
                            <CssBaseline/>
                            <SnackbarProvider maxSnack={3} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                                <App/>
                            </SnackbarProvider>
                        </ThemeProvider>
                    </BrowserRouter>
                </PersistGate>
            </Provider>
        </DependencyProvider>
    </React.StrictMode>,
)
