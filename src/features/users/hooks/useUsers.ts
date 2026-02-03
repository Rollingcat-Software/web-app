import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IUserService, UserFilters } from '@domain/interfaces/IUserService'
import type { CreateUserData, UpdateUserData } from '@domain/interfaces/IUserRepository'
import { User } from '@domain/models/User'
import type { ErrorHandler } from '@core/errors'

/**
 * Users state
 */
interface UsersState {
    users: User[]
    total: number
    loading: boolean
    error: Error | null
}

/**
 * Use users hook return type
 */
interface UseUsersReturn extends UsersState {
    refetch: (filters?: UserFilters) => Promise<void>
    createUser: (data: CreateUserData) => Promise<User>
    updateUser: (id: string, data: UpdateUserData) => Promise<User>
    deleteUser: (id: string) => Promise<void>
    activateUser: (id: string) => Promise<void>
    suspendUser: (id: string, reason?: string) => Promise<void>
}

/**
 * Custom hook for users management
 * Provides access to user list and CRUD operations
 *
 * @example
 * const { users, loading, createUser, deleteUser } = useUsers()
 */
export function useUsers(initialFilters?: UserFilters): UseUsersReturn {
    const userService = useService<IUserService>(TYPES.UserService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<UsersState>({
        users: [],
        total: 0,
        loading: true,
        error: null,
    })

    /**
     * Fetch users
     */
    const fetchUsers = useCallback(
        async (filters?: UserFilters) => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await userService.getUsers(filters)

                setState({
                    users: result.items,
                    total: result.total,
                    loading: false,
                    error: null,
                })
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error as Error,
                }))
                errorHandler.handle(error)
            }
        },
        [userService, errorHandler]
    )

    /**
     * Load users on mount and when filters change
     */
    const filtersKey = JSON.stringify(initialFilters)
    useEffect(() => {
        fetchUsers(initialFilters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchUsers, filtersKey])

    /**
     * Create user
     */
    const createUser = useCallback(
        async (data: CreateUserData): Promise<User> => {
            try {
                const user = await userService.createUser(data)

                // Refresh list after creation
                await fetchUsers(initialFilters)

                return user
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userService, errorHandler, fetchUsers, initialFilters]
    )

    /**
     * Update user
     */
    const updateUser = useCallback(
        async (id: string, data: UpdateUserData): Promise<User> => {
            try {
                const user = await userService.updateUser(id, data)

                // Refresh list after update
                await fetchUsers(initialFilters)

                return user
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userService, errorHandler, fetchUsers, initialFilters]
    )

    /**
     * Delete user
     */
    const deleteUser = useCallback(
        async (id: string): Promise<void> => {
            try {
                await userService.deleteUser(id)

                // Refresh list after deletion
                await fetchUsers(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userService, errorHandler, fetchUsers, initialFilters]
    )

    /**
     * Activate user
     */
    const activateUser = useCallback(
        async (id: string): Promise<void> => {
            try {
                await userService.activateUser(id)

                // Refresh list
                await fetchUsers(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userService, errorHandler, fetchUsers, initialFilters]
    )

    /**
     * Suspend user
     */
    const suspendUser = useCallback(
        async (id: string, reason?: string): Promise<void> => {
            try {
                await userService.suspendUser(id, reason)

                // Refresh list
                await fetchUsers(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userService, errorHandler, fetchUsers, initialFilters]
    )

    return {
        ...state,
        refetch: fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        activateUser,
        suspendUser,
    }
}

/**
 * Hook to get a single user by ID
 */
export function useUser(id: string) {
    const userService = useService<IUserService>(TYPES.UserService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<{
        user: User | null
        loading: boolean
        error: Error | null
    }>({
        user: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        if (!id) {
            setState({ user: null, loading: false, error: null })
            return
        }

        let mounted = true

        const fetchUser = async () => {
            try {
                const user = await userService.getUserById(id)
                if (mounted) {
                    setState({ user, loading: false, error: null })
                }
            } catch (error) {
                if (mounted) {
                    setState({ user: null, loading: false, error: error as Error })
                    errorHandler.handle(error)
                }
            }
        }

        fetchUser()

        return () => {
            mounted = false
        }
    }, [id, userService, errorHandler])

    return state
}
