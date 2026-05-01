/**
 * AuthMethodMode context object + hooks — split from
 * AuthMethodMode.tsx so react-refresh can detect the provider file as
 * component-only.
 */

import { createContext, useContext } from 'react'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'

/**
 * Mode the auth-methods-testing tree is running in.
 *
 * - `real` — the production auth/MFA flow during sign-in (hosts the
 *   `IAuthRepository` resolved from DI).
 * - `test` — the Auth Methods Testing playground; still hits real
 *   endpoints (against the logged-in admin's own session) but uses the
 *   JWT-authenticated `/auth/2fa/*` surface instead of an MFA session
 *   token. Wrappers may use this flag to swap copy or hide chips.
 *
 * Historical alias `stub` is preserved so older tests continue to type-check;
 * functionally it behaves identically to `test` (no fake responses anywhere).
 */
export type AuthMethodModeKind = 'real' | 'test' | 'stub'

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
