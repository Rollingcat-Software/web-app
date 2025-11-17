import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { LoginCredentials } from '@domain/interfaces/IAuthRepository'
import { User } from '@domain/models/User'
import type { ErrorHandler } from '@core/errors'

/**
 * Auth state
 */
interface AuthState {
    user: User | null
    loading: boolean
    error: Error | null
    isAuthenticated: boolean
}

/**
 * Auth hook return type
 */
interface UseAuthReturn extends AuthState {
    login: (credentials: LoginCredentials) => Promise<void>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

/**
 * Custom hook for authentication
 * Provides access to auth state and operations
 *
 * @example
 * const { user, login, logout, loading, error } = useAuth()
 *
 * // Login
 * await login({ email: 'user@example.com', password: 'password' })
 *
 * // Logout
 * await logout()
 */
export function useAuth(): UseAuthReturn {
    const authService = useService<IAuthService>(TYPES.AuthService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
        isAuthenticated: false,
    })

    /**
     * Load current user on mount
     */
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
                        error: error as Error,
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

    /**
     * Login with credentials
     */
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
                    error: error as Error,
                }))

                // Handle error through centralized error handler
                errorHandler.handle(error)

                throw error
            }
        },
        [authService, errorHandler]
    )

    /**
     * Logout current user
     */
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
            // Even if logout fails, clear state
            setState({
                user: null,
                loading: false,
                error: error as Error,
                isAuthenticated: false,
            })

            errorHandler.handle(error)
        }
    }, [authService, errorHandler])

    /**
     * Refresh current user data
     */
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
                error: error as Error,
                isAuthenticated: false,
            })

            errorHandler.handle(error)
        }
    }, [authService, errorHandler])

    return {
        ...state,
        login,
        logout,
        refreshUser,
    }
}
