import type { Tenant } from '@domain/models/Tenant'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * Create tenant data (without generated fields)
 */
export interface CreateTenantData {
    name: string
    slug: string
    description?: string
    contactEmail?: string
    contactPhone?: string
    maxUsers: number
}

/**
 * Update tenant data (all fields optional)
 */
export interface UpdateTenantData {
    name?: string
    slug?: string
    description?: string
    contactEmail?: string
    contactPhone?: string
    maxUsers?: number
    /**
     * V62 opt-in email-domain enforcement. When true, only registrants whose
     * email domain is in this tenant's registry may join.
     */
    enforceDomainMatching?: boolean
}

/**
 * A single tenant email-domain registry row (tenant_email_domains, V44).
 */
export interface TenantEmailDomain {
    domain: string
    isPrimary: boolean
    createdAt: string
    /** DNS-ownership verification state (TXT challenge). */
    verified?: boolean
}

/**
 * The DNS TXT challenge issued for a domain-ownership verification.
 */
export interface DomainVerificationChallenge {
    recordName: string
    recordType: string
    recordValue: string
    verified: boolean
    instructions?: string
}

/**
 * Result of attempting to verify a domain's TXT challenge.
 */
export interface DomainVerificationResult {
    verified: boolean
    /** Failure reason when not verified, e.g. RECORD_NOT_FOUND / NO_CHALLENGE. */
    reason?: string
}

/**
 * Tenant Repository interface
 * Handles tenant data access operations
 */
export interface ITenantRepository {
    /**
     * Find all tenants with optional filters and pagination
     */
    findAll(params?: QueryParams): Promise<PaginatedResult<Tenant>>

    /**
     * Find tenant by ID
     * @returns Tenant if found, null otherwise
     */
    findById(id: string): Promise<Tenant | null>

    /**
     * Find tenant by slug
     * @returns Tenant if found, null otherwise
     */
    findBySlug(slug: string): Promise<Tenant | null>

    /**
     * Create new tenant
     */
    create(data: CreateTenantData): Promise<Tenant>

    /**
     * Update existing tenant
     */
    update(id: string, data: UpdateTenantData): Promise<Tenant>

    /**
     * Delete tenant
     */
    delete(id: string): Promise<void>

    /**
     * Activate tenant
     */
    activate(id: string): Promise<Tenant>

    /**
     * Suspend tenant
     */
    suspend(id: string): Promise<Tenant>

    // ===== Email-domain registry (V44 + V62) =====

    /**
     * List the tenant's email domains (primary first, then alphabetical).
     */
    listDomains(tenantId: string): Promise<TenantEmailDomain[]>

    /**
     * Add an email domain to the tenant.
     * @throws on 409 EMAIL_DOMAIN_ALREADY_CLAIMED (owned by another tenant)
     */
    addDomain(tenantId: string, domain: string, isPrimary?: boolean): Promise<TenantEmailDomain>

    /**
     * Remove an email domain from the tenant.
     * @throws on 409 CANNOT_REMOVE_LAST_DOMAIN (last domain while enforcement on)
     */
    removeDomain(tenantId: string, domain: string): Promise<void>

    /**
     * Set the given domain as the tenant's single primary domain.
     */
    setPrimaryDomain(tenantId: string, domain: string): Promise<TenantEmailDomain>

    /**
     * Issue (or fetch) the DNS TXT challenge proving ownership of a domain.
     */
    getDomainVerificationChallenge(
        tenantId: string,
        domain: string
    ): Promise<DomainVerificationChallenge>

    /**
     * Attempt to verify the domain's TXT challenge.
     * Resolves to `{ verified: false, reason }` for the documented 4xx
     * responses (e.g. 422 RECORD_NOT_FOUND, 409 NO_CHALLENGE) rather than
     * throwing, so the UI can show the reason inline.
     */
    verifyDomain(tenantId: string, domain: string): Promise<DomainVerificationResult>
}
