import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container } from 'inversify'
import { SettingsService } from '../SettingsService'
import { TYPES } from '@core/di/types'
import { DEFAULT_SETTINGS } from '@domain/interfaces/ISettingsRepository'

describe('SettingsService', () => {
    let container: Container
    let settingsService: SettingsService
    let mockRepository: {
        getSettings: ReturnType<typeof vi.fn>
        updateSettings: ReturnType<typeof vi.fn>
    }
    let mockNotifier: {
        success: ReturnType<typeof vi.fn>
        error: ReturnType<typeof vi.fn>
        warning: ReturnType<typeof vi.fn>
        info: ReturnType<typeof vi.fn>
    }
    let mockLogger: {
        debug: ReturnType<typeof vi.fn>
        info: ReturnType<typeof vi.fn>
        warn: ReturnType<typeof vi.fn>
        error: ReturnType<typeof vi.fn>
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

    beforeEach(() => {
        mockRepository = {
            getSettings: vi.fn(),
            updateSettings: vi.fn(),
        }
        mockNotifier = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn(),
        }
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.SettingsRepository).toConstantValue(mockRepository)
        container.bind(TYPES.Notifier).toConstantValue(mockNotifier)
        container.bind(TYPES.Logger).toConstantValue(mockLogger)
        container.bind(SettingsService).toSelf()

        settingsService = container.get(SettingsService)
    })

    describe('loadSettings', () => {
        it('should load settings from repository', async () => {
            mockRepository.getSettings.mockResolvedValue(mockSettings)

            const result = await settingsService.loadSettings(1)

            expect(mockRepository.getSettings).toHaveBeenCalledWith(1)
            expect(result).toEqual(mockSettings)
        })

        it('should log debug message when loading', async () => {
            mockRepository.getSettings.mockResolvedValue(mockSettings)

            await settingsService.loadSettings(1)

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'SettingsService',
                'Loading settings for user',
                { userId: 1 }
            )
        })

        it('should throw and log error on failure', async () => {
            const error = new Error('Load failed')
            mockRepository.getSettings.mockRejectedValue(error)

            await expect(settingsService.loadSettings(1)).rejects.toThrow('Load failed')
            expect(mockLogger.error).toHaveBeenCalled()
        })
    })

    describe('saveSettings', () => {
        it('should save settings to repository', async () => {
            const updates = { theme: 'light' as const }
            const updatedSettings = { ...mockSettings, ...updates }
            mockRepository.updateSettings.mockResolvedValue(updatedSettings)

            const result = await settingsService.saveSettings(1, updates)

            expect(mockRepository.updateSettings).toHaveBeenCalledWith(1, updates)
            expect(result).toEqual(updatedSettings)
        })

        it('should show success notification', async () => {
            mockRepository.updateSettings.mockResolvedValue(mockSettings)

            await settingsService.saveSettings(1, { theme: 'dark' })

            expect(mockNotifier.success).toHaveBeenCalledWith('Settings saved successfully')
        })

        it('should show error notification on failure', async () => {
            mockRepository.updateSettings.mockRejectedValue(new Error('Save failed'))

            await expect(settingsService.saveSettings(1, { theme: 'dark' })).rejects.toThrow()
            expect(mockNotifier.error).toHaveBeenCalledWith('Failed to save settings')
        })
    })

    describe('resetSettings', () => {
        it('should reset settings to defaults', async () => {
            mockRepository.updateSettings.mockResolvedValue(DEFAULT_SETTINGS)

            const result = await settingsService.resetSettings(1)

            expect(mockRepository.updateSettings).toHaveBeenCalledWith(1, DEFAULT_SETTINGS)
            expect(result).toEqual(DEFAULT_SETTINGS)
        })

        it('should show success notification', async () => {
            mockRepository.updateSettings.mockResolvedValue(DEFAULT_SETTINGS)

            await settingsService.resetSettings(1)

            expect(mockNotifier.success).toHaveBeenCalledWith('Settings reset to defaults')
        })

        it('should show error notification on failure', async () => {
            mockRepository.updateSettings.mockRejectedValue(new Error('Reset failed'))

            await expect(settingsService.resetSettings(1)).rejects.toThrow()
            expect(mockNotifier.error).toHaveBeenCalledWith('Failed to reset settings')
        })
    })
})
