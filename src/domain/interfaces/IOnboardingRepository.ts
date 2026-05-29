/**
 * Public self-service tenant onboarding payload.
 *
 * Mirrors `OnboardingController.RegisterTenantRequest` on the backend
 * (`POST /api/v1/onboarding/register`, PUBLIC, no auth). `slug` and
 * `emailDomain` are optional — the backend derives them from `orgName` and
 * `adminEmail` respectively when omitted.
 */
export interface RegisterTenantData {
    orgName: string
    slug?: string
    adminEmail: string
    adminPassword: string
    adminFirstName: string
    adminLastName: string
    emailDomain?: string
}

/**
 * Response for a successful self-service registration.
 *
 * Mirrors `TenantOnboardingResponse`. No tokens are issued — the admin must
 * verify their email before the (TRIAL) tenant becomes ACTIVE and they can log
 * in. `requiresAdminApproval` lets the UI tailor the "check your inbox" copy.
 */
export interface TenantOnboardingResult {
    tenantId: string
    slug: string
    orgName: string
    adminUserId: string
    adminEmail: string
    emailDomain: string
    status: string
    requiresAdminApproval: boolean
    message?: string
}

/**
 * Onboarding Repository interface.
 *
 * Both methods hit PUBLIC endpoints — no Authorization header required.
 */
export interface IOnboardingRepository {
    /**
     * Register a brand-new organisation. On success the backend creates the
     * tenant in TRIAL state pending admin email verification.
     */
    registerTenant(data: RegisterTenantData): Promise<TenantOnboardingResult>

    /**
     * Verify the admin email via the emailed token, activating the TRIAL
     * tenant. Maps to `POST /api/v1/onboarding/verify-email` with `{ token }`.
     */
    verifyEmail(token: string): Promise<void>
}
