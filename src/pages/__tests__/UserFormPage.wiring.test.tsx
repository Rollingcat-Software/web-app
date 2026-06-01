/**
 * Behavioural test — UserFormPage user_type + roleIds wiring (2026-06-01).
 *
 * Locks in the "full separation + wiring" contract:
 *  - the conflated "Role" field is replaced by a "User Type" (platform tier) select;
 *  - the "Assigned Roles" multi-select is PRE-POPULATED on edit from the user's
 *    current role NAMES (mapped to ids via the role catalog);
 *  - on submit, the selected role IDs are forwarded to updateUser as `roleIds`,
 *    and a ROOT caller's `userType` is forwarded too.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '@/i18n'

const updateUser = vi.fn().mockResolvedValue({})
const createUser = vi.fn().mockResolvedValue({})

// Editing user u1: platform tier TENANT_MEMBER, holds the "Editor" role (by name).
const existingUser = {
    id: 'u1',
    email: 'edit@example.com',
    firstName: 'Ed',
    lastName: 'Itor',
    status: 'ACTIVE',
    tenantId: '11111111-1111-1111-1111-111111111111',
    userType: 'TENANT_MEMBER',
    roles: ['Editor'],
}

vi.mock('@features/users', () => ({
    useUsers: () => ({ createUser, updateUser }),
    useUser: () => ({ user: existingUser, loading: false }),
}))

vi.mock('@features/tenants', () => ({
    useTenants: () => ({
        tenants: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Acme', slug: 'acme' }],
        loading: false,
    }),
}))

vi.mock('@features/roles', () => ({
    useRoles: () => ({
        roles: [
            { id: 'role-editor', name: 'Editor', description: 'Edits', active: true },
            { id: 'role-viewer', name: 'Viewer', description: 'Reads', active: true },
        ],
        loading: false,
    }),
}))

// ROOT caller — may set the platform tier, so userType is forwarded on submit.
vi.mock('@features/auth', () => ({
    useAuth: () => ({ user: { isRoot: () => true } }),
}))

vi.mock('@components/OperationContextBanner', () => ({
    OperationContextBanner: () => null,
}))

import UserFormPage from '@/pages/UserFormPage'

function renderEdit() {
    return render(
        <MemoryRouter initialEntries={['/users/u1/edit']}>
            <Routes>
                <Route path="/users/:id/edit" element={<UserFormPage />} />
                <Route path="/users" element={<div>users list</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('UserFormPage — user_type + roleIds wiring (edit)', () => {
    beforeEach(() => {
        updateUser.mockClear()
        createUser.mockClear()
    })

    it('renders a User Type select (not a conflated Role field)', () => {
        renderEdit()
        // The platform-tier field exists…
        expect(document.querySelector('#user-form-userType')).not.toBeNull()
        // …and the old conflated role field is gone.
        expect(document.querySelector('#user-form-role')).toBeNull()
    })

    it('pre-populates Assigned Roles from the user role names and submits role ids + userType', async () => {
        renderEdit()

        // The Editor role chip is pre-selected (name → id mapping).
        await waitFor(() => {
            expect(screen.getByText('Editor')).toBeTruthy()
        })

        // Submit the form via the Update button.
        const updateBtn = screen.getByRole('button', { name: /update user|kullanıcıyı güncelle/i })
        fireEvent.click(updateBtn)

        await waitFor(() => {
            expect(updateUser).toHaveBeenCalledTimes(1)
        })

        const [calledId, payload] = updateUser.mock.calls[0]
        expect(calledId).toBe('u1')
        // The decorative-no-more multi-select is wired into the payload…
        expect(payload.roleIds).toEqual(['role-editor'])
        // …and the ROOT caller's platform tier is forwarded.
        expect(payload.userType).toBe('TENANT_MEMBER')
        // The conflated single `role` string is not sent.
        expect(payload.role).toBeUndefined()
    })
})
