/**
 * AuthMethodMode provider component.
 *
 * Exposes whether the surrounding tree is running in `real` authentication
 * mode (the production flow) or `stub` mode (the Auth Methods Testing
 * playground) and the `IAuthRepository` instance that should be consumed.
 *
 * Step components themselves still resolve their dependencies via
 * InversifyJS; this context is the escape hatch for wrappers that want to
 * branch on mode (e.g. swap copy, skip network calls, show demo chips).
 *
 * NOTE: The hooks (`useAuthMethodMode`, `useAuthMethodModeOptional`) and
 * the React context object live in `AuthMethodModeContext.ts` so
 * react-refresh detects this file as component-only.
 */
import { useMemo, type ReactNode } from 'react'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'
import { createStubAuthRepository } from './stubs/stubAuthRepository'
import {
    AuthMethodModeContext,
    type AuthMethodModeKind,
    type AuthMethodModeValue,
} from './AuthMethodModeContext'

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
