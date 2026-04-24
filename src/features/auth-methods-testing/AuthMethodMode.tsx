/**
 * AuthMethodMode context.
 *
 * Exposes whether the surrounding tree is running in `real` authentication
 * mode (the production flow) or `stub` mode (the Auth Methods Testing
 * playground) and the `IAuthRepository` instance that should be consumed.
 *
 * Step components themselves still resolve their dependencies via
 * InversifyJS; this context is the escape hatch for wrappers that want to
 * branch on mode (e.g. swap copy, skip network calls, show demo chips).
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'
import { createStubAuthRepository } from './stubs/stubAuthRepository'

export type AuthMethodModeKind = 'real' | 'stub'

export interface AuthMethodModeValue {
    mode: AuthMethodModeKind
    authRepository: IAuthRepository
}

const AuthMethodModeContext = createContext<AuthMethodModeValue | null>(null)

export interface AuthMethodModeProviderProps {
    mode: AuthMethodModeKind
    /** Optional override — tests may inject their own stub. */
    authRepository?: IAuthRepository
    children: ReactNode
}

/**
 * Wraps `children` with an AuthMethodMode value. When `mode === 'stub'` the
 * stub repository is used; when `mode === 'real'` callers MUST pass a real
 * `authRepository` (typically resolved from the DI container).
 */
export function AuthMethodModeProvider({
    mode,
    authRepository,
    children,
}: AuthMethodModeProviderProps) {
    const value = useMemo<AuthMethodModeValue>(() => {
        if (mode === 'stub') {
            return {
                mode,
                authRepository: authRepository ?? createStubAuthRepository(),
            }
        }

        if (!authRepository) {
            throw new Error(
                'AuthMethodModeProvider: mode="real" requires an authRepository prop',
            )
        }

        return { mode, authRepository }
    }, [mode, authRepository])

    return (
        <AuthMethodModeContext.Provider value={value}>
            {children}
        </AuthMethodModeContext.Provider>
    )
}

/**
 * Access the current AuthMethodMode. Throws when consumed outside a
 * `AuthMethodModeProvider` — callers that need to adapt without crashing
 * should use `useAuthMethodModeOptional()` instead and keep resolving
 * real-auth dependencies via DI.
 */
export function useAuthMethodMode(): AuthMethodModeValue {
    const ctx = useContext(AuthMethodModeContext)
    if (!ctx) {
        throw new Error(
            'useAuthMethodMode must be used within AuthMethodModeProvider',
        )
    }
    return ctx
}

/**
 * Soft variant — returns null when no provider is present. Useful for
 * components that want to adapt copy but shouldn't crash outside the
 * playground.
 */
export function useAuthMethodModeOptional(): AuthMethodModeValue | null {
    return useContext(AuthMethodModeContext)
}
