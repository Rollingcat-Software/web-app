import { createContext, useContext } from 'react'

/**
 * Theme mode types
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Theme context value interface
 */
export interface ThemeContextValue {
    mode: ThemeMode
    effectiveMode: 'light' | 'dark'
    setMode: (mode: ThemeMode) => void
    toggleTheme: () => void
}

/**
 * Storage key for theme preference
 */
export const THEME_STORAGE_KEY = 'app-theme-mode'

export const AppThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Hook to access theme context
 */
export function useAppTheme(): ThemeContextValue {
    const context = useContext(AppThemeContext)
    if (!context) {
        throw new Error('useAppTheme must be used within AppThemeProvider')
    }
    return context
}
