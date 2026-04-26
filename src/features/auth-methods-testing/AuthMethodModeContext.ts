/**
 * AuthMethodMode context object + hooks — split from
 * AuthMethodMode.tsx so react-refresh can detect the provider file as
 * component-only.
 */

import { createContext, useContext } from 'react'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'

export type AuthMethodModeKind = 'real' | 'stub'

export interface AuthMethodModeValue {
    mode: AuthMethodModeKind
    authRepository: IAuthRepository
}

export const AuthMethodModeContext = createContext<AuthMethodModeValue | null>(null)

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
