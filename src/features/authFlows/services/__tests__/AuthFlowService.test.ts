import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthFlowService } from '../AuthFlowService'
import type { AuthFlowResponse, CreateAuthFlowCommand } from '@core/repositories/AuthFlowRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

describe('AuthFlowService', () => {
    let authFlowService: AuthFlowService
    let mockAuthFlowRepository: {
        listFlows: ReturnType<typeof vi.fn>
        getFlow: ReturnType<typeof vi.fn>
        createFlow: ReturnType<typeof vi.fn>
        deleteFlow: ReturnType<typeof vi.fn>
    }
    let mockLogger: ILogger

    const mockFlow: AuthFlowResponse = {
        id: '1',
        tenantId: 'tenant-1',
        name: 'Default Flow',
        steps: [],
        stepCount: 2,
        active: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
    }

    beforeEach(() => {
        // Create mock repository
        mockAuthFlowRepository = {
            listFlows: vi.fn(),
            getFlow: vi.fn(),
            createFlow: vi.fn(),
            deleteFlow: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        authFlowService = new AuthFlowService(mockAuthFlowRepository as any, mockLogger)
    })

    describe('getFlows', () => {
        it('should get flows for a tenant successfully', async () => {
            // Arrange
            vi.mocked(mockAuthFlowRepository.listFlows).mockResolvedValue([mockFlow])

            // Act
            const result = await authFlowService.getFlows('tenant-1')

            // Assert
            expect(mockAuthFlowRepository.listFlows).toHaveBeenCalledWith('tenant-1')
            expect(result).toEqual([mockFlow])
        })

        it('should return empty array when no flows exist', async () => {
            // Arrange
            vi.mocked(mockAuthFlowRepository.listFlows).mockResolvedValue([])

            // Act
            const result = await authFlowService.getFlows('tenant-1')

            // Assert
            expect(mockAuthFlowRepository.listFlows).toHaveBeenCalledWith('tenant-1')
            expect(result).toEqual([])
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockAuthFlowRepository.listFlows).mockRejectedValue(error)

            // Act & Assert
            await expect(authFlowService.getFlows('tenant-1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get auth flows', error)
        })
    })

    describe('getFlowById', () => {
        it('should get flow by ID successfully', async () => {
            // Arrange
            vi.mocked(mockAuthFlowRepository.getFlow).mockResolvedValue(mockFlow)

            // Act
            const result = await authFlowService.getFlowById('tenant-1', '1')

            // Assert
            expect(mockAuthFlowRepository.getFlow).toHaveBeenCalledWith('tenant-1', '1')
            expect(result).toEqual(mockFlow)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Flow not found')
            vi.mocked(mockAuthFlowRepository.getFlow).mockRejectedValue(error)

            // Act & Assert
            await expect(authFlowService.getFlowById('tenant-1', '999')).rejects.toThrow('Flow not found')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get auth flow 999', error)
        })
    })

    describe('createFlow', () => {
        const validCommand: CreateAuthFlowCommand = {
            name: 'New Flow',
            steps: [],
            active: true,
        }

        it('should create flow successfully', async () => {
            // Arrange
            const createdFlow: AuthFlowResponse = {
                ...mockFlow,
                id: '2',
                name: 'New Flow',
            }
            vi.mocked(mockAuthFlowRepository.createFlow).mockResolvedValue(createdFlow)

            // Act
            const result = await authFlowService.createFlow('tenant-1', validCommand)

            // Assert
            expect(mockLogger.info).toHaveBeenCalledWith('Creating auth flow', { name: validCommand.name })
            expect(mockAuthFlowRepository.createFlow).toHaveBeenCalledWith('tenant-1', validCommand)
            expect(result).toEqual(createdFlow)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockAuthFlowRepository.createFlow).mockRejectedValue(error)

            // Act & Assert
            await expect(authFlowService.createFlow('tenant-1', validCommand)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to create auth flow', error)
        })
    })

    describe('deleteFlow', () => {
        it('should delete flow successfully', async () => {
            // Arrange
            vi.mocked(mockAuthFlowRepository.deleteFlow).mockResolvedValue(undefined)

            // Act
            await authFlowService.deleteFlow('tenant-1', '1')

            // Assert
            expect(mockLogger.info).toHaveBeenCalledWith('Deleting auth flow 1')
            expect(mockAuthFlowRepository.deleteFlow).toHaveBeenCalledWith('tenant-1', '1')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockAuthFlowRepository.deleteFlow).mockRejectedValue(error)

            // Act & Assert
            await expect(authFlowService.deleteFlow('tenant-1', '1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete auth flow 1', error)
        })
    })
})
