import React from 'react'
import type { Container } from 'inversify'
import { container as defaultContainer } from '@core/di/container'
import { DependencyContext } from './DependencyContext'

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
