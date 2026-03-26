import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IGuestRepository,
    GuestInvitation,
    InviteGuestData,
    ExtendGuestData,
    GuestFilters,
} from '@domain/interfaces/IGuestRepository'

/**
 * Guest Repository
 * Handles guest invitation API calls
 */
@injectable()
export class GuestRepository implements IGuestRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * List guest invitations with optional status filter
     */
    async listGuests(filters?: GuestFilters): Promise<GuestInvitation[]> {
        try {
            this.logger.debug('Fetching guests', { filters })

            const params: Record<string, unknown> = {}
            if (filters?.status) params.status = filters.status

            const response = await this.httpClient.get<GuestInvitation[]>('/guests', { params })

            this.logger.debug('Guests fetched', { count: response.data.length })
            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch guests', error)
            throw error
        }
    }

    /**
     * Get active guest count
     */
    async getActiveCount(): Promise<number> {
        try {
            this.logger.debug('Fetching active guest count')

            const response = await this.httpClient.get<number>('/guests/count')

            return response.data
        } catch (error) {
            this.logger.error('Failed to fetch guest count', error)
            throw error
        }
    }

    /**
     * Invite a guest
     */
    async inviteGuest(data: InviteGuestData): Promise<GuestInvitation> {
        try {
            this.logger.info('Inviting guest', { email: data.email })

            const response = await this.httpClient.post<GuestInvitation>('/guests/invite', data)

            this.logger.info('Guest invited successfully', { email: data.email })
            return response.data
        } catch (error) {
            this.logger.error('Failed to invite guest', error)
            throw error
        }
    }

    /**
     * Extend a guest's access period
     */
    async extendAccess(guestId: string, data: ExtendGuestData): Promise<void> {
        try {
            this.logger.info(`Extending guest access ${guestId}`)

            await this.httpClient.post(`/guests/${guestId}/extend`, data)

            this.logger.info('Guest access extended successfully', { guestId })
        } catch (error) {
            this.logger.error(`Failed to extend guest access ${guestId}`, error)
            throw error
        }
    }

    /**
     * Revoke a guest's access
     */
    async revokeAccess(guestId: string): Promise<void> {
        try {
            this.logger.info(`Revoking guest access ${guestId}`)

            await this.httpClient.post(`/guests/${guestId}/revoke`)

            this.logger.info('Guest access revoked successfully', { guestId })
        } catch (error) {
            this.logger.error(`Failed to revoke guest access ${guestId}`, error)
            throw error
        }
    }
}
