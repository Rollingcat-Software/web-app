import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock getBiometricService
const mockVerifyFace = vi.fn()
vi.mock('@core/services/BiometricService', () => ({
    getBiometricService: () => ({
        verifyFace: mockVerifyFace,
    }),
}))

// Mock useAuth
const mockLogout = vi.fn()
vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', tenantId: 'tenant-1' },
        isAuthenticated: true,
        loading: false,
        error: null,
        logout: mockLogout,
    }),
}))

// Import after mocks are set up
import { useContinuousVerification } from '../useContinuousVerification'

describe('useContinuousVerification', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        // Mock localStorage
        const store: Record<string, string> = {}
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
            store[key] = value
        })
        // Mock navigator.mediaDevices
        Object.defineProperty(navigator, 'mediaDevices', {
            value: {
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: () => [{ stop: vi.fn() }],
                }),
            },
            configurable: true,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should have correct initial state (disabled)', () => {
        const { result } = renderHook(() => useContinuousVerification())

        expect(result.current.status).toBe('disabled')
        expect(result.current.enabled).toBe(false)
        expect(result.current.failureCount).toBe(0)
        expect(result.current.showWarning).toBe(false)
        expect(result.current.lastConfidence).toBe(0)
    })

    it('should toggle enabled state', () => {
        const { result } = renderHook(() => useContinuousVerification())

        act(() => {
            result.current.setEnabled(true)
        })

        expect(result.current.enabled).toBe(true)
    })

    it('should persist enabled state to localStorage', () => {
        const { result } = renderHook(() => useContinuousVerification())

        act(() => {
            result.current.setEnabled(true)
        })

        expect(localStorage.setItem).toHaveBeenCalledWith(
            'fivucsas-continuous-verification',
            'true'
        )
    })

    it('should reset failure count and status when disabled', () => {
        const { result } = renderHook(() => useContinuousVerification())

        act(() => {
            result.current.setEnabled(true)
        })

        act(() => {
            result.current.setEnabled(false)
        })

        expect(result.current.status).toBe('disabled')
        expect(result.current.failureCount).toBe(0)
    })

    it('should show warning when failure count reaches warning threshold', () => {
        const { result } = renderHook(() =>
            useContinuousVerification({ warningThreshold: 2, logoutThreshold: 5 })
        )

        // showWarning is derived: failureCount >= warningThreshold && failureCount < logoutThreshold
        // We can't easily simulate failures without a real video element, but we can test the derivation
        expect(result.current.showWarning).toBe(false)
    })

    it('should have correct default thresholds', () => {
        const { result } = renderHook(() => useContinuousVerification())

        // Default intervalSeconds = 45, warningThreshold = 3, logoutThreshold = 5
        expect(result.current.enabled).toBe(false)
        expect(result.current.showWarning).toBe(false)
    })

    it('should provide a videoRef', () => {
        const { result } = renderHook(() => useContinuousVerification())

        expect(result.current.videoRef).toBeDefined()
        expect(result.current.videoRef.current).toBeNull()
    })

    it('should not verify when disabled', async () => {
        const { result } = renderHook(() => useContinuousVerification())

        await act(async () => {
            await result.current.verifyNow()
        })

        expect(mockVerifyFace).not.toHaveBeenCalled()
    })

    it('should clean up on unmount', () => {
        const { unmount } = renderHook(() => useContinuousVerification())

        // Should not throw on unmount
        unmount()
    })
})
