/**
 * AuthMethodMode provider component.
 *
 * Exposes which `AuthMethodModeKind` the surrounding tree is running in:
 * `real` (the production sign-in flow), `test` (the Auth Methods Testing
 * playground hitting real endpoints with the logged-in admin's session),
 * or the legacy `stub` alias (kept for older tests; behaves like `test`).
 *
 * The `IAuthRepository` exposed here is **always** the real, DI-resolved
 * production repository. There is no stub — the previous behaviour of
 * returning fake `AUTHENTICATED` responses caused USER-BUG-5 (every test
 * card silently "passed"). All puzzles must hit real endpoints and
 * surface real failures.
 *
 * NOTE: The hooks (`useAuthMethodMode`, `useAuthMethodModeOptional`) and
 * the React context object live in `AuthMethodModeContext.ts` so
 * react-refresh detects this file as component-only.
 */
import { useMemo, type ReactNode } from 'react'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import {
    AuthMethodModeContext,
    type AuthMethodModeKind,
    type AuthMethodModeValue,
} from './AuthMethodModeContext'

export interface AuthMethodModeProviderProps {
    mode: AuthMethodModeKind
    /**
     * Optional override — Vitest tests inject a mock here so they don't
     * need a fully-configured DI container to render a puzzle.
     */
    authRepository?: IAuthRepository
    children: ReactNode
}

/**
 * Wraps `children` with an AuthMethodMode value. The `mode` prop is now
 * informational only (kept on the context so wrappers can branch their
 * copy / chips); the repository is the production one regardless.
 */
export function AuthMethodModeProvider({
    mode,
    authRepository,
    children,
}: AuthMethodModeProviderProps) {
    // Resolve the production repo from the DI container. Tests that render
    // outside of a DependencyProvider must pass `authRepository` explicitly.
    const resolved = useService<IAuthRepository>(TYPES.AuthRepository)
    const value = useMemo<AuthMethodModeValue>(
        () => ({ mode, authRepository: authRepository ?? resolved }),
        [mode, authRepository, resolved],
    )

    return (
        <AuthMethodModeContext.Provider value={value}>
            {children}
        </AuthMethodModeContext.Provider>
    )
}
