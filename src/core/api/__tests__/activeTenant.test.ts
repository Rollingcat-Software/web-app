/**
 * activeTenant — the module-level bridge between ActiveTenantProvider (React)
 * and the axios request interceptor (outside React).
 *
 * Pins the CANONICAL header name (X-Tenant-ID, NOT X-Active-Tenant — only
 * X-Tenant-ID is read by the backend TenantContextFilter that scopes /users +
 * roles) and the set/clear/round-trip semantics the interceptor relies on.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
    ACTIVE_TENANT_HEADER,
    getActiveTenantHeader,
    setActiveTenantHeader,
} from '../activeTenant'

describe('activeTenant header bridge', () => {
    afterEach(() => setActiveTenantHeader(null))

    it('uses the canonical X-Tenant-ID header name', () => {
        expect(ACTIVE_TENANT_HEADER).toBe('X-Tenant-ID')
    })

    it('defaults to null (no override → no header sent)', () => {
        expect(getActiveTenantHeader()).toBeNull()
    })

    it('round-trips a tenant id', () => {
        setActiveTenantHeader('tenant-uuid-123')
        expect(getActiveTenantHeader()).toBe('tenant-uuid-123')
    })

    it('clears back to null', () => {
        setActiveTenantHeader('tenant-uuid-123')
        setActiveTenantHeader(null)
        expect(getActiveTenantHeader()).toBeNull()
    })

    it('overwrites a previous value', () => {
        setActiveTenantHeader('a')
        setActiveTenantHeader('b')
        expect(getActiveTenantHeader()).toBe('b')
    })
})
