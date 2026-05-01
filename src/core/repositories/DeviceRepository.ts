import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Device API Types
 */
export interface DeviceResponse {
    id: string
    userId: string
    deviceName: string
    platform: string
    fingerprint: string
    lastUsed: string
    createdAt: string
    capabilities?: string[]
    isTrusted?: boolean
}

/**
 * Device Repository
 * Handles device management API calls
 */
@injectable()
export class DeviceRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * List devices. Pass an empty string to list every tenant's devices
     * (backend honors this only for SUPER_ADMIN); pass a tenant UUID to
     * scope the listing to that tenant.
     */
    async listDevices(tenantId: string): Promise<DeviceResponse[]> {
        try {
            this.logger.debug('Fetching devices', { tenantId })

            const url = tenantId
                ? `/devices?tenantId=${tenantId}`
                : '/devices'

            const response = await this.httpClient.get<DeviceResponse[]>(url)

            this.logger.debug('Devices fetched', { count: response.data.length })
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch devices', error)
            throw error
        }
    }

    /**
     * List all devices for a specific user
     */
    async listUserDevices(userId: string): Promise<DeviceResponse[]> {
        try {
            this.logger.debug('Fetching user devices', { userId })

            const response = await this.httpClient.get<DeviceResponse[]>(
                `/devices?userId=${userId}`
            )

            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch user devices', error)
            throw error
        }
    }

    /**
     * Delete a device
     */
    async deleteDevice(_tenantId: string, deviceId: string): Promise<void> {
        try {
            this.logger.info(`Deleting device ${deviceId}`)

            await this.httpClient.delete(`/devices/${deviceId}`)

            this.logger.info('Device deleted successfully', { deviceId })
        } catch (error) {
            this.logger.error(`Failed to delete device ${deviceId}`, error)
            throw error
        }
    }
}
