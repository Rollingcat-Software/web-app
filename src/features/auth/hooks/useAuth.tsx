import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { LoginCredentials } from '@domain/interfaces/IAuthRepository'
import { User } from '@domain/models/User'
import type { ErrorHandler } from '@core/errors'

interface AuthState {
    user: User | null
    loading: boolean
    error: Error | null
    isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<void>
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
        async (credentials: LoginCredentials) => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await authService.login(credentials)

                setState({
                    user: result.user,
                    loading: false,
                    error: null,
                    isAuthenticated: true,
                })
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                }))

                errorHandler.handle(error)
                throw error
            }
        },
        [authService, errorHandler]
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

    return (
        <AuthContext.Provider
            value={{
                ...state,
                login,
                logout,
                refreshUser,
            }}
        >
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
