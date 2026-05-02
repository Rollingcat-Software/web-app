import 'reflect-metadata'
import './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {DependencyProvider} from '@app/providers'
import {ThemeModeProvider} from '@app/providers/ThemeModeProvider'
import {ThemedApp} from './AppShell'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element not found. Ensure index.html contains <div id="root"></div>')
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <DependencyProvider>
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
        </DependencyProvider>
    </React.StrictMode>,
)
