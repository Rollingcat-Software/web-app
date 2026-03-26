import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useRoles } from '../useRoles'
import type { IRoleService } from '@domain/interfaces/IRoleService'
import type { ErrorHandler } from '@core/errors'
import { Role } from '@domain/models/Role'
import { Permission } from '@domain/models/Permission'

describe('useRoles', () => {
    let container: Container
    let mockRoleService: jest.Mocked<IRoleService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test data
    const testRoles = [
        new Role('1', 'Admin', 'Admin role', 'tenant-1', true, true, [], new Date('2024-01-01'), new Date('2024-01-01')),
        new Role('2', 'User', 'User role', 'tenant-1', false, true, [], new Date('2024-01-02'), new Date('2024-01-02')),
    ]

    const testPermissions = [
        new Permission('1', 'Read Users', 'Read users', 'users', 'read'),
        new Permission('2', 'Write Users', 'Write users', 'users', 'write'),
    ]

    beforeEach(() => {
        mockRoleService = {
            getRoles: vi.fn(),
            getRoleById: vi.fn(),
            getRolesByTenant: vi.fn(),
            createRole: vi.fn(),
            updateRole: vi.fn(),
            deleteRole: vi.fn(),
            assignPermission: vi.fn(),
            revokePermission: vi.fn(),
            getPermissions: vi.fn(),
        }
        mockErrorHandler = { handle: vi.fn() } as unknown as jest.Mocked<ErrorHandler>

        container = new Container()
        container.bind(TYPES.RoleService).toConstantValue(mockRoleService)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockRoleService.getRoles.mockImplementation(() => new Promise(() => {})) // Never resolves
            mockRoleService.getPermissions.mockImplementation(() => new Promise(() => {}))

            const { result } = renderHook(() => useRoles(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.roles).toEqual([])
            expect(result.current.permissions).toEqual([])
            expect(result.current.error).toBeNull()
        })
    })

    describe('successful fetch on mount', () => {
        it('should fetch roles and permissions successfully on mount', async () => {
            mockRoleService.getRoles.mockResolvedValue({
                items: testRoles,
                total: 2,
            })
            mockRoleService.getPermissions.mockResolvedValue(testPermissions)

            const { result } = renderHook(() => useRoles(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for data to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.roles).toEqual(testRoles)
            expect(result.current.permissions).toEqual(testPermissions)
            expect(result.current.error).toBeNull()
            expect(mockRoleService.getRoles).toHaveBeenCalledTimes(1)
            expect(mockRoleService.getPermissions).toHaveBeenCalledTimes(1)
        })
    })

    describe('error handling', () => {
        it('should handle fetch error', async () => {
            const error = new Error('Failed to fetch roles')
            mockRoleService.getRoles.mockRejectedValue(error)
            mockRoleService.getPermissions.mockResolvedValue(testPermissions)

            const { result } = renderHook(() => useRoles(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.roles).toEqual([])
            expect(result.current.permissions).toEqual([])
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('createRole', () => {
        it('should create role and auto-refresh', async () => {
            mockRoleService.getRoles.mockResolvedValue({
                items: testRoles,
                total: 2,
            })
            mockRoleService.getPermissions.mockResolvedValue(testPermissions)

            const { result } = renderHook(() => useRoles(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const newRole = new Role(
                '3',
                'Moderator',
                'Moderator role',
                'tenant-1',
                false,
                true,
                [],
                new Date('2024-01-03'),
                new Date('2024-01-03')
            )

            mockRoleService.createRole.mockResolvedValue(newRole)
            mockRoleService.getRoles.mockResolvedValue({
                items: [...testRoles, newRole],
                total: 3,
            })

            const createData = { name: 'Moderator', description: 'Moderator role', tenantId: 'tenant-1' }
            const createdRole = await result.current.createRole(createData)

            expect(createdRole).toEqual(newRole)
            expect(mockRoleService.createRole).toHaveBeenCalledWith(createData)

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.roles).toEqual([...testRoles, newRole])
            })
        })
    })

    describe('deleteRole', () => {
        it('should delete role and auto-refresh', async () => {
            mockRoleService.getRoles.mockResolvedValue({
                items: testRoles,
                total: 2,
            })
            mockRoleService.getPermissions.mockResolvedValue(testPermissions)

            const { result } = renderHook(() => useRoles(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockRoleService.deleteRole.mockResolvedValue(undefined)
            mockRoleService.getRoles.mockResolvedValue({
                items: [testRoles[0]],
                total: 1,
            })

            await result.current.deleteRole('2')

            expect(mockRoleService.deleteRole).toHaveBeenCalledWith('2')

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.roles).toEqual([testRoles[0]])
            })
        })
    })

    describe('assignPermission', () => {
        it('should assign permission and auto-refresh', async () => {
            mockRoleService.getRoles.mockResolvedValue({
                items: testRoles,
                total: 2,
            })
            mockRoleService.getPermissions.mockResolvedValue(testPermissions)

            const { result } = renderHook(() => useRoles(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockRoleService.assignPermission.mockResolvedValue(undefined)

            const updatedRole = new Role(
                '2',
                'User',
                'User role',
                'tenant-1',
                false,
                true,
                [testPermissions[0]],
                new Date('2024-01-02'),
                new Date('2024-01-05')
            )
            mockRoleService.getRoles.mockResolvedValue({
                items: [testRoles[0], updatedRole],
                total: 2,
            })

            await result.current.assignPermission('2', '1')

            expect(mockRoleService.assignPermission).toHaveBeenCalledWith('2', '1')

            // Wait for auto-refresh
            await waitFor(() => {
                expect(mockRoleService.getRoles).toHaveBeenCalled()
            })
        })
    })
})
