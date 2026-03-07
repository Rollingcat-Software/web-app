import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import { DeviceRepository, type DeviceResponse } from '@core/repositories/DeviceRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Device Service
 * Handles device management business logic
 */
@injectable()
export class DeviceService {
    constructor(
        @inject(TYPES.DeviceRepository) private readonly deviceRepository: DeviceRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async listDevices(tenantId: string): Promise<DeviceResponse[]> {
        try {
            return await this.deviceRepository.listDevices(tenantId)
        } catch (error) {
            this.logger.error('Failed to list devices', error)
            throw error
        }
    }

    async listUserDevices(userId: string): Promise<DeviceResponse[]> {
        try {
            return await this.deviceRepository.listUserDevices(userId)
        } catch (error) {
            this.logger.error(`Failed to list devices for user ${userId}`, error)
            throw error
        }
    }

    async deleteDevice(tenantId: string, deviceId: string): Promise<void> {
        try {
            this.logger.info(`Deleting device ${deviceId}`)
            await this.deviceRepository.deleteDevice(tenantId, deviceId)
        } catch (error) {
            this.logger.error(`Failed to delete device ${deviceId}`, error)
            throw error
        }
    }
}
