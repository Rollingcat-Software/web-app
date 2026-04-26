import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'

export interface ThemeModeContextValue {
    mode: ThemeMode
    toggleMode: () => void
    setMode: (mode: ThemeMode) => void
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
    mode: 'light',
    toggleMode: () => {},
    setMode: () => {},
})

export function useThemeMode() {
    return useContext(ThemeModeContext)
}
