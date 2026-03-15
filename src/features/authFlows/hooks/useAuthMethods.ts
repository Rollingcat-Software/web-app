import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { AuthMethodRepository } from '@core/repositories/AuthMethodRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { DEFAULT_AUTH_METHODS, type AuthMethod } from '@domain/models/AuthMethod'

interface UseAuthMethodsReturn {
    authMethods: AuthMethod[]
    loading: boolean
    warning: string | null
    refresh: () => Promise<void>
}

/**
 * Hook to fetch auth methods from backend with automatic fallback to defaults.
 * The repository itself returns DEFAULT_AUTH_METHODS on API failure,
 * so this hook always resolves with a usable list.
 */
export function useAuthMethods(): UseAuthMethodsReturn {
    const authMethodRepo = useService<AuthMethodRepository>(TYPES.AuthMethodRepository)
    const logger = useService<ILogger>(TYPES.Logger)

    const [authMethods, setAuthMethods] = useState<AuthMethod[]>(DEFAULT_AUTH_METHODS)
    const [loading, setLoading] = useState(true)
    const [warning, setWarning] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const methods = await authMethodRepo.listMethods()
            setAuthMethods(methods)
            // If we got back the exact default reference, the API likely failed
            if (methods === DEFAULT_AUTH_METHODS) {
                setWarning('Could not load authentication methods from backend. Showing fallback defaults.')
            } else {
                setWarning(null)
            }
        } catch (err) {
            logger.warn('Unexpected error in useAuthMethods', err)
            setAuthMethods(DEFAULT_AUTH_METHODS)
            setWarning('Could not load authentication methods from backend. Showing fallback defaults.')
        } finally {
            setLoading(false)
        }
    }, [authMethodRepo, logger])

    useEffect(() => {
        refresh()
    }, [refresh])

    return { authMethods, loading, warning, refresh }
}
