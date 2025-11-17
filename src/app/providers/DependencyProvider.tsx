import React, { createContext, useContext } from 'react'
import type { Container } from 'inversify'
import { container as defaultContainer } from '@core/di/container'

/**
 * Dependency injection context
 * Provides access to the IoC container throughout the React tree
 */
const DependencyContext = createContext<Container>(defaultContainer)

/**
 * Dependency Provider Props
 */
interface DependencyProviderProps {
    children: React.ReactNode
    container?: Container
}

/**
 * Dependency Provider Component
 * Wraps the application and provides DI container to all children
 *
 * @example
 * <DependencyProvider>
 *   <App />
 * </DependencyProvider>
 */
export function DependencyProvider({
    children,
    container = defaultContainer
}: DependencyProviderProps) {
    return (
        <DependencyContext.Provider value={container}>
            {children}
        </DependencyContext.Provider>
    )
}

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
