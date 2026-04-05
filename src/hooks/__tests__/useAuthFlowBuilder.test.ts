import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useAuthFlowBuilder } from '../useAuthFlowBuilder'
import { DependencyProvider } from '@app/providers/DependencyProvider'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { AuthFlowResponse } from '@core/repositories/AuthFlowRepository'

// Mock useAuth to provide a user with tenantId
vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' },
        isAuthenticated: true,
        loading: false,
        error: null,
    }),
}))

describe('useAuthFlowBuilder', () => {
    let container: Container
    let mockAuthFlowRepo: {
        listFlows: ReturnType<typeof vi.fn>
        createFlow: ReturnType<typeof vi.fn>
        updateFlow: ReturnType<typeof vi.fn>
        deleteFlow: ReturnType<typeof vi.fn>
        getFlow: ReturnType<typeof vi.fn>
    }
    let mockLogger: {
        info: ReturnType<typeof vi.fn>
        error: ReturnType<typeof vi.fn>
        warn: ReturnType<typeof vi.fn>
        debug: ReturnType<typeof vi.fn>
    }

    const mockFlows: AuthFlowResponse[] = [
        {
            id: 'flow-1',
            tenantId: 'tenant-1',
            name: 'Login Flow',
            description: 'Default login flow',
            operationType: 'APP_LOGIN',
            stepCount: 2,
            steps: [],
            isActive: true,
            isDefault: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-04-01',
        },
    ]

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
        mockAuthFlowRepo = {
            listFlows: vi.fn().mockResolvedValue(mockFlows),
            createFlow: vi.fn().mockResolvedValue(mockFlows[0]),
            updateFlow: vi.fn().mockResolvedValue(mockFlows[0]),
            deleteFlow: vi.fn().mockResolvedValue(undefined),
            getFlow: vi.fn().mockResolvedValue(mockFlows[0]),
        }

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.AuthFlowRepository).toConstantValue(mockAuthFlowRepo)
        container.bind(TYPES.Logger).toConstantValue(mockLogger)
    })

    // ── Initial state ──────────────────────────────────────────────────────

    it('should have correct initial state', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        expect(result.current.flows).toEqual([])
        expect(result.current.loading).toBe(false)
        expect(result.current.saving).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.steps).toEqual([])
        expect(result.current.tenantId).toBe('tenant-1')
    })

    // ── Flow CRUD ──────────────────────────────────────────────────────────

    it('should load flows successfully', async () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadFlows()
        })

        expect(result.current.flows).toEqual(mockFlows)
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
        expect(mockAuthFlowRepo.listFlows).toHaveBeenCalledWith('tenant-1', undefined)
    })

    it('should load flows with operationType filter', async () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadFlows('APP_LOGIN')
        })

        expect(mockAuthFlowRepo.listFlows).toHaveBeenCalledWith('tenant-1', 'APP_LOGIN')
    })

    it('should handle load flows error', async () => {
        mockAuthFlowRepo.listFlows.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.loadFlows()
        })

        expect(result.current.error).toBe('Failed to load authentication flows')
        expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should create flow and reload list', async () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        const command = {
            name: 'New Flow',
            operationType: 'APP_LOGIN' as const,
            steps: [],
        }

        let created: AuthFlowResponse | null = null
        await act(async () => {
            created = await result.current.createFlow(command)
        })

        expect(created).toEqual(mockFlows[0])
        expect(mockAuthFlowRepo.createFlow).toHaveBeenCalledWith('tenant-1', command)
        // Should reload flows after create
        expect(mockAuthFlowRepo.listFlows).toHaveBeenCalledWith('tenant-1')
    })

    it('should handle create flow error', async () => {
        mockAuthFlowRepo.createFlow.mockRejectedValue(new Error('Create failed'))

        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        let created: AuthFlowResponse | null = null
        await act(async () => {
            created = await result.current.createFlow({
                name: 'Fail Flow',
                operationType: 'APP_LOGIN',
                steps: [],
            })
        })

        expect(created).toBeNull()
        expect(result.current.error).toBe('Failed to create authentication flow')
    })

    it('should delete flow and update list', async () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
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
        expect(mockAuthFlowRepo.deleteFlow).toHaveBeenCalledWith('tenant-1', 'flow-1')
        expect(result.current.flows).toEqual([])
    })

    it('should handle delete flow error', async () => {
        mockAuthFlowRepo.deleteFlow.mockRejectedValue(new Error('Delete failed'))

        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        let deleted: boolean = true
        await act(async () => {
            deleted = await result.current.deleteFlow('flow-1')
        })

        expect(deleted).toBe(false)
        expect(result.current.error).toBe('Failed to delete authentication flow')
    })

    it('should get a single flow', async () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        let flow: AuthFlowResponse | null = null
        await act(async () => {
            flow = await result.current.getFlow('flow-1')
        })

        expect(flow).toEqual(mockFlows[0])
        expect(mockAuthFlowRepo.getFlow).toHaveBeenCalledWith('tenant-1', 'flow-1')
    })

    // ── Step management ────────────────────────────────────────────────────

    it('should add a step', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.addStep(AuthMethodType.PASSWORD)
        })

        expect(result.current.steps).toHaveLength(1)
        expect(result.current.steps[0].methodType).toBe(AuthMethodType.PASSWORD)
        expect(result.current.steps[0].order).toBe(1)
        expect(result.current.steps[0].isRequired).toBe(true)
    })

    it('should remove a step and reorder', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.addStep(AuthMethodType.PASSWORD)
            result.current.addStep(AuthMethodType.FACE)
            result.current.addStep(AuthMethodType.TOTP)
        })

        const stepIdToRemove = result.current.steps[1].id

        act(() => {
            result.current.removeStep(stepIdToRemove)
        })

        expect(result.current.steps).toHaveLength(2)
        expect(result.current.steps[0].order).toBe(1)
        expect(result.current.steps[1].order).toBe(2)
    })

    it('should not remove mandatory password step for APP_LOGIN', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.addStep(AuthMethodType.PASSWORD)
            result.current.addStep(AuthMethodType.FACE)
        })

        const passwordStepId = result.current.steps[0].id

        act(() => {
            result.current.removeStep(passwordStepId, 'APP_LOGIN')
        })

        // Password step should still be there
        expect(result.current.steps).toHaveLength(2)
        expect(result.current.steps[0].methodType).toBe(AuthMethodType.PASSWORD)
    })

    it('should toggle step required flag', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.addStep(AuthMethodType.FACE)
        })

        const stepId = result.current.steps[0].id
        expect(result.current.steps[0].isRequired).toBe(true)

        act(() => {
            result.current.toggleStepRequired(stepId)
        })

        expect(result.current.steps[0].isRequired).toBe(false)
    })

    it('should clear all steps', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.addStep(AuthMethodType.PASSWORD)
            result.current.addStep(AuthMethodType.FACE)
        })

        expect(result.current.steps).toHaveLength(2)

        act(() => {
            result.current.clearSteps()
        })

        expect(result.current.steps).toHaveLength(0)
    })

    it('should init steps from existing flow', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        const existingSteps = [
            { id: 's1', order: 1, methodId: 'PASSWORD', methodType: AuthMethodType.PASSWORD, isRequired: true, timeout: 120, maxAttempts: 3 },
            { id: 's2', order: 2, methodId: 'FACE', methodType: AuthMethodType.FACE, isRequired: false, timeout: 60, maxAttempts: 3 },
        ]

        act(() => {
            result.current.initSteps(existingSteps)
        })

        expect(result.current.steps).toEqual(existingSteps)
    })

    it('should clear error', () => {
        const { result } = renderHook(() => useAuthFlowBuilder(), {
            wrapper: createWrapper(),
        })

        // Trigger an error first
        mockAuthFlowRepo.listFlows.mockRejectedValue(new Error('fail'))

        act(() => {
            result.current.loadFlows()
        })

        waitFor(() => {
            expect(result.current.error).not.toBeNull()
        })

        act(() => {
            result.current.clearError()
        })

        expect(result.current.error).toBeNull()
    })
})
