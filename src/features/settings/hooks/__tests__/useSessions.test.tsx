import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useSessions } from '../useSessions'
import { DependencyProvider } from '@app/providers'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import type { UserSessionResponse } from '@core/repositories/AuthSessionRepository'

// Mock jwtDecode to return a predictable JTI
vi.mock('jwt-decode', () => ({
    jwtDecode: () => ({ jti: 'test-token-jti-123' }),
}))

describe('useSessions', () => {
    let container: Container
    let mockSessionRepo: {
        getActiveSessions: ReturnType<typeof vi.fn>
        revokeSession: ReturnType<typeof vi.fn>
        revokeAllOtherSessions: ReturnType<typeof vi.fn>
    }
    let mockErrorHandler: {
        handle: ReturnType<typeof vi.fn>
    }

    const mockSessions: UserSessionResponse[] = [
        {
            sessionId: 'sess-1',
            ipAddress: '192.168.1.1',
            userAgent: 'Chrome/120',
            deviceInfo: 'Chrome on Desktop',
            createdAt: '2026-04-05T08:00:00Z',
            expiryDate: '2026-04-06T08:00:00Z',
            isCurrent: true,
        },
        {
            sessionId: 'sess-2',
            ipAddress: '10.0.0.1',
            userAgent: 'Safari/17',
            deviceInfo: 'Safari on iPhone',
            createdAt: '2026-04-04T12:00:00Z',
            expiryDate: '2026-04-05T12:00:00Z',
            isCurrent: false,
        },
    ]

    const createWrapper = () => {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return (
                <DependencyProvider container={container}>
                    {children}
                </DependencyProvider>
            )
        }
    }

    beforeEach(() => {
        // Mock sessionStorage for getTokenJti
        const store: Record<string, string> = { access_token: 'fake-jwt-token' }
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null)

        mockSessionRepo = {
            getActiveSessions: vi.fn().mockResolvedValue(mockSessions),
            revokeSession: vi.fn().mockResolvedValue(undefined),
            revokeAllOtherSessions: vi.fn().mockResolvedValue(undefined),
        }

        mockErrorHandler = {
            handle: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.AuthSessionRepository).toConstantValue(mockSessionRepo)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)
    })

    it('should load sessions on mount', async () => {
        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.sessions).toEqual(mockSessions)
        expect(result.current.error).toBeNull()
        expect(mockSessionRepo.getActiveSessions).toHaveBeenCalled()
    })

    it('should handle load error', async () => {
        const error = new Error('Failed to load sessions')
        mockSessionRepo.getActiveSessions.mockRejectedValue(error)

        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toBe('Failed to load sessions')
        expect(result.current.sessions).toEqual([])
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
    })

    it('should handle non-Error load failure', async () => {
        mockSessionRepo.getActiveSessions.mockRejectedValue('string error')

        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toBe('Failed to load sessions')
    })

    it('should revoke a specific session and refetch', async () => {
        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.revokeSession('sess-2')
        })

        expect(mockSessionRepo.revokeSession).toHaveBeenCalledWith('sess-2')
        // getActiveSessions called: once on mount + once after revoke
        expect(mockSessionRepo.getActiveSessions).toHaveBeenCalledTimes(2)
    })

    it('should handle revoke error', async () => {
        const revokeError = new Error('Revoke failed')
        mockSessionRepo.revokeSession.mockRejectedValue(revokeError)

        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            try {
                await result.current.revokeSession('sess-2')
            } catch {
                // expected
            }
        })

        expect(mockErrorHandler.handle).toHaveBeenCalledWith(revokeError)
    })

    it('should revoke all other sessions and refetch', async () => {
        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.revokeAllOther()
        })

        expect(mockSessionRepo.revokeAllOtherSessions).toHaveBeenCalledWith('test-token-jti-123')
        expect(mockSessionRepo.getActiveSessions).toHaveBeenCalledTimes(2)
    })

    it('should handle revokeAllOther error', async () => {
        const revokeAllError = new Error('Revoke all failed')
        mockSessionRepo.revokeAllOtherSessions.mockRejectedValue(revokeAllError)

        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            try {
                await result.current.revokeAllOther()
            } catch {
                // expected
            }
        })

        expect(mockErrorHandler.handle).toHaveBeenCalledWith(revokeAllError)
    })

    it('should refetch sessions when refetch is called', async () => {
        const { result } = renderHook(() => useSessions(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.refetch()
        })

        // Called on mount + once for refetch
        expect(mockSessionRepo.getActiveSessions).toHaveBeenCalledTimes(2)
    })
})
