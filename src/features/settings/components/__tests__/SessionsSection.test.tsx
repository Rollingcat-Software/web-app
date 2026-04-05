import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import SessionsSection from '../SessionsSection'
import type { UserSessionResponse } from '@core/repositories/AuthSessionRepository'

// Mock useSessions hook
const mockRevokeSession = vi.fn()
const mockRevokeAllOther = vi.fn()
const mockRefetch = vi.fn()

const mockSessions: UserSessionResponse[] = [
    {
        sessionId: 'sess-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120',
        deviceInfo: 'Chrome on Desktop',
        createdAt: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 86400000).toISOString(),
        isCurrent: true,
    },
    {
        sessionId: 'sess-2',
        ipAddress: '10.0.0.1',
        userAgent: 'Safari/17',
        deviceInfo: 'Safari on iPhone',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        expiryDate: new Date(Date.now() + 82800000).toISOString(),
        isCurrent: false,
    },
]

let mockState = {
    sessions: mockSessions,
    loading: false,
    error: null as string | null,
    revoking: null as string | null,
    revokeSession: mockRevokeSession,
    revokeAllOther: mockRevokeAllOther,
    refetch: mockRefetch,
}

vi.mock('@features/settings/hooks/useSessions', () => ({
    useSessions: () => mockState,
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const translations: Record<string, string> = {
                'sessions.title': 'Active Sessions',
                'sessions.subtitle': 'Manage your active sessions across devices',
                'sessions.currentSession': 'Current Session',
                'sessions.unknownDevice': 'Unknown Device',
                'sessions.ipAddress': 'IP Address',
                'sessions.signedIn': 'Signed in',
                'sessions.justNow': 'Just now',
                'sessions.minutesAgo': `${options?.count ?? ''} minutes ago`,
                'sessions.hoursAgo': `${options?.count ?? ''} hours ago`,
                'sessions.daysAgo': `${options?.count ?? ''} days ago`,
                'sessions.revokeSession': 'Revoke Session',
                'sessions.revokeAllOther': 'Revoke All Other',
                'sessions.revokeAllTitle': 'Revoke All Other Sessions',
                'sessions.revokeAllConfirm': `Revoke ${options?.count ?? 0} other session(s)?`,
                'sessions.noSessions': 'No active sessions',
                'common.cancel': 'Cancel',
            }
            return translations[key] || key
        },
    }),
}))

describe('SessionsSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState = {
            sessions: mockSessions,
            loading: false,
            error: null,
            revoking: null,
            revokeSession: mockRevokeSession,
            revokeAllOther: mockRevokeAllOther,
            refetch: mockRefetch,
        }
    })

    it('should render the sessions title', () => {
        render(<SessionsSection />)
        expect(screen.getByText('Active Sessions')).toBeInTheDocument()
    })

    it('should render the subtitle', () => {
        render(<SessionsSection />)
        expect(screen.getByText('Manage your active sessions across devices')).toBeInTheDocument()
    })

    it('should render all sessions', () => {
        render(<SessionsSection />)
        expect(screen.getByText('Chrome on Desktop')).toBeInTheDocument()
        expect(screen.getByText('Safari on iPhone')).toBeInTheDocument()
    })

    it('should show current session chip', () => {
        render(<SessionsSection />)
        expect(screen.getByText('Current Session')).toBeInTheDocument()
    })

    it('should show IP addresses', () => {
        render(<SessionsSection />)
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
        expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    })

    it('should show loading state', () => {
        mockState = { ...mockState, sessions: [], loading: true }
        render(<SessionsSection />)
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should show error state', () => {
        mockState = { ...mockState, error: 'Something went wrong' }
        render(<SessionsSection />)
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should show no sessions message when empty', () => {
        mockState = { ...mockState, sessions: [] }
        render(<SessionsSection />)
        expect(screen.getByText('No active sessions')).toBeInTheDocument()
    })

    it('should not show revoke button for current session', () => {
        // Render with only the current session
        mockState = {
            ...mockState,
            sessions: [mockSessions[0]], // only current session
        }
        render(<SessionsSection />)
        // No logout icon buttons should be visible (current session is not revokable)
        const revokeButtons = screen.queryAllByRole('button', { name: /revoke session/i })
        expect(revokeButtons.length).toBe(0)
    })

    it('should show revoke all button when there are other sessions', () => {
        render(<SessionsSection />)
        expect(screen.getByText('Revoke All Other')).toBeInTheDocument()
    })

    it('should not show revoke all button when no other sessions', () => {
        mockState = {
            ...mockState,
            sessions: [mockSessions[0]], // only current session
        }
        render(<SessionsSection />)
        expect(screen.queryByText('Revoke All Other')).not.toBeInTheDocument()
    })

    it('should open confirmation dialog when clicking revoke all', () => {
        render(<SessionsSection />)

        const revokeAllBtn = screen.getByText('Revoke All Other')
        fireEvent.click(revokeAllBtn)

        expect(screen.getByText('Revoke All Other Sessions')).toBeInTheDocument()
        expect(screen.getByText(/Revoke 1 other session/)).toBeInTheDocument()
    })

    it('should close confirmation dialog on cancel', () => {
        render(<SessionsSection />)

        fireEvent.click(screen.getByText('Revoke All Other'))
        expect(screen.getByText('Revoke All Other Sessions')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Cancel'))

        // Dialog title should no longer be in the document
        waitFor(() => {
            expect(screen.queryByText('Revoke All Other Sessions')).not.toBeInTheDocument()
        })
    })

    it('should call revokeAllOther when confirming revoke all', async () => {
        render(<SessionsSection />)

        // Open dialog
        fireEvent.click(screen.getByText('Revoke All Other'))

        // Find the confirm button in the dialog (there are two "Revoke All Other" buttons)
        const dialogButtons = screen.getAllByText('Revoke All Other')
        // The confirm button is the last one (inside the dialog actions)
        fireEvent.click(dialogButtons[dialogButtons.length - 1])

        await waitFor(() => {
            expect(mockRevokeAllOther).toHaveBeenCalled()
        })
    })
})
