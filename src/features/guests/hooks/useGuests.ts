import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import { GuestService } from '@features/guests/services/GuestService'
import type { GuestInvitation, InviteGuestData, ExtendGuestData, GuestFilters } from '@domain/interfaces/IGuestRepository'
import type { ErrorHandler } from '@core/errors'

/**
 * Guests state
 */
interface GuestsState {
    guests: GuestInvitation[]
    activeCount: number
    loading: boolean
    error: Error | null
}

/**
 * Use guests hook return type
 */
interface UseGuestsReturn extends GuestsState {
    refetch: (filters?: GuestFilters) => Promise<void>
    inviteGuest: (data: InviteGuestData) => Promise<GuestInvitation>
    extendAccess: (guestId: string, data: ExtendGuestData) => Promise<void>
    revokeAccess: (guestId: string) => Promise<void>
}

/**
 * Custom hook for guest invitation management
 * Provides access to guest list and CRUD operations
 *
 * @example
 * const { guests, loading, inviteGuest, revokeAccess } = useGuests()
 */
export function useGuests(initialFilters?: GuestFilters): UseGuestsReturn {
    const guestService = useService<GuestService>(TYPES.GuestService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<GuestsState>({
        guests: [],
        activeCount: 0,
        loading: true,
        error: null,
    })

    /**
     * Fetch guests with optional filters
     */
    const fetchGuests = useCallback(
        async (filters?: GuestFilters) => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const [guests, activeCount] = await Promise.all([
                    guestService.listGuests(filters),
                    guestService.getActiveCount(),
                ])

                setState({
                    guests,
                    activeCount,
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
        [guestService, errorHandler]
    )

    /**
     * Load guests on mount and when filters change
     */
    useEffect(() => {
        fetchGuests(initialFilters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchGuests, JSON.stringify(initialFilters)])

    /**
     * Invite a guest
     */
    const inviteGuest = useCallback(
        async (data: InviteGuestData): Promise<GuestInvitation> => {
            try {
                const guest = await guestService.inviteGuest(data)

                // Refresh list after invitation
                await fetchGuests(initialFilters)

                return guest
            } catch (error) {
                errorHandler.handle(error)
                // P1-FE-6: surface in hook state for inline <Alert>.
                setState((prev) => ({ ...prev, error: error as Error }))
                throw error
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [guestService, errorHandler, fetchGuests, JSON.stringify(initialFilters)]
    )

    /**
     * Extend a guest's access period
     */
    const extendAccess = useCallback(
        async (guestId: string, data: ExtendGuestData): Promise<void> => {
            try {
                await guestService.extendAccess(guestId, data)

                // Refresh list after extension
                await fetchGuests(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                // P1-FE-6: surface in hook state for inline <Alert>.
                setState((prev) => ({ ...prev, error: error as Error }))
                throw error
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [guestService, errorHandler, fetchGuests, JSON.stringify(initialFilters)]
    )

    /**
     * Revoke a guest's access
     */
    const revokeAccess = useCallback(
        async (guestId: string): Promise<void> => {
            try {
                await guestService.revokeAccess(guestId)

                // Refresh list after revocation
                await fetchGuests(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                // P1-FE-6: surface in hook state for inline <Alert>.
                setState((prev) => ({ ...prev, error: error as Error }))
                throw error
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [guestService, errorHandler, fetchGuests, JSON.stringify(initialFilters)]
    )

    return {
        ...state,
        refetch: fetchGuests,
        inviteGuest,
        extendAccess,
        revokeAccess,
    }
}
