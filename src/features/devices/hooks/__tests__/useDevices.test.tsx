import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useDevices, useUserDevices } from '../useDevices'
import { DependencyProvider } from '@app/providers'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import type { DeviceResponse } from '@core/repositories/DeviceRepository'

describe('useDevices', () => {
    let container: Container
    let mockDeviceService: {
        listDevices: ReturnType<typeof vi.fn>
        deleteDevice: ReturnType<typeof vi.fn>
        listUserDevices: ReturnType<typeof vi.fn>
    }
    let mockErrorHandler: {
        handle: ReturnType<typeof vi.fn>
    }

    const mockDevices: DeviceResponse[] = [
        {
            id: 'dev-1',
            userId: 'user-1',
            deviceName: 'Pixel 7',
            platform: 'Android',
            fingerprint: 'fp-1',
            lastUsed: '2026-04-01',
            createdAt: '2026-01-01',
        },
        {
            id: 'dev-2',
            userId: 'user-2',
            deviceName: 'MacBook Pro',
            platform: 'Desktop',
            fingerprint: 'fp-2',
            lastUsed: '2026-04-03',
            createdAt: '2026-02-01',
        },
    ]

    const createWrapper = () => {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return (
                <DependencyProvider container={container}>
                    {children}
                </DependencyProvider>
            )
        }
    }

    beforeEach(() => {
        mockDeviceService = {
            listDevices: vi.fn().mockResolvedValue(mockDevices),
            deleteDevice: vi.fn().mockResolvedValue(undefined),
            listUserDevices: vi.fn().mockResolvedValue(mockDevices),
        }

        mockErrorHandler = {
            handle: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.DeviceService).toConstantValue(mockDeviceService)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)
    })

    it('should load devices on mount', async () => {
        const { result } = renderHook(() => useDevices('tenant-1'), {
            wrapper: createWrapper(),
        })

        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.devices).toEqual(mockDevices)
        expect(result.current.error).toBeNull()
        expect(mockDeviceService.listDevices).toHaveBeenCalledWith('tenant-1')
    })

    it('should handle empty tenantId', async () => {
        const { result } = renderHook(() => useDevices(''), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.devices).toEqual([])
        expect(mockDeviceService.listDevices).not.toHaveBeenCalled()
    })

    it('should handle load error', async () => {
        const error = new Error('Network error')
        mockDeviceService.listDevices.mockRejectedValue(error)

        const { result } = renderHook(() => useDevices('tenant-1'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toBe(error)
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
    })

    it('should delete device and refetch', async () => {
        const { result } = renderHook(() => useDevices('tenant-1'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.deleteDevice('dev-1')
        })

        expect(mockDeviceService.deleteDevice).toHaveBeenCalledWith('tenant-1', 'dev-1')
        // listDevices called: once on mount + once after delete
        expect(mockDeviceService.listDevices).toHaveBeenCalledTimes(2)
    })

    it('should handle delete error', async () => {
        const deleteError = new Error('Delete failed')
        mockDeviceService.deleteDevice.mockRejectedValue(deleteError)

        const { result } = renderHook(() => useDevices('tenant-1'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            try {
                await result.current.deleteDevice('dev-1')
            } catch {
                // expected
            }
        })

        expect(mockErrorHandler.handle).toHaveBeenCalledWith(deleteError)
    })
})

describe('useUserDevices', () => {
    let container: Container
    let mockDeviceService: {
        listDevices: ReturnType<typeof vi.fn>
        deleteDevice: ReturnType<typeof vi.fn>
        listUserDevices: ReturnType<typeof vi.fn>
    }
    let mockErrorHandler: {
        handle: ReturnType<typeof vi.fn>
    }

    const mockDevices: DeviceResponse[] = [
        {
            id: 'dev-1',
            userId: 'user-1',
            deviceName: 'Pixel 7',
            platform: 'Android',
            fingerprint: 'fp-1',
            lastUsed: '2026-04-01',
            createdAt: '2026-01-01',
        },
    ]

    const createWrapper = () => {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return (
                <DependencyProvider container={container}>
                    {children}
                </DependencyProvider>
            )
        }
    }

    beforeEach(() => {
        mockDeviceService = {
            listDevices: vi.fn().mockResolvedValue([]),
            deleteDevice: vi.fn().mockResolvedValue(undefined),
            listUserDevices: vi.fn().mockResolvedValue(mockDevices),
        }

        mockErrorHandler = {
            handle: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.DeviceService).toConstantValue(mockDeviceService)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)
    })

    it('should load user devices on mount', async () => {
        const { result } = renderHook(() => useUserDevices('user-1'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.devices).toEqual(mockDevices)
        expect(mockDeviceService.listUserDevices).toHaveBeenCalledWith('user-1')
    })

    it('should handle empty userId', async () => {
        const { result } = renderHook(() => useUserDevices(''), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.devices).toEqual([])
        expect(mockDeviceService.listUserDevices).not.toHaveBeenCalled()
    })
})
