import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TenantService } from '../TenantService'
import type { ITenantRepository, CreateTenantData, UpdateTenantData } from '@domain/interfaces/ITenantRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { Tenant, TenantStatus } from '@domain/models/Tenant'
import { ValidationError, NotFoundError } from '@core/errors'
import type { TenantFilters } from '@domain/interfaces/ITenantService'

describe('TenantService', () => {
    let tenantService: TenantService
    let mockTenantRepository: ITenantRepository
    let mockLogger: ILogger

    const mockTenant = new Tenant(
        '1',
        'Test Tenant',
        'test-tenant',
        'A test tenant',
        'contact@test.com',
        '+1234567890',
        TenantStatus.ACTIVE,
        100,
        5,
        true,
        30,
        7,
        false,
        new Date(),
        new Date()
    )

    beforeEach(() => {
        // Create mock repository
        mockTenantRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findBySlug: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            activate: vi.fn(),
            suspend: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        tenantService = new TenantService(mockTenantRepository, mockLogger)
    })

    describe('getTenants', () => {
        it('should get tenants with filters successfully', async () => {
            // Arrange
            const filters: TenantFilters = {
                status: TenantStatus.ACTIVE,
            }
            const mockResult: PaginatedResult<Tenant> = {
                items: [mockTenant],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockTenantRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await tenantService.getTenants(filters, 0, 20)

            // Assert
            expect(mockTenantRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: filters as Record<string, unknown>,
            })
            expect(result).toEqual(mockResult)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting tenants', {
                filters,
                page: 0,
                pageSize: 20,
            })
        })

        it('should get tenants without filters', async () => {
            // Arrange
            const mockResult: PaginatedResult<Tenant> = {
                items: [mockTenant],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockTenantRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await tenantService.getTenants()

            // Assert
            expect(mockTenantRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: undefined,
            })
            expect(result).toEqual(mockResult)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockTenantRepository.findAll).mockRejectedValue(error)

            // Act & Assert
            await expect(tenantService.getTenants()).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get tenants', error)
        })
    })

    describe('getTenantById', () => {
        it('should get tenant by ID when found', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(mockTenant)

            // Act
            const result = await tenantService.getTenantById('1')

            // Assert
            expect(mockTenantRepository.findById).toHaveBeenCalledWith('1')
            expect(result).toEqual(mockTenant)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting tenant 1')
        })

        it('should throw NotFoundError when tenant not found', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(tenantService.getTenantById('999')).rejects.toThrow(NotFoundError)
            await expect(tenantService.getTenantById('999')).rejects.toThrow('Tenant with ID 999 not found')
        })
    })

    describe('getTenantBySlug', () => {
        it('should get tenant by slug when found', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findBySlug).mockResolvedValue(mockTenant)

            // Act
            const result = await tenantService.getTenantBySlug('test-tenant')

            // Assert
            expect(mockTenantRepository.findBySlug).toHaveBeenCalledWith('test-tenant')
            expect(result).toEqual(mockTenant)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting tenant by slug: test-tenant')
        })

        it('should throw NotFoundError when slug not found', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findBySlug).mockResolvedValue(null)

            // Act & Assert
            await expect(tenantService.getTenantBySlug('nonexistent')).rejects.toThrow(NotFoundError)
            await expect(tenantService.getTenantBySlug('nonexistent')).rejects.toThrow(
                "Tenant with slug 'nonexistent' not found"
            )
        })
    })

    describe('createTenant', () => {
        const validCreateData: CreateTenantData = {
            name: 'New Tenant',
            slug: 'new-tenant',
            maxUsers: 50,
        }

        it('should create tenant with valid data', async () => {
            // Arrange
            const newTenant = new Tenant(
                '2',
                validCreateData.name,
                validCreateData.slug,
                '',
                '',
                '',
                TenantStatus.ACTIVE,
                validCreateData.maxUsers,
                0,
                true,
                30,
                7,
                false,
                new Date(),
                new Date()
            )

            vi.mocked(mockTenantRepository.create).mockResolvedValue(newTenant)

            // Act
            const result = await tenantService.createTenant(validCreateData)

            // Assert
            expect(mockTenantRepository.create).toHaveBeenCalledWith(validCreateData)
            expect(result).toEqual(newTenant)
            expect(mockLogger.info).toHaveBeenCalledWith('Creating new tenant', { name: validCreateData.name })
            expect(mockLogger.info).toHaveBeenCalledWith('Tenant created successfully', { tenantId: newTenant.id })
        })

        it('should throw ValidationError for missing name', async () => {
            // Arrange
            const invalidData = {
                ...validCreateData,
                name: '',
            } as CreateTenantData

            // Act & Assert
            await expect(tenantService.createTenant(invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.create).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for missing slug', async () => {
            // Arrange
            const invalidData = {
                ...validCreateData,
                slug: '',
            } as CreateTenantData

            // Act & Assert
            await expect(tenantService.createTenant(invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.create).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for negative maxUsers', async () => {
            // Arrange
            const invalidData: CreateTenantData = {
                ...validCreateData,
                maxUsers: -1,
            }

            // Act & Assert
            await expect(tenantService.createTenant(invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.create).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for undefined maxUsers', async () => {
            // Arrange
            const invalidData = {
                name: 'Test',
                slug: 'test',
            } as CreateTenantData

            // Act & Assert
            await expect(tenantService.createTenant(invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.create).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockTenantRepository.create).mockRejectedValue(error)

            // Act & Assert
            await expect(tenantService.createTenant(validCreateData)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to create tenant', error)
        })
    })

    describe('updateTenant', () => {
        const validUpdateData: UpdateTenantData = {
            name: 'Updated Tenant',
        }

        it('should update tenant successfully', async () => {
            // Arrange
            const updatedTenant = new Tenant(
                mockTenant.id,
                'Updated Tenant',
                mockTenant.slug,
                mockTenant.description,
                mockTenant.contactEmail,
                mockTenant.contactPhone,
                mockTenant.status,
                mockTenant.maxUsers,
                mockTenant.currentUsers,
                mockTenant.biometricEnabled,
                mockTenant.sessionTimeoutMinutes,
                mockTenant.refreshTokenValidityDays,
                mockTenant.mfaRequired,
                mockTenant.createdAt,
                new Date()
            )

            vi.mocked(mockTenantRepository.findById).mockResolvedValue(mockTenant)
            vi.mocked(mockTenantRepository.update).mockResolvedValue(updatedTenant)

            // Act
            const result = await tenantService.updateTenant('1', validUpdateData)

            // Assert
            expect(mockTenantRepository.findById).toHaveBeenCalledWith('1')
            expect(mockTenantRepository.update).toHaveBeenCalledWith('1', validUpdateData)
            expect(result).toEqual(updatedTenant)
            expect(mockLogger.info).toHaveBeenCalledWith('Updating tenant 1')
            expect(mockLogger.info).toHaveBeenCalledWith('Tenant updated successfully', { tenantId: updatedTenant.id })
        })

        it('should throw ValidationError for empty name', async () => {
            // Arrange
            const invalidData: UpdateTenantData = {
                name: '',
            }

            // Act & Assert
            await expect(tenantService.updateTenant('1', invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.findById).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for empty slug', async () => {
            // Arrange
            const invalidData: UpdateTenantData = {
                slug: '',
            }

            // Act & Assert
            await expect(tenantService.updateTenant('1', invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.findById).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for negative maxUsers', async () => {
            // Arrange
            const invalidData: UpdateTenantData = {
                maxUsers: -5,
            }

            // Act & Assert
            await expect(tenantService.updateTenant('1', invalidData)).rejects.toThrow(ValidationError)
            expect(mockTenantRepository.findById).not.toHaveBeenCalled()
        })

        it('should throw NotFoundError when tenant not found', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(tenantService.updateTenant('999', validUpdateData)).rejects.toThrow(NotFoundError)
            await expect(tenantService.updateTenant('999', validUpdateData)).rejects.toThrow(
                'Tenant with ID 999 not found'
            )
            expect(mockTenantRepository.update).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(mockTenant)
            vi.mocked(mockTenantRepository.update).mockRejectedValue(error)

            // Act & Assert
            await expect(tenantService.updateTenant('1', validUpdateData)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to update tenant 1', error)
        })
    })

    describe('deleteTenant', () => {
        it('should delete tenant successfully', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(mockTenant)
            vi.mocked(mockTenantRepository.delete).mockResolvedValue(undefined)

            // Act
            await tenantService.deleteTenant('1')

            // Assert
            expect(mockTenantRepository.findById).toHaveBeenCalledWith('1')
            expect(mockTenantRepository.delete).toHaveBeenCalledWith('1')
            expect(mockLogger.info).toHaveBeenCalledWith('Deleting tenant 1')
            expect(mockLogger.info).toHaveBeenCalledWith('Tenant deleted successfully', { tenantId: '1' })
        })

        it('should throw NotFoundError when tenant not found', async () => {
            // Arrange
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(tenantService.deleteTenant('999')).rejects.toThrow(NotFoundError)
            await expect(tenantService.deleteTenant('999')).rejects.toThrow('Tenant with ID 999 not found')
            expect(mockTenantRepository.delete).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockTenantRepository.findById).mockResolvedValue(mockTenant)
            vi.mocked(mockTenantRepository.delete).mockRejectedValue(error)

            // Act & Assert
            await expect(tenantService.deleteTenant('1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete tenant 1', error)
        })
    })

    describe('activateTenant', () => {
        it('should activate tenant successfully', async () => {
            // Arrange
            const activatedTenant = new Tenant(
                mockTenant.id,
                mockTenant.name,
                mockTenant.slug,
                mockTenant.description,
                mockTenant.contactEmail,
                mockTenant.contactPhone,
                TenantStatus.ACTIVE,
                mockTenant.maxUsers,
                mockTenant.currentUsers,
                mockTenant.biometricEnabled,
                mockTenant.sessionTimeoutMinutes,
                mockTenant.refreshTokenValidityDays,
                mockTenant.mfaRequired,
                mockTenant.createdAt,
                new Date()
            )

            vi.mocked(mockTenantRepository.activate).mockResolvedValue(activatedTenant)

            // Act
            const result = await tenantService.activateTenant('1')

            // Assert
            expect(mockTenantRepository.activate).toHaveBeenCalledWith('1')
            expect(result).toEqual(activatedTenant)
            expect(mockLogger.info).toHaveBeenCalledWith('Activating tenant 1')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockTenantRepository.activate).mockRejectedValue(error)

            // Act & Assert
            await expect(tenantService.activateTenant('1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to activate tenant 1', error)
        })
    })

    describe('suspendTenant', () => {
        it('should suspend tenant successfully', async () => {
            // Arrange
            const suspendedTenant = new Tenant(
                mockTenant.id,
                mockTenant.name,
                mockTenant.slug,
                mockTenant.description,
                mockTenant.contactEmail,
                mockTenant.contactPhone,
                TenantStatus.SUSPENDED,
                mockTenant.maxUsers,
                mockTenant.currentUsers,
                mockTenant.biometricEnabled,
                mockTenant.sessionTimeoutMinutes,
                mockTenant.refreshTokenValidityDays,
                mockTenant.mfaRequired,
                mockTenant.createdAt,
                new Date()
            )

            vi.mocked(mockTenantRepository.suspend).mockResolvedValue(suspendedTenant)

            // Act
            const result = await tenantService.suspendTenant('1')

            // Assert
            expect(mockTenantRepository.suspend).toHaveBeenCalledWith('1')
            expect(result).toEqual(suspendedTenant)
            expect(mockLogger.info).toHaveBeenCalledWith('Suspending tenant 1')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockTenantRepository.suspend).mockRejectedValue(error)

            // Act & Assert
            await expect(tenantService.suspendTenant('1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to suspend tenant 1', error)
        })
    })
})
