/**
 * Guest Invitation model
 */
export interface GuestInvitation {
    id: string
    tenantId: string
    email: string
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
    invitedByEmail: string
    message?: string
    accessStartsAt?: string
    accessEndsAt?: string
    expiresAt: string
    extensionCount: number
    maxExtensions: number
    canExtend: boolean
    acceptedAt?: string
    createdAt: string
    guestUserId?: string
    guestFirstName?: string
    guestLastName?: string
}

/**
 * Invite guest request data
 */
export interface InviteGuestData {
    email: string
    accessDurationHours: number
    message?: string
}

/**
 * Extend guest access request data
 */
export interface ExtendGuestData {
    additionalHours: number
}

/**
 * Guest list filters
 */
export interface GuestFilters {
    status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
}

/**
 * Guest Repository interface
 * Defines contract for guest invitation API calls
 */
export interface IGuestRepository {
    /**
     * List guest invitations with optional status filter
     */
    listGuests(filters?: GuestFilters): Promise<GuestInvitation[]>

    /**
     * Get active guest count
     */
    getActiveCount(): Promise<number>

    /**
     * Invite a guest
     */
    inviteGuest(data: InviteGuestData): Promise<GuestInvitation>

    /**
     * Extend a guest's access period
     */
    extendAccess(guestId: string, data: ExtendGuestData): Promise<void>

    /**
     * Revoke a guest's access
     */
    revokeAccess(guestId: string): Promise<void>
}
