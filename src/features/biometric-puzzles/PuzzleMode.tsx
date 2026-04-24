/**
 * PuzzleMode context.
 *
 * Exposes whether the surrounding tree is running in `real` authentication mode
 * (the production flow) or `stub` mode (the Biometric Puzzle playground) and
 * the `IAuthRepository` instance that should be consumed.
 *
 * Step components themselves still resolve their dependencies via InversifyJS;
 * this context is the escape hatch for puzzle-specific wrappers that want to
 * branch on mode (e.g. swap copy, skip network calls, show demo chips).
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'
import { createStubAuthRepository } from './stubs/stubAuthRepository'

export type PuzzleModeKind = 'real' | 'stub'

export interface PuzzleModeValue {
    mode: PuzzleModeKind
    authRepository: IAuthRepository
}

const PuzzleModeContext = createContext<PuzzleModeValue | null>(null)

export interface PuzzleModeProviderProps {
    mode: PuzzleModeKind
    /** Optional override — tests may inject their own stub. */
    authRepository?: IAuthRepository
    children: ReactNode
}

/**
 * Wraps `children` with a PuzzleMode value. When `mode === 'stub'` the stub
 * repository is used; when `mode === 'real'` callers MUST pass a real
 * `authRepository` (typically resolved from the DI container).
 */
export function PuzzleModeProvider({
    mode,
    authRepository,
    children,
}: PuzzleModeProviderProps) {
    const value = useMemo<PuzzleModeValue>(() => {
        if (mode === 'stub') {
            return {
                mode,
                authRepository: authRepository ?? createStubAuthRepository(),
            }
        }

        if (!authRepository) {
            throw new Error(
                'PuzzleModeProvider: mode="real" requires an authRepository prop',
            )
        }

        return { mode, authRepository }
    }, [mode, authRepository])

    return (
        <PuzzleModeContext.Provider value={value}>
            {children}
        </PuzzleModeContext.Provider>
    )
}

/**
 * Access the current PuzzleMode. When consumed outside a provider, defaults
 * to `real` mode with no auth repository — callers in real-auth land should
 * never rely on the repo from context and should keep resolving via DI.
 */
export function usePuzzleMode(): PuzzleModeValue {
    const ctx = useContext(PuzzleModeContext)
    if (!ctx) {
        throw new Error('usePuzzleMode must be used within PuzzleModeProvider')
    }
    return ctx
}

/**
 * Soft variant — returns null when no provider is present. Useful for
 * components that want to adapt copy but shouldn't crash outside puzzle land.
 */
export function usePuzzleModeOptional(): PuzzleModeValue | null {
    return useContext(PuzzleModeContext)
}
