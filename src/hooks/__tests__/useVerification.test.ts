import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { useVerification } from '../useVerification'
import { DependencyProvider } from '@app/providers'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import type {
    VerificationTemplate,
    VerificationFlow,
    VerificationSessionResponse,
    VerificationStats,
} from '@core/repositories/VerificationRepository'

// Mock useAuth to provide a user with tenantId
vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' },
        isAuthenticated: true,
        loading: false,
        error: null,
    }),
}))

describe('useVerification', () => {
    let container: Container
    let mockVerificationRepo: {
        getTemplates: ReturnType<typeof vi.fn>
        listFlows: ReturnType<typeof vi.fn>
        createFlow: ReturnType<typeof vi.fn>
        deleteFlow: ReturnType<typeof vi.fn>
        listSessions: ReturnType<typeof vi.fn>
        getSession: ReturnType<typeof vi.fn>
        getStats: ReturnType<typeof vi.fn>
    }
    let mockLogger: {
        info: ReturnType<typeof vi.fn>
        error: ReturnType<typeof vi.fn>
        warn: ReturnType<typeof vi.fn>
        debug: ReturnType<typeof vi.fn>
    }

    const mockTemplates: VerificationTemplate[] = [
        {
            id: 'tpl-1',
            name: 'Banking KYC',
            description: 'Standard banking KYC flow',
            industry: 'banking',
            flowType: 'FULL_KYC',
            steps: [],
            estimatedTimeMinutes: 10,
            createdAt: '2026-01-01',
        },
    ]

    const mockFlows: VerificationFlow[] = [
        {
            id: 'flow-1',
            tenantId: 'tenant-1',
            name: 'Default KYC',
            flowType: 'FULL_KYC',
            steps: [],
            status: 'active',
            createdAt: '2026-01-01',
            updatedAt: '2026-04-01',
        },
    ]

    const mockSession: VerificationSessionResponse = {
        id: 'sess-1',
        userId: 'user-1',
        flowId: 'flow-1',
        flowName: 'Default KYC',
        status: 'completed',
        currentStep: 3,
        totalSteps: 3,
        steps: [],
        startedAt: '2026-04-01T10:00:00Z',
        completedAt: '2026-04-01T10:15:00Z',
    }

    const mockStats: VerificationStats = {
        totalVerifications: 100,
        completionRate: 0.85,
        avgTimeMinutes: 12,
        failureRate: 0.15,
        dailyVerifications: [{ date: '2026-04-01', count: 10 }],
        statusDistribution: [{ status: 'completed', count: 85 }],
        failureReasons: [{ reason: 'Document expired', count: 5 }],
    }

    const createWrapper = () => {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return React.createElement(
                DependencyProvider,
                { container },
                children,
            )
        }
    }

    beforeEach(() => {
        mockVerificationRepo = {
            getTemplates: vi.fn().mockResolvedValue(mockTemplates),
            listFlows: vi.fn().mockResolvedValue(mockFlows),
            createFlow: vi.fn().mockResolvedValue(mockFlows[0]),
            deleteFlow: vi.fn().mockResolvedValue(undefined),
            listSessions: vi.fn().mockResolvedValue([mockSession]),
            getSession: vi.fn().mockResolvedValue(mockSession),
            getStats: vi.fn().mockResolvedValue(mockStats),
        }

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.VerificationRepository).toConstantValue(mockVerificationRepo)
        container.bind(TYPES.Logger).toConstantValue(mockLogger)
    })

    it('should have correct initial state', () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        expect(result.current.templates).toEqual([])
        expect(result.current.flows).toEqual([])
        expect(result.current.sessions).toEqual([])
        expect(result.current.currentSession).toBeNull()
        expect(result.current.stats).toBeNull()
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    // ── Templates ──────────────────────────────────────────────────────────

    it('should load templates successfully', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadTemplates()
        })

        expect(result.current.templates).toEqual(mockTemplates)
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('should handle load templates error', async () => {
        mockVerificationRepo.getTemplates.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadTemplates()
        })

        expect(result.current.error).toBe('Failed to load verification templates')
        expect(mockLogger.error).toHaveBeenCalled()
    })

    // ── Flows ──────────────────────────────────────────────────────────────

    it('should load flows successfully', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadFlows()
        })

        expect(result.current.flows).toEqual(mockFlows)
        expect(mockVerificationRepo.listFlows).toHaveBeenCalledWith('tenant-1', undefined)
    })

    it('should handle load flows error', async () => {
        mockVerificationRepo.listFlows.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadFlows()
        })

        expect(result.current.error).toBe('Failed to load verification flows')
    })

    it('should create flow and reload list', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        const command = { name: 'New Flow', flowType: 'FULL_KYC', steps: [] }

        let created: VerificationFlow | null = null
        await act(async () => {
            created = await result.current.createFlow(command)
        })

        expect(created).toEqual(mockFlows[0])
        expect(mockVerificationRepo.createFlow).toHaveBeenCalledWith(command)
        expect(mockVerificationRepo.listFlows).toHaveBeenCalledWith('tenant-1', undefined)
    })

    it('should handle create flow error', async () => {
        mockVerificationRepo.createFlow.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        let created: VerificationFlow | null = null
        await act(async () => {
            created = await result.current.createFlow({
                name: 'Fail',
                flowType: 'FULL_KYC',
                steps: [],
            })
        })

        expect(created).toBeNull()
        expect(result.current.error).toBe('Failed to create verification flow')
    })

    it('should delete flow and update list', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        // Load flows first
        await act(async () => {
            await result.current.loadFlows()
        })

        let deleted: boolean = false
        await act(async () => {
            deleted = await result.current.deleteFlow('flow-1')
        })

        expect(deleted).toBe(true)
        expect(result.current.flows).toEqual([])
    })

    it('should handle delete flow error', async () => {
        mockVerificationRepo.deleteFlow.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        let deleted: boolean = true
        await act(async () => {
            deleted = await result.current.deleteFlow('flow-1')
        })

        expect(deleted).toBe(false)
        expect(result.current.error).toBe('Failed to delete verification flow')
    })

    // ── Sessions ───────────────────────────────────────────────────────────

    it('should load sessions successfully', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadSessions()
        })

        expect(result.current.sessions).toEqual([mockSession])
    })

    it('should load sessions with filters', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        const filters = { status: 'completed', dateFrom: '2026-04-01' }
        await act(async () => {
            await result.current.loadSessions(filters)
        })

        expect(mockVerificationRepo.listSessions).toHaveBeenCalledWith(filters)
    })

    it('should handle load sessions error', async () => {
        mockVerificationRepo.listSessions.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadSessions()
        })

        expect(result.current.error).toBe('Failed to load verification sessions')
    })

    it('should load a single session', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadSession('sess-1')
        })

        expect(result.current.currentSession).toEqual(mockSession)
        expect(mockVerificationRepo.getSession).toHaveBeenCalledWith('sess-1')
    })

    it('should handle load session error', async () => {
        mockVerificationRepo.getSession.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadSession('bad-id')
        })

        expect(result.current.error).toBe('Failed to load verification session')
    })

    // ── Stats ──────────────────────────────────────────────────────────────

    it('should load stats successfully', async () => {
        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadStats()
        })

        expect(result.current.stats).toEqual(mockStats)
    })

    it('should handle load stats error', async () => {
        mockVerificationRepo.getStats.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadStats()
        })

        expect(result.current.error).toBe('Failed to load verification stats')
    })

    // ── Utility ────────────────────────────────────────────────────────────

    it('should clear error', async () => {
        mockVerificationRepo.getTemplates.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useVerification(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadTemplates()
        })

        expect(result.current.error).not.toBeNull()

        act(() => {
            result.current.clearError()
        })

        expect(result.current.error).toBeNull()
    })
})
