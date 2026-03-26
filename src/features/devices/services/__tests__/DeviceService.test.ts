import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DeviceService } from '../DeviceService'
import type { DeviceResponse } from '@core/repositories/DeviceRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

describe('DeviceService', () => {
    let deviceService: DeviceService
    let mockDeviceRepository: {
        listDevices: ReturnType<typeof vi.fn>
        listUserDevices: ReturnType<typeof vi.fn>
        deleteDevice: ReturnType<typeof vi.fn>
    }
    let mockLogger: ILogger

    const mockDevice: DeviceResponse = {
        id: 'device-1',
        name: 'iPhone 15',
        fingerprint: 'abc123',
        platform: 'iOS',
        lastUsed: '2024-01-01',
        createdAt: '2024-01-01',
        isTrusted: true,
    }

    beforeEach(() => {
        // Create mock repository
        mockDeviceRepository = {
            listDevices: vi.fn(),
            listUserDevices: vi.fn(),
            deleteDevice: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        deviceService = new DeviceService(mockDeviceRepository as any, mockLogger)
    })

    describe('listDevices', () => {
        it('should list devices for a tenant successfully', async () => {
            // Arrange
            vi.mocked(mockDeviceRepository.listDevices).mockResolvedValue([mockDevice])

            // Act
            const result = await deviceService.listDevices('tenant-1')

            // Assert
            expect(mockDeviceRepository.listDevices).toHaveBeenCalledWith('tenant-1')
            expect(result).toEqual([mockDevice])
        })

        it('should return empty array when no devices exist', async () => {
            // Arrange
            vi.mocked(mockDeviceRepository.listDevices).mockResolvedValue([])

            // Act
            const result = await deviceService.listDevices('tenant-1')

            // Assert
            expect(mockDeviceRepository.listDevices).toHaveBeenCalledWith('tenant-1')
            expect(result).toEqual([])
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockDeviceRepository.listDevices).mockRejectedValue(error)

            // Act & Assert
            await expect(deviceService.listDevices('tenant-1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to list devices', error)
        })
    })

    describe('listUserDevices', () => {
        it('should list devices for a user successfully', async () => {
            // Arrange
            vi.mocked(mockDeviceRepository.listUserDevices).mockResolvedValue([mockDevice])

            // Act
            const result = await deviceService.listUserDevices('user-1')

            // Assert
            expect(mockDeviceRepository.listUserDevices).toHaveBeenCalledWith('user-1')
            expect(result).toEqual([mockDevice])
        })

        it('should return empty array when user has no devices', async () => {
            // Arrange
            vi.mocked(mockDeviceRepository.listUserDevices).mockResolvedValue([])

            // Act
            const result = await deviceService.listUserDevices('user-1')

            // Assert
            expect(mockDeviceRepository.listUserDevices).toHaveBeenCalledWith('user-1')
            expect(result).toEqual([])
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockDeviceRepository.listUserDevices).mockRejectedValue(error)

            // Act & Assert
            await expect(deviceService.listUserDevices('user-1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to list devices for user user-1', error)
        })
    })

    describe('deleteDevice', () => {
        it('should delete device successfully', async () => {
            // Arrange
            vi.mocked(mockDeviceRepository.deleteDevice).mockResolvedValue(undefined)

            // Act
            await deviceService.deleteDevice('tenant-1', 'device-1')

            // Assert
            expect(mockLogger.info).toHaveBeenCalledWith('Deleting device device-1')
            expect(mockDeviceRepository.deleteDevice).toHaveBeenCalledWith('tenant-1', 'device-1')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockDeviceRepository.deleteDevice).mockRejectedValue(error)

            // Act & Assert
            await expect(deviceService.deleteDevice('tenant-1', 'device-1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete device device-1', error)
        })
    })
})
