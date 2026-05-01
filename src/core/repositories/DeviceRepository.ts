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
     * List devices.
     *
     * Copilot post-merge round 5: previously the signature accepted
     * `tenantId: string` and treated `''` as a sentinel meaning
     * "platform-wide". That made it easy for call sites to accidentally
     * trigger a SUPER_ADMIN cross-tenant fetch when tenant context simply
     * hadn't loaded yet (e.g. DevicesPage on first paint with `user` still
     * null). Both forms below are now explicit:
     *   - `listDevices(tenantId)` with a non-empty UUID → tenant-scoped
     *   - `listDevices('', { crossTenant: true })` → platform-wide; backend
     *     still enforces SUPER_ADMIN. An empty `tenantId` without
     *     `crossTenant: true` is rejected so accidental empty strings can't
     *     dump the platform.
     *
     * The legacy single-arg shape with a non-empty tenantId is kept for
     * backwards compatibility with callers that pass a fully-resolved id.
     */
    async listDevices(
        tenantId: string,
        options: { crossTenant?: boolean } = {}
    ): Promise<DeviceResponse[]> {
        try {
            this.logger.debug('Fetching devices', { tenantId, crossTenant: !!options.crossTenant })

            if (!tenantId && !options.crossTenant) {
                throw new Error(
                    'listDevices: tenantId is required (pass { crossTenant: true } for SUPER_ADMIN platform-wide listing).'
                )
            }

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
