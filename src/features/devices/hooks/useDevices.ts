import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import { DeviceService } from '@features/devices/services/DeviceService'
import type { DeviceResponse } from '@core/repositories/DeviceRepository'
import type { ErrorHandler } from '@core/errors'

/**
 * Devices state
 */
interface DevicesState {
    devices: DeviceResponse[]
    loading: boolean
    error: Error | null
}

/**
 * Use devices hook return type
 */
interface UseDevicesReturn extends DevicesState {
    refetch: () => Promise<void>
    deleteDevice: (deviceId: string) => Promise<void>
}

/**
 * Custom hook for device management by tenant
 * Provides access to device list and delete operation
 *
 * @example
 * const { devices, loading, deleteDevice } = useDevices(tenantId)
 */
export function useDevices(tenantId: string): UseDevicesReturn {
    const deviceService = useService<DeviceService>(TYPES.DeviceService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<DevicesState>({
        devices: [],
        loading: true,
        error: null,
    })

    /**
     * Fetch devices for tenant
     */
    const fetchDevices = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        try {
            const devices = await deviceService.listDevices(tenantId)

            setState({
                devices,
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
    }, [deviceService, errorHandler, tenantId])

    /**
     * Load devices on mount
     */
    useEffect(() => {
        if (!tenantId) {
            setState({ devices: [], loading: false, error: null })
            return
        }

        fetchDevices()
    }, [fetchDevices, tenantId])

    /**
     * Delete device and auto-refresh list
     */
    const deleteDevice = useCallback(
        async (deviceId: string): Promise<void> => {
            try {
                await deviceService.deleteDevice(tenantId, deviceId)

                // Refresh list after deletion
                await fetchDevices()
            } catch (error) {
                errorHandler.handle(error)
                // P1-FE-6: surface in hook state for inline <Alert>.
                setState((prev) => ({ ...prev, error: error as Error }))
                throw error
            }
        },
        [deviceService, errorHandler, fetchDevices, tenantId]
    )

    return {
        ...state,
        refetch: fetchDevices,
        deleteDevice,
    }
}

/**
 * User devices state
 */
interface UserDevicesState {
    devices: DeviceResponse[]
    loading: boolean
    error: Error | null
}

/**
 * Use user devices hook return type
 */
interface UseUserDevicesReturn extends UserDevicesState {
    refetch: () => Promise<void>
}

/**
 * Custom hook for device management by user
 * Provides access to a specific user's device list
 *
 * @example
 * const { devices, loading, refetch } = useUserDevices(userId)
 */
export function useUserDevices(userId: string): UseUserDevicesReturn {
    const deviceService = useService<DeviceService>(TYPES.DeviceService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<UserDevicesState>({
        devices: [],
        loading: true,
        error: null,
    })

    /**
     * Fetch devices for user
     */
    const fetchDevices = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        try {
            const devices = await deviceService.listUserDevices(userId)

            setState({
                devices,
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
    }, [deviceService, errorHandler, userId])

    /**
     * Load devices on mount
     */
    useEffect(() => {
        if (!userId) {
            setState({ devices: [], loading: false, error: null })
            return
        }

        fetchDevices()
    }, [fetchDevices, userId])

    return {
        ...state,
        refetch: fetchDevices,
    }
}
