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
     * List all devices for a tenant
     */
    async listDevices(tenantId: string): Promise<DeviceResponse[]> {
        try {
            this.logger.debug('Fetching devices', { tenantId })

            const response = await this.httpClient.get<DeviceResponse[]>(
                `/tenants/${tenantId}/devices`
            )

            this.logger.debug('Devices fetched', { count: response.data.length })
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch devices', error)
            throw error
        }
    }

    /**
     * Get a single device by ID
     */
    async getDevice(tenantId: string, deviceId: string): Promise<DeviceResponse> {
        try {
            this.logger.debug(`Fetching device ${deviceId}`, { tenantId })

            const response = await this.httpClient.get<DeviceResponse>(
                `/tenants/${tenantId}/devices/${deviceId}`
            )

            return response.data
        } catch (error) {
            this.logger.error(`Failed to fetch device ${deviceId}`, error)
            throw error
        }
    }

    /**
     * Delete a device
     */
    async deleteDevice(tenantId: string, deviceId: string): Promise<void> {
        try {
            this.logger.info(`Deleting device ${deviceId}`, { tenantId })

            await this.httpClient.delete(`/tenants/${tenantId}/devices/${deviceId}`)

            this.logger.info('Device deleted successfully', { deviceId })
        } catch (error) {
            this.logger.error(`Failed to delete device ${deviceId}`, error)
            throw error
        }
    }
}
