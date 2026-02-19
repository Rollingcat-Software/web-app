import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

interface ThemeModeContextValue {
    mode: ThemeMode
    toggleMode: () => void
    setMode: (mode: ThemeMode) => void
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
    mode: 'light',
    toggleMode: () => {},
    setMode: () => {},
})

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

export function useThemeMode() {
    return useContext(ThemeModeContext)
}
