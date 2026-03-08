import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useSettings } from '../useSettings'
import { DependencyProvider } from '@app/providers/DependencyProvider'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import { DEFAULT_SETTINGS } from '@domain/interfaces/ISettingsRepository'

// Mock useAuth
vi.mock('@features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 1, firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'ADMIN' },
        isAuthenticated: true,
        loading: false,
        error: null,
    }),
}))

describe('useSettings', () => {
    let container: Container
    let mockSettingsService: {
        loadSettings: ReturnType<typeof vi.fn>
        saveSettings: ReturnType<typeof vi.fn>
        resetSettings: ReturnType<typeof vi.fn>
    }

    const mockSettings = {
        theme: 'dark' as const,
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationsEnabled: true,
        emailNotifications: true,
        loginAlerts: true,
        securityAlerts: true,
        weeklyReports: false,
        twoFactorEnabled: false,
        sessionTimeout: 30,
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
            loadSettings: vi.fn().mockResolvedValue(mockSettings),
            saveSettings: vi.fn().mockResolvedValue(mockSettings),
            resetSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
        }

        container = new Container()
        container.bind(TYPES.SettingsService).toConstantValue(mockSettingsService)
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
        expect(mockSettingsService.loadSettings).toHaveBeenCalledWith(1)
    })

    it('should handle load error', async () => {
        const error = new Error('Load failed')
        mockSettingsService.loadSettings.mockRejectedValue(error)

        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toEqual(error)
        expect(result.current.settings).toBeNull()
    })

    it('should update settings', async () => {
        const updatedSettings = { ...mockSettings, theme: 'light' as const }
        mockSettingsService.saveSettings.mockResolvedValue(updatedSettings)

        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.updateSettings({ theme: 'light' })
        })

        expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(1, { theme: 'light' })
        expect(result.current.settings?.theme).toBe('light')
    })

    it('should reset settings', async () => {
        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.resetSettings()
        })

        expect(mockSettingsService.resetSettings).toHaveBeenCalledWith(1)
        expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    })

    it('should set saving state during update', async () => {
        let resolvePromise: (value: unknown) => void
        mockSettingsService.saveSettings.mockReturnValue(
            new Promise((resolve) => {
                resolvePromise = resolve
            })
        )

        const { result } = renderHook(() => useSettings(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        act(() => {
            result.current.updateSettings({ theme: 'light' })
        })

        expect(result.current.saving).toBe(true)

        await act(async () => {
            resolvePromise!(mockSettings)
        })

        expect(result.current.saving).toBe(false)
    })
})
