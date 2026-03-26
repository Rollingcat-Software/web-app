import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RoleService } from '../RoleService'
import type { IRoleRepository, CreateRoleData, UpdateRoleData } from '@domain/interfaces/IRoleRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { Role } from '@domain/models/Role'
import { Permission } from '@domain/models/Permission'
import { NotFoundError, BusinessError } from '@core/errors'

describe('RoleService', () => {
    let roleService: RoleService
    let mockRoleRepository: IRoleRepository
    let mockLogger: ILogger

    const mockPermission = new Permission(
        'perm-1',
        'View Users',
        'Can view user list',
        'users',
        'view'
    )

    const mockRole = new Role(
        '1',
        'Editor',
        'Can edit content',
        'tenant-1',
        false,
        true,
        [mockPermission],
        new Date(),
        new Date()
    )

    const mockSystemRole = new Role(
        '2',
        'SuperAdmin',
        'System administrator role',
        'tenant-1',
        true,
        true,
        [mockPermission],
        new Date(),
        new Date()
    )

    beforeEach(() => {
        // Create mock repository
        mockRoleRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByTenant: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            assignPermission: vi.fn(),
            revokePermission: vi.fn(),
            getAllPermissions: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        roleService = new RoleService(mockRoleRepository, mockLogger)
    })

    describe('getRoles', () => {
        it('should get all roles successfully', async () => {
            // Arrange
            const mockResult: PaginatedResult<Role> = {
                items: [mockRole],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockRoleRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await roleService.getRoles()

            // Assert
            expect(mockRoleRepository.findAll).toHaveBeenCalled()
            expect(result).toEqual(mockResult)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockRoleRepository.findAll).mockRejectedValue(error)

            // Act & Assert
            await expect(roleService.getRoles()).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get roles', error)
        })
    })

    describe('getRoleById', () => {
        it('should get role by ID when found', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockRole)

            // Act
            const result = await roleService.getRoleById('1')

            // Assert
            expect(mockRoleRepository.findById).toHaveBeenCalledWith('1')
            expect(result).toEqual(mockRole)
        })

        it('should throw NotFoundError when role not found', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(roleService.getRoleById('999')).rejects.toThrow(NotFoundError)
            await expect(roleService.getRoleById('999')).rejects.toThrow(
                'Role with ID 999 not found'
            )
        })
    })

    describe('getRolesByTenant', () => {
        it('should get roles by tenant ID', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findByTenant).mockResolvedValue([mockRole])

            // Act
            const result = await roleService.getRolesByTenant('tenant-1')

            // Assert
            expect(mockRoleRepository.findByTenant).toHaveBeenCalledWith('tenant-1')
            expect(result).toEqual([mockRole])
        })

        it('should return empty array when no roles for tenant', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findByTenant).mockResolvedValue([])

            // Act
            const result = await roleService.getRolesByTenant('tenant-999')

            // Assert
            expect(result).toEqual([])
        })
    })

    describe('createRole', () => {
        const validCreateData: CreateRoleData = {
            name: 'Viewer',
            description: 'Read-only access',
            tenantId: 'tenant-1',
            permissionIds: ['perm-1'],
        }

        it('should create role with valid data', async () => {
            // Arrange
            const newRole = new Role(
                '3',
                validCreateData.name,
                validCreateData.description!,
                validCreateData.tenantId,
                false,
                true,
                [mockPermission],
                new Date(),
                new Date()
            )

            vi.mocked(mockRoleRepository.create).mockResolvedValue(newRole)

            // Act
            const result = await roleService.createRole(validCreateData)

            // Assert
            expect(mockRoleRepository.create).toHaveBeenCalledWith(validCreateData)
            expect(result).toEqual(newRole)
            expect(mockLogger.info).toHaveBeenCalledWith('Creating role', {
                name: validCreateData.name,
            })
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockRoleRepository.create).mockRejectedValue(error)

            // Act & Assert
            await expect(roleService.createRole(validCreateData)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to create role', error)
        })
    })

    describe('updateRole', () => {
        const validUpdateData: UpdateRoleData = {
            name: 'Updated Editor',
            description: 'Updated description',
        }

        it('should update role successfully', async () => {
            // Arrange
            const updatedRole = new Role(
                mockRole.id,
                'Updated Editor',
                'Updated description',
                mockRole.tenantId,
                false,
                true,
                mockRole.permissions,
                mockRole.createdAt,
                new Date()
            )

            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockRole)
            vi.mocked(mockRoleRepository.update).mockResolvedValue(updatedRole)

            // Act
            const result = await roleService.updateRole('1', validUpdateData)

            // Assert
            expect(mockRoleRepository.findById).toHaveBeenCalledWith('1')
            expect(mockRoleRepository.update).toHaveBeenCalledWith('1', validUpdateData)
            expect(result).toEqual(updatedRole)
        })

        it('should throw NotFoundError when role not found', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(roleService.updateRole('999', validUpdateData)).rejects.toThrow(NotFoundError)
            await expect(roleService.updateRole('999', validUpdateData)).rejects.toThrow(
                'Role with ID 999 not found'
            )
            expect(mockRoleRepository.update).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when attempting to modify system role', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockSystemRole)

            // Act & Assert
            await expect(roleService.updateRole('2', validUpdateData)).rejects.toThrow(BusinessError)
            await expect(roleService.updateRole('2', validUpdateData)).rejects.toThrow(
                'Cannot modify system roles'
            )
            expect(mockRoleRepository.update).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockRole)
            vi.mocked(mockRoleRepository.update).mockRejectedValue(error)

            // Act & Assert
            await expect(roleService.updateRole('1', validUpdateData)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to update role 1', error)
        })
    })

    describe('deleteRole', () => {
        it('should delete role successfully', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockRole)
            vi.mocked(mockRoleRepository.delete).mockResolvedValue(undefined)

            // Act
            await roleService.deleteRole('1')

            // Assert
            expect(mockRoleRepository.findById).toHaveBeenCalledWith('1')
            expect(mockRoleRepository.delete).toHaveBeenCalledWith('1')
        })

        it('should throw NotFoundError when role not found', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(roleService.deleteRole('999')).rejects.toThrow(NotFoundError)
            await expect(roleService.deleteRole('999')).rejects.toThrow(
                'Role with ID 999 not found'
            )
            expect(mockRoleRepository.delete).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when attempting to delete system role', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockSystemRole)

            // Act & Assert
            await expect(roleService.deleteRole('2')).rejects.toThrow(BusinessError)
            await expect(roleService.deleteRole('2')).rejects.toThrow(
                'Cannot delete system roles'
            )
            expect(mockRoleRepository.delete).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockRoleRepository.findById).mockResolvedValue(mockRole)
            vi.mocked(mockRoleRepository.delete).mockRejectedValue(error)

            // Act & Assert
            await expect(roleService.deleteRole('1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete role 1', error)
        })
    })

    describe('assignPermission', () => {
        it('should assign permission to role successfully', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.assignPermission).mockResolvedValue(undefined)

            // Act
            await roleService.assignPermission('1', 'perm-1')

            // Assert
            expect(mockRoleRepository.assignPermission).toHaveBeenCalledWith('1', 'perm-1')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockRoleRepository.assignPermission).mockRejectedValue(error)

            // Act & Assert
            await expect(roleService.assignPermission('1', 'perm-1')).rejects.toThrow(
                'Database error'
            )
        })
    })

    describe('revokePermission', () => {
        it('should revoke permission from role successfully', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.revokePermission).mockResolvedValue(undefined)

            // Act
            await roleService.revokePermission('1', 'perm-1')

            // Assert
            expect(mockRoleRepository.revokePermission).toHaveBeenCalledWith('1', 'perm-1')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockRoleRepository.revokePermission).mockRejectedValue(error)

            // Act & Assert
            await expect(roleService.revokePermission('1', 'perm-1')).rejects.toThrow(
                'Database error'
            )
        })
    })

    describe('getPermissions', () => {
        it('should get all permissions successfully', async () => {
            // Arrange
            const permissions = [mockPermission]
            vi.mocked(mockRoleRepository.getAllPermissions).mockResolvedValue(permissions)

            // Act
            const result = await roleService.getPermissions()

            // Assert
            expect(mockRoleRepository.getAllPermissions).toHaveBeenCalled()
            expect(result).toEqual(permissions)
        })

        it('should return empty array when no permissions exist', async () => {
            // Arrange
            vi.mocked(mockRoleRepository.getAllPermissions).mockResolvedValue([])

            // Act
            const result = await roleService.getPermissions()

            // Assert
            expect(result).toEqual([])
        })
    })
})
