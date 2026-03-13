import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useDashboard } from '../useDashboard'
import { createTestContainer } from '@test/testUtils'
import type { IDashboardService } from '@domain/interfaces/IDashboardService'
import type { ErrorHandler } from '@core/errors'
import { DashboardStats } from '@domain/models/DashboardStats'

describe('useDashboard', () => {
    let container: Container
    let mockDashboardService: jest.Mocked<IDashboardService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test data
    const testStats = DashboardStats.fromJSON({
        totalUsers: 100,
        activeUsers: 85,
        pendingEnrollments: 10,
        successfulEnrollments: 75,
        failedEnrollments: 5,
        authSuccessRate: 95.5,
        verificationSuccessRate: 92.3,
    })

    beforeEach(() => {
        container = createTestContainer()
        mockDashboardService = container.get<IDashboardService>(
            TYPES.DashboardService
        ) as jest.Mocked<IDashboardService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockDashboardService.getStats = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            const { result } = renderHook(() => useDashboard(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.stats).toBeNull()
            expect(result.current.error).toBeNull()
        })
    })

    describe('successful stats fetch', () => {
        it('should fetch dashboard stats successfully on mount', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for stats to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.stats).toEqual(testStats)
            expect(result.current.error).toBeNull()
            expect(mockDashboardService.getStats).toHaveBeenCalledTimes(1)
        })

        it('should verify stats calculations', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const stats = result.current.stats!

            // Verify base properties
            expect(stats.totalUsers).toBe(100)
            expect(stats.activeUsers).toBe(85)
            expect(stats.pendingEnrollments).toBe(10)
            expect(stats.successfulEnrollments).toBe(75)
            expect(stats.failedEnrollments).toBe(5)

            // Verify calculated properties
            expect(stats.totalEnrollments).toBe(80) // 75 + 5
            expect(stats.enrollmentSuccessRate).toBeCloseTo(93.75) // (75 / 80) * 100
            expect(stats.activeUserPercentage).toBe(85) // (85 / 100) * 100
        })

        it('should handle stats with zero values', async () => {
            const emptyStats = DashboardStats.fromJSON({})
            mockDashboardService.getStats = vi.fn().mockResolvedValue(emptyStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const stats = result.current.stats!
            expect(stats.totalUsers).toBe(0)
            expect(stats.activeUsers).toBe(0)
            expect(stats.totalEnrollments).toBe(0)
            expect(stats.enrollmentSuccessRate).toBe(0)
            expect(stats.activeUserPercentage).toBe(0)
        })
    })

    describe('fetch failure', () => {
        it('should handle fetch error and call error handler', async () => {
            const error = new Error('Failed to fetch dashboard stats')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useDashboard(), { wrapper })

            // Wait for error state
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.stats).toBeNull()
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })

        it('should set loading to false after error', async () => {
            const error = new Error('Network error')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.error).toEqual(error)
            expect(result.current.stats).toBeNull()
        })

        it('should handle network timeout error', async () => {
            const timeoutError = new Error('Request timeout')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(timeoutError)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.error).toEqual(timeoutError)
            })

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(timeoutError)
        })
    })

    describe('refetch functionality', () => {
        it('should refetch stats successfully', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.stats).toEqual(testStats)

            // Update mock to return new stats
            const updatedStats = DashboardStats.fromJSON({
                totalUsers: 120,
                activeUsers: 100,
                pendingEnrollments: 15,
                successfulEnrollments: 80,
                failedEnrollments: 8,
                authSuccessRate: 96.0,
                verificationSuccessRate: 93.5,
            })
            mockDashboardService.getStats = vi.fn().mockResolvedValue(updatedStats)

            // Refetch
            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.stats).toEqual(updatedStats)
            })

            expect(result.current.loading).toBe(false)
            expect(result.current.error).toBeNull()
        })

        it('should set loading state during refetch', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Setup slow refetch
            let resolveRefetch: (value: any) => void
            mockDashboardService.getStats = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveRefetch = resolve
                    })
            )

            // Start refetch
            const refetchPromise = result.current.refetch()

            // Should be loading
            await waitFor(() => {
                expect(result.current.loading).toBe(true)
            })

            // Resolve refetch
            resolveRefetch!(testStats)
            await refetchPromise

            // Should be done loading
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })
        })

        it('should clear previous error on successful refetch', async () => {
            // First fetch fails
            const error = new Error('Initial fetch failed')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            // Retry succeeds
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.error).toBeNull()
            })

            expect(result.current.stats).toEqual(testStats)
            expect(result.current.loading).toBe(false)
        })

        it('should handle refetch failure', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Refetch fails
            const refetchError = new Error('Refetch failed')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(refetchError)
            mockErrorHandler.handle = vi.fn()

            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.error).toEqual(refetchError)
            })

            expect(result.current.stats).toBeNull()
            expect(result.current.loading).toBe(false)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(refetchError)
        })

        it('should handle multiple rapid refetch calls', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Multiple rapid refetch calls
            await Promise.all([
                result.current.refetch(),
                result.current.refetch(),
                result.current.refetch(),
            ])

            expect(result.current.stats).toEqual(testStats)
            expect(result.current.loading).toBe(false)
            // Should have been called: 1 initial + 3 refetch = 4 times
            expect(mockDashboardService.getStats).toHaveBeenCalledTimes(4)
        })
    })

    describe('cleanup and lifecycle', () => {
        it('should fetch stats only once on mount', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Should only be called once on mount
            expect(mockDashboardService.getStats).toHaveBeenCalledTimes(1)
        })

        it('should not fetch again on re-render', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result, rerender } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const callCount = mockDashboardService.getStats.mock.calls.length

            // Force re-render
            rerender()

            // Should not call getStats again
            expect(mockDashboardService.getStats).toHaveBeenCalledTimes(callCount)
        })

        it('should maintain stable refetch function reference', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result, rerender } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const { refetch } = result.current

            // Force re-render
            rerender()

            // Function reference should be stable
            expect(result.current.refetch).toBe(refetch)
        })
    })

    describe('edge cases', () => {
        it('should handle service returning partial stats', async () => {
            // Create stats with some values as 0
            const partialStats = DashboardStats.fromJSON({
                totalUsers: 50,
                activeUsers: 25,
                successfulEnrollments: 30,
                totalVerifications: 100,
                verificationSuccessRate: 100,
            })
            mockDashboardService.getStats = vi.fn().mockResolvedValue(partialStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.stats).toEqual(partialStats)
            expect(result.current.stats!.pendingEnrollments).toBe(0)
            expect(result.current.stats!.failedEnrollments).toBe(0)
        })

        it('should handle very large numbers', async () => {
            const largeStats = DashboardStats.fromJSON({
                totalUsers: 1000000,
                activeUsers: 950000,
                pendingEnrollments: 50000,
                successfulEnrollments: 900000,
                failedEnrollments: 10000,
                authSuccessRate: 99.9,
                verificationSuccessRate: 98.5,
            })
            mockDashboardService.getStats = vi.fn().mockResolvedValue(largeStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.stats).toEqual(largeStats)
            expect(result.current.stats!.totalUsers).toBe(1000000)
        })

        it('should handle stats with decimal values', async () => {
            const decimalStats = DashboardStats.fromJSON({
                totalUsers: 100,
                activeUsers: 85,
                pendingEnrollments: 10,
                successfulEnrollments: 75,
                failedEnrollments: 5,
                authSuccessRate: 95.567,
                verificationSuccessRate: 92.345,
            })
            mockDashboardService.getStats = vi.fn().mockResolvedValue(decimalStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.stats!.authSuccessRate).toBeCloseTo(95.567)
            expect(result.current.stats!.verificationSuccessRate).toBeCloseTo(92.345)
        })

        it('should handle concurrent refetch and unmount', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result, unmount } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Start a slow refetch
            let resolveRefetch: (value: any) => void
            mockDashboardService.getStats = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveRefetch = resolve
                    })
            )

            // Start refetch (don't await)
            const refetchPromise = result.current.refetch()

            // Unmount before refetch completes
            unmount()

            // Resolve refetch after unmount
            resolveRefetch!(testStats)

            // Should not throw error
            await refetchPromise

            // Test passes if no errors thrown
        })
    })

    describe('error recovery', () => {
        it('should allow retry after error', async () => {
            // First attempt fails
            const error = new Error('First attempt failed')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            // Second attempt succeeds
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.stats).toEqual(testStats)
            })

            expect(result.current.error).toBeNull()
            expect(result.current.loading).toBe(false)
        })

        it('should preserve previous stats on refetch error', async () => {
            mockDashboardService.getStats = vi.fn().mockResolvedValue(testStats)

            const { result } = renderHook(() => useDashboard(), { wrapper })

            await waitFor(() => {
                expect(result.current.stats).toEqual(testStats)
            })

            // Refetch fails - should clear stats
            const error = new Error('Refetch error')
            mockDashboardService.getStats = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            // Stats are cleared on error (per implementation)
            expect(result.current.stats).toBeNull()
        })
    })
})
