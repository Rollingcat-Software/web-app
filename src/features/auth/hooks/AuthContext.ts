import { createContext, useContext } from 'react'
import type { LoginCredentials, AvailableMfaMethod } from '@domain/interfaces/IAuthRepository'
import type { User } from '@domain/models/User'

export interface AuthState {
    user: User | null
    loading: boolean
    error: Error | null
    isAuthenticated: boolean
}

export interface LoginResult {
    twoFactorRequired: boolean
    twoFactorMethod?: string
    mfaSessionToken?: string
    availableMethods?: AvailableMfaMethod[]
}

export interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<LoginResult>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Custom hook for authentication
 * Uses shared AuthContext to prevent redundant API calls
 */
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
