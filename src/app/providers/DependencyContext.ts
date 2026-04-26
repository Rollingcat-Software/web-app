import { createContext, useContext } from 'react'
import type { Container } from 'inversify'
import { container as defaultContainer } from '@core/di/container'

/**
 * Dependency injection context
 * Provides access to the IoC container throughout the React tree.
 *
 * NOTE: Lives in a separate file from `DependencyProvider.tsx` so that
 * react-refresh / fast-refresh can detect that the provider file only
 * exports a component.
 */
export const DependencyContext = createContext<Container>(defaultContainer)

/**
 * Hook to access services from the DI container
 *
 * @example
 * const userService = useService<IUserService>(TYPES.UserService)
 */
export function useService<T>(serviceIdentifier: symbol): T {
    const container = useContext(DependencyContext)
    if (!container) {
        throw new Error('useService must be used within DependencyProvider')
    }
    return container.get<T>(serviceIdentifier)
}

/**
 * Hook to access the DI container directly
 * Use sparingly - prefer useService for specific services
 */
export function useContainer(): Container {
    const container = useContext(DependencyContext)
    if (!container) {
        throw new Error('useContainer must be used within DependencyProvider')
    }
    return container
}
