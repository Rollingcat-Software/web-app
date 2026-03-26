import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IGuestRepository, GuestInvitation, InviteGuestData, ExtendGuestData, GuestFilters } from '@domain/interfaces/IGuestRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Guest Service
 * Handles guest invitation business logic
 */
@injectable()
export class GuestService {
    constructor(
        @inject(TYPES.GuestRepository) private readonly guestRepository: IGuestRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * List guest invitations with optional filters
     */
    async listGuests(filters?: GuestFilters): Promise<GuestInvitation[]> {
        try {
            return await this.guestRepository.listGuests(filters)
        } catch (error) {
            this.logger.error('Failed to list guests', error)
            throw error
        }
    }

    /**
     * Get active guest count
     */
    async getActiveCount(): Promise<number> {
        try {
            return await this.guestRepository.getActiveCount()
        } catch (error) {
            this.logger.error('Failed to get active guest count', error)
            throw error
        }
    }

    /**
     * Invite a guest
     */
    async inviteGuest(data: InviteGuestData): Promise<GuestInvitation> {
        try {
            this.logger.info('Inviting guest', { email: data.email })
            return await this.guestRepository.inviteGuest(data)
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
            await this.guestRepository.extendAccess(guestId, data)
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
            await this.guestRepository.revokeAccess(guestId)
        } catch (error) {
            this.logger.error(`Failed to revoke guest access ${guestId}`, error)
            throw error
        }
    }
}
