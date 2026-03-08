import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { lightTheme, darkTheme } from './themes'

/**
 * Theme mode types
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Theme context value interface
 */
interface ThemeContextValue {
    mode: ThemeMode
    effectiveMode: 'light' | 'dark'
    setMode: (mode: ThemeMode) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Storage key for theme preference
 */
const THEME_STORAGE_KEY = 'app-theme-mode'

/**
 * Theme Provider Props
 */
interface AppThemeProviderProps {
    children: React.ReactNode
    /** Optional initial mode override */
    initialMode?: ThemeMode
    /** Optional callback when theme changes */
    onThemeChange?: (mode: ThemeMode) => void
}

/**
 * App Theme Provider Component
 * Manages theme state with system preference detection and persistence
 */
export function AppThemeProvider({
    children,
    initialMode,
    onThemeChange,
}: AppThemeProviderProps) {
    // Load initial mode from localStorage or default to 'system'
    const [mode, setModeState] = useState<ThemeMode>(() => {
        if (initialMode) return initialMode
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return (stored as ThemeMode) || 'system'
    })

    const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('light')

    // Listen to system preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemPreference(e.matches ? 'dark' : 'light')
        }

        // Set initial value
        setSystemPreference(mediaQuery.matches ? 'dark' : 'light')

        // Listen for changes
        mediaQuery.addEventListener('change', handleChange)

        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    // Calculate effective mode
    const effectiveMode = mode === 'system' ? systemPreference : mode

    // Get the theme based on effective mode
    const theme = useMemo(
        () => (effectiveMode === 'dark' ? darkTheme : lightTheme),
        [effectiveMode]
    )

    // Set mode and persist
    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode)
        localStorage.setItem(THEME_STORAGE_KEY, newMode)
        onThemeChange?.(newMode)
    }, [onThemeChange])

    // Toggle between light and dark (ignoring system)
    const toggleTheme = useCallback(() => {
        const newMode = effectiveMode === 'light' ? 'dark' : 'light'
        setMode(newMode)
    }, [effectiveMode, setMode])

    const value = useMemo(
        () => ({
            mode,
            effectiveMode,
            setMode,
            toggleTheme,
        }),
        [mode, effectiveMode, setMode, toggleTheme]
    )

    return (
        <ThemeContext.Provider value={value}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    )
}

/**
 * Hook to access theme context
 */
export function useAppTheme(): ThemeContextValue {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useAppTheme must be used within AppThemeProvider')
    }
    return context
}

export default AppThemeProvider
