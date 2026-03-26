import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useTenants, useTenant } from '../useTenants'
import { createTestContainer } from '@test/testUtils'
import type { ITenantService } from '@domain/interfaces/ITenantService'
import type { ErrorHandler } from '@core/errors'
import { Tenant, TenantStatus } from '@domain/models/Tenant'

describe('useTenants', () => {
    let container: Container
    let mockTenantService: jest.Mocked<ITenantService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test data
    const testTenants = [
        new Tenant('1', 'Tenant One', 'tenant-one', 'Desc', 'a@b.com', '123', TenantStatus.ACTIVE, 100, 50, true, 30, 7, false, new Date(), new Date()),
        new Tenant('2', 'Tenant Two', 'tenant-two', 'Desc', 'c@d.com', '456', TenantStatus.TRIAL, 50, 10, true, 30, 7, false, new Date(), new Date()),
    ]

    beforeEach(() => {
        container = createTestContainer()
        mockTenantService = container.get<ITenantService>(TYPES.TenantService) as jest.Mocked<ITenantService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockTenantService.getTenants = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            const { result } = renderHook(() => useTenants(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.tenants).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('successful tenants fetch on mount', () => {
        it('should fetch tenants successfully on mount', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for tenants to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.tenants).toEqual(testTenants)
            expect(result.current.total).toBe(2)
            expect(result.current.error).toBeNull()
            expect(mockTenantService.getTenants).toHaveBeenCalledTimes(1)
            expect(mockTenantService.getTenants).toHaveBeenCalledWith(undefined)
        })

        it('should fetch empty list successfully', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: [],
                total: 0,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.tenants).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('error handling', () => {
        it('should handle initial fetch error', async () => {
            const error = new Error('Failed to fetch tenants')
            mockTenantService.getTenants = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.tenants).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })

        it('should set loading to false after error', async () => {
            const error = new Error('Fetch error')
            mockTenantService.getTenants = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('createTenant success and auto-refresh', () => {
        it('should create tenant and auto-refresh the list', async () => {
            // Initial fetch
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const newTenant = new Tenant('3', 'Tenant Three', 'tenant-three', 'New', 'e@f.com', '789', TenantStatus.ACTIVE, 200, 0, true, 30, 7, false, new Date(), new Date())

            // Setup create and refresh
            mockTenantService.createTenant = vi.fn().mockResolvedValue(newTenant)
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: [...testTenants, newTenant],
                total: 3,
            })

            const createData = {
                name: 'Tenant Three',
                slug: 'tenant-three',
                description: 'New',
                contactEmail: 'e@f.com',
                contactPhone: '789',
                maxUsers: 200,
            }

            const createdTenant = await result.current.createTenant(createData)

            expect(createdTenant).toEqual(newTenant)
            expect(mockTenantService.createTenant).toHaveBeenCalledWith(createData)

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.tenants).toEqual([...testTenants, newTenant])
            })

            expect(result.current.total).toBe(3)
            expect(mockTenantService.getTenants).toHaveBeenCalled()
        })

        it('should handle create failure and call error handler', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Failed to create tenant')
            mockTenantService.createTenant = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const createData = {
                name: 'Bad Tenant',
                slug: 'bad',
                maxUsers: 10,
            }

            await expect(result.current.createTenant(createData)).rejects.toThrow('Failed to create tenant')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
            // List should not change on error
            expect(result.current.tenants).toEqual(testTenants)
        })
    })

    describe('deleteTenant success and auto-refresh', () => {
        it('should delete tenant and auto-refresh the list', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockTenantService.deleteTenant = vi.fn().mockResolvedValue(undefined)
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: [testTenants[1]],
                total: 1,
            })

            await result.current.deleteTenant('1')

            expect(mockTenantService.deleteTenant).toHaveBeenCalledWith('1')

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.tenants).toEqual([testTenants[1]])
            })

            expect(result.current.total).toBe(1)
        })

        it('should handle delete failure and call error handler', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Delete failed')
            mockTenantService.deleteTenant = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.deleteTenant('1')).rejects.toThrow('Delete failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('activateTenant', () => {
        it('should activate tenant and auto-refresh', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const activatedTenant = new Tenant('2', 'Tenant Two', 'tenant-two', 'Desc', 'c@d.com', '456', TenantStatus.ACTIVE, 50, 10, true, 30, 7, false, new Date(), new Date())

            mockTenantService.activateTenant = vi.fn().mockResolvedValue(activatedTenant)
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: [testTenants[0], activatedTenant],
                total: 2,
            })

            const returnedTenant = await result.current.activateTenant('2')

            expect(returnedTenant).toEqual(activatedTenant)
            expect(mockTenantService.activateTenant).toHaveBeenCalledWith('2')
            expect(mockTenantService.getTenants).toHaveBeenCalled()
        })

        it('should handle activate failure', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Activation failed')
            mockTenantService.activateTenant = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.activateTenant('2')).rejects.toThrow('Activation failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('suspendTenant', () => {
        it('should suspend tenant and auto-refresh', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const suspendedTenant = new Tenant('1', 'Tenant One', 'tenant-one', 'Desc', 'a@b.com', '123', TenantStatus.SUSPENDED, 100, 50, true, 30, 7, false, new Date(), new Date())

            mockTenantService.suspendTenant = vi.fn().mockResolvedValue(suspendedTenant)
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: [suspendedTenant, testTenants[1]],
                total: 2,
            })

            const returnedTenant = await result.current.suspendTenant('1')

            expect(returnedTenant).toEqual(suspendedTenant)
            expect(mockTenantService.suspendTenant).toHaveBeenCalledWith('1')
            expect(mockTenantService.getTenants).toHaveBeenCalled()
        })

        it('should handle suspend failure', async () => {
            mockTenantService.getTenants = vi.fn().mockResolvedValue({
                items: testTenants,
                total: 2,
            })

            const { result } = renderHook(() => useTenants(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Suspension failed')
            mockTenantService.suspendTenant = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.suspendTenant('1')).rejects.toThrow('Suspension failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })
})

describe('useTenant', () => {
    let container: Container
    let mockTenantService: jest.Mocked<ITenantService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    const testTenant = new Tenant('1', 'Tenant One', 'tenant-one', 'Desc', 'a@b.com', '123', TenantStatus.ACTIVE, 100, 50, true, 30, 7, false, new Date(), new Date())

    beforeEach(() => {
        container = createTestContainer()
        mockTenantService = container.get<ITenantService>(TYPES.TenantService) as jest.Mocked<ITenantService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    it('should fetch single tenant by id', async () => {
        mockTenantService.getTenantById = vi.fn().mockResolvedValue(testTenant)

        const { result } = renderHook(() => useTenant('1'), { wrapper })

        // Initially loading
        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.tenant).toEqual(testTenant)
        expect(result.current.error).toBeNull()
        expect(mockTenantService.getTenantById).toHaveBeenCalledWith('1')
    })

    it('should set loading false and tenant null when id is empty', async () => {
        const { result } = renderHook(() => useTenant(''), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.tenant).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('should handle fetch error', async () => {
        const error = new Error('Tenant not found')
        mockTenantService.getTenantById = vi.fn().mockRejectedValue(error)
        mockErrorHandler.handle = vi.fn()

        const { result } = renderHook(() => useTenant('999'), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.tenant).toBeNull()
        expect(result.current.error).toEqual(error)
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
    })
})
