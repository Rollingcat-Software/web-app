/**
 * ActiveTenantProvider — SUPER_ADMIN/ROOT tenant DATA-scoping switcher.
 *
 * Distinct from the Phase-5 account switcher: this keeps you the SAME user and
 * only re-scopes which tenant's data a ROOT operator reads, via the X-Tenant-ID
 * header bridge (core/api/activeTenant.ts). Edge cases:
 *
 *  - canSwitch === user.isRoot()  (non-root → inert, no switching, home only)
 *  - default selection is the HOME tenant (so the default view is home)
 *  - a ROOT selecting a tenant writes X-Tenant-ID via setActiveTenantHeader
 *  - a NON-root never writes the override header
 *  - setActiveTenantId is a no-op for a non-root user
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { useContext } from 'react'
import { ActiveTenantProvider } from '../ActiveTenantProvider'
import { ActiveTenantContext, type ActiveTenantContextValue } from '../ActiveTenantContext'

const { setHeader, mockUseAuth, findAll } = vi.hoisted(() => ({
    setHeader: vi.fn(),
    mockUseAuth: vi.fn(),
    findAll: vi.fn(),
}))

vi.mock('@core/api/activeTenant', () => ({
    ACTIVE_TENANT_HEADER: 'X-Tenant-ID',
    setActiveTenantHeader: setHeader,
}))

vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

// useService resolves either the tenant repo or the logger. The instances MUST
// be STABLE (returned by reference) — the provider lists them in effect deps, so
// a fresh object per render would re-fire the effects forever.
vi.mock('@app/providers', () => {
    const tenantRepoStub = { findAll }
    const loggerStub = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
    return {
        useService: (sym: symbol) => {
            if (sym === Symbol.for('TenantRepository')) return tenantRepoStub
            return loggerStub
        },
    }
})

let captured: ActiveTenantContextValue | null = null
function Probe() {
    captured = useContext(ActiveTenantContext)
    return null
}

function renderProvider() {
    return render(
        <ActiveTenantProvider>
            <Probe />
        </ActiveTenantProvider>,
    )
}

function rootUser() {
    return {
        id: 'u1',
        tenantId: 'home-tenant',
        tenantName: 'Home Org',
        isRoot: () => true,
    }
}
function nonRootUser() {
    return {
        id: 'u2',
        tenantId: 'home-tenant',
        tenantName: 'Home Org',
        isRoot: () => false,
    }
}

describe('ActiveTenantProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        captured = null
        findAll.mockResolvedValue({ items: [], total: 0, page: 0, pageSize: 200 })
        try {
            sessionStorage.clear()
        } catch {
            /* jsdom may not provide it */
        }
    })

    it('canSwitch tracks user.isRoot() — TRUE for a ROOT user', async () => {
        mockUseAuth.mockReturnValue({ user: rootUser(), isAuthenticated: true })
        await act(async () => {
            renderProvider()
        })
        expect(captured?.canSwitch).toBe(true)
    })

    it('canSwitch is FALSE for a non-root user (switcher inert)', async () => {
        mockUseAuth.mockReturnValue({ user: nonRootUser(), isAuthenticated: true })
        await act(async () => {
            renderProvider()
        })
        expect(captured?.canSwitch).toBe(false)
    })

    it('defaults the active tenant to the HOME tenant for a ROOT user', async () => {
        mockUseAuth.mockReturnValue({ user: rootUser(), isAuthenticated: true })
        await act(async () => {
            renderProvider()
        })
        expect(captured?.homeTenantId).toBe('home-tenant')
        expect(captured?.activeTenantId).toBe('home-tenant')
        // Bridged to the interceptor as the home tenant.
        expect(setHeader).toHaveBeenCalledWith('home-tenant')
    })

    it('a ROOT selecting another tenant writes X-Tenant-ID via setActiveTenantHeader', async () => {
        mockUseAuth.mockReturnValue({ user: rootUser(), isAuthenticated: true })
        await act(async () => {
            renderProvider()
        })
        setHeader.mockClear()
        await act(async () => {
            captured?.setActiveTenantId('other-tenant')
        })
        expect(captured?.activeTenantId).toBe('other-tenant')
        expect(setHeader).toHaveBeenCalledWith('other-tenant')
    })

    it('a NON-root never sends the override header (always null)', async () => {
        mockUseAuth.mockReturnValue({ user: nonRootUser(), isAuthenticated: true })
        await act(async () => {
            renderProvider()
        })
        // Non-root: home-tenant in state but header bridge stays null.
        expect(setHeader).toHaveBeenCalledWith(null)
        expect(setHeader).not.toHaveBeenCalledWith('home-tenant')
    })

    it('setActiveTenantId is a NO-OP for a non-root user', async () => {
        mockUseAuth.mockReturnValue({ user: nonRootUser(), isAuthenticated: true })
        await act(async () => {
            renderProvider()
        })
        const before = captured?.activeTenantId
        await act(async () => {
            captured?.setActiveTenantId('hacker-tenant')
        })
        expect(captured?.activeTenantId).toBe(before)
        expect(setHeader).not.toHaveBeenCalledWith('hacker-tenant')
    })

    it('clears the active tenant when unauthenticated', async () => {
        mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false })
        await act(async () => {
            renderProvider()
        })
        expect(captured?.activeTenantId).toBeNull()
    })
})
