import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { LoginCredentials } from '@domain/interfaces/IAuthRepository'
import { User } from '@domain/models/User'
import type { ErrorHandler } from '@core/errors'
import type { AvailableMfaMethod } from '@domain/interfaces/IAuthRepository'

interface AuthState {
    user: User | null
    loading: boolean
    error: Error | null
    isAuthenticated: boolean
}

interface LoginResult {
    twoFactorRequired: boolean
    twoFactorMethod?: string
    mfaSessionToken?: string
    availableMethods?: AvailableMfaMethod[]
}

interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<LoginResult>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const authService = useService<IAuthService>(TYPES.AuthService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
        isAuthenticated: false,
    })

    useEffect(() => {
        let mounted = true

        const loadUser = async () => {
            try {
                const user = await authService.getCurrentUser()
                if (mounted) {
                    setState({
                        user,
                        loading: false,
                        error: null,
                        isAuthenticated: !!user,
                    })
                }
            } catch (error) {
                if (mounted) {
                    setState({
                        user: null,
                        loading: false,
                        error: error instanceof Error ? error : new Error(String(error)),
                        isAuthenticated: false,
                    })
                }
            }
        }

        loadUser()

        return () => {
            mounted = false
        }
    }, [authService])

    const login = useCallback(
        async (credentials: LoginCredentials): Promise<LoginResult> => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await authService.login(credentials)

                const mfaRequired = result.twoFactorRequired ?? false

                setState({
                    user: result.user,
                    loading: false,
                    error: null,
                    // Don't mark as authenticated until MFA is complete
                    isAuthenticated: !mfaRequired,
                })

                return {
                    twoFactorRequired: mfaRequired,
                    twoFactorMethod: result.twoFactorMethod,
                    mfaSessionToken: result.mfaSessionToken,
                    availableMethods: result.availableMethods,
                }
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                }))

                // Don't call errorHandler.handle() here — the LoginPage
                // already displays errors via the `error` state. Calling
                // errorHandler would show a duplicate snackbar notification.
                throw error
            }
        },
        [authService]
    )

    const logout = useCallback(async () => {
        try {
            await authService.logout()

            setState({
                user: null,
                loading: false,
                error: null,
                isAuthenticated: false,
            })
        } catch (error) {
            setState({
                user: null,
                loading: false,
                error: error instanceof Error ? error : new Error(String(error)),
                isAuthenticated: false,
            })

            errorHandler.handle(error)
        }
    }, [authService, errorHandler])

    const refreshUser = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true }))

        try {
            const user = await authService.getCurrentUser()

            setState({
                user,
                loading: false,
                error: null,
                isAuthenticated: !!user,
            })
        } catch (error) {
            setState({
                user: null,
                loading: false,
                error: error instanceof Error ? error : new Error(String(error)),
                isAuthenticated: false,
            })

            errorHandler.handle(error)
        }
    }, [authService, errorHandler])

    const contextValue = useMemo<AuthContextValue>(
        () => ({
            ...state,
            login,
            logout,
            refreshUser,
        }),
        [state, login, logout, refreshUser]
    )

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    )
}

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
