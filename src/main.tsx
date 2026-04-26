import 'reflect-metadata'
import './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {Provider} from 'react-redux'
import {PersistGate} from 'redux-persist/integration/react'
import {BrowserRouter} from 'react-router-dom'
import {persistor, store} from './store'
import {DependencyProvider} from '@app/providers'
import {ThemeModeProvider} from '@app/providers/ThemeModeProvider'
import {AppLoader, ThemedApp} from './AppShell'
import './index.css'

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
