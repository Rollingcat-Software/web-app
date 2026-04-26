import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ThemeModeContext, type ThemeMode, type ThemeModeContextValue } from './ThemeModeContext'

const STORAGE_KEY = 'fivucsas-theme-mode'

function getInitialMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
    const [mode, setModeState] = useState<ThemeMode>(getInitialMode)

    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode)
        localStorage.setItem(STORAGE_KEY, newMode)
    }, [])

    const toggleMode = useCallback(() => {
        setMode(mode === 'light' ? 'dark' : 'light')
    }, [mode, setMode])

    const value = useMemo<ThemeModeContextValue>(
        () => ({ mode, toggleMode, setMode }),
        [mode, toggleMode, setMode]
    )

    return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}
