import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useSettings } from '../useSettings'
import { DependencyProvider } from '@app/providers/DependencyProvider'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import type { UserSettings } from '@domain/interfaces/ISettingsRepository'

// Mock useAuth
vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'ADMIN' },
        isAuthenticated: true,
        loading: false,
        error: null,
    }),
}))

describe('useSettings', () => {
    let container: Container
    let mockSettingsService: {
        getSettings: ReturnType<typeof vi.fn>
        updateProfile: ReturnType<typeof vi.fn>
        updateNotifications: ReturnType<typeof vi.fn>
        updateSecurity: ReturnType<typeof vi.fn>
        updateAppearance: ReturnType<typeof vi.fn>
        changePassword: ReturnType<typeof vi.fn>
        validatePassword: ReturnType<typeof vi.fn>
    }
    let mockErrorHandler: {
        handle: ReturnType<typeof vi.fn>
    }

    const mockSettings: UserSettings = {
        userId: '1',
        firstName: 'Test',
        lastName: 'User',
        emailNotifications: true,
        loginAlerts: true,
        securityAlerts: true,
        weeklyReports: false,
        twoFactorEnabled: false,
        sessionTimeoutMinutes: 30,
        darkMode: false,
        compactView: false,
    }

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
        mockSettingsService = {
            getSettings: vi.fn().mockResolvedValue(mockSettings),
            updateProfile: vi.fn().mockResolvedValue(mockSettings),
            updateNotifications: vi.fn().mockResolvedValue(mockSettings),
            updateSecurity: vi.fn().mockResolvedValue(mockSettings),
            updateAppearance: vi.fn().mockResolvedValue(mockSettings),
            changePassword: vi.fn().mockResolvedValue(undefined),
            validatePassword: vi.fn().mockReturnValue({ valid: true, errors: [] }),
        }

        mockErrorHandler = {
            handle: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.SettingsService).toConstantValue(mockSettingsService)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)
    })

    it('should load settings on mount', async () => {
        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.settings).toEqual(mockSettings)
        expect(mockSettingsService.getSettings).toHaveBeenCalled()
    })

    it('should handle load error', async () => {
        const error = new Error('Load failed')
        mockSettingsService.getSettings.mockRejectedValue(error)

        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toBe('Load failed')
        expect(result.current.settings).toBeNull()
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
    })

    it('should update profile', async () => {
        const updatedSettings = { ...mockSettings, firstName: 'Updated' }
        mockSettingsService.updateProfile.mockResolvedValue(updatedSettings)

        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.updateProfile({ firstName: 'Updated', lastName: 'User' })
        })

        expect(mockSettingsService.updateProfile).toHaveBeenCalledWith({
            firstName: 'Updated',
            lastName: 'User',
        })
        expect(result.current.settings?.firstName).toBe('Updated')
    })

    it('should refresh settings', async () => {
        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        // Call refresh
        await act(async () => {
            await result.current.refresh()
        })

        // getSettings should have been called twice (mount + refresh)
        expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(2)
    })

    it('should validate password', async () => {
        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const validation = result.current.validatePassword('TestPass123!')

        expect(mockSettingsService.validatePassword).toHaveBeenCalledWith('TestPass123!')
        expect(validation).toEqual({ valid: true, errors: [] })
    })
})
