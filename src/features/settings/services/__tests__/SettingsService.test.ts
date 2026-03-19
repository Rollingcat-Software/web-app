import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container } from 'inversify'
import { SettingsService } from '../SettingsService'
import { TYPES } from '@core/di/types'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { ISettingsRepository, UserSettings } from '@domain/interfaces/ISettingsRepository'
import type { INotifier } from '@domain/interfaces/INotifier'
import { User, UserRole, UserStatus } from '@domain/models/User'

describe('SettingsService', () => {
    let container: Container
    let settingsService: SettingsService
    let mockRepository: {
        getSettings: ReturnType<typeof vi.fn>
        updateProfile: ReturnType<typeof vi.fn>
        updateNotifications: ReturnType<typeof vi.fn>
        updateSecurity: ReturnType<typeof vi.fn>
        updateAppearance: ReturnType<typeof vi.fn>
        changePassword: ReturnType<typeof vi.fn>
    }
    let mockAuthService: {
        getCurrentUser: ReturnType<typeof vi.fn>
        login: ReturnType<typeof vi.fn>
        logout: ReturnType<typeof vi.fn>
    }
    let mockNotifier: {
        success: ReturnType<typeof vi.fn>
        error: ReturnType<typeof vi.fn>
        warning: ReturnType<typeof vi.fn>
        info: ReturnType<typeof vi.fn>
    }

    const testUser = new User(
        '1',
        'test@example.com',
        'Test',
        'User',
        UserRole.ADMIN,
        UserStatus.ACTIVE,
        '1',
        new Date(),
        new Date()
    )

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

    beforeEach(() => {
        mockRepository = {
            getSettings: vi.fn(),
            updateProfile: vi.fn(),
            updateNotifications: vi.fn(),
            updateSecurity: vi.fn(),
            updateAppearance: vi.fn(),
            changePassword: vi.fn(),
        }
        mockAuthService = {
            getCurrentUser: vi.fn().mockResolvedValue(testUser),
            login: vi.fn(),
            logout: vi.fn(),
        }
        mockNotifier = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.SettingsRepository).toConstantValue(mockRepository)
        container.bind(TYPES.AuthService).toConstantValue(mockAuthService)
        container.bind(TYPES.Notifier).toConstantValue(mockNotifier)
        container.bind(SettingsService).toSelf()

        settingsService = container.get(SettingsService)
    })

    describe('getSettings', () => {
        it('should load settings for authenticated user', async () => {
            mockRepository.getSettings.mockResolvedValue(mockSettings)

            const result = await settingsService.getSettings()

            expect(mockAuthService.getCurrentUser).toHaveBeenCalled()
            expect(mockRepository.getSettings).toHaveBeenCalledWith('1')
            expect(result).toEqual(mockSettings)
        })

        it('should throw error when user is not authenticated', async () => {
            mockAuthService.getCurrentUser.mockResolvedValue(null)

            await expect(settingsService.getSettings()).rejects.toThrow('User not authenticated')
        })
    })

    describe('updateProfile', () => {
        it('should update profile for authenticated user', async () => {
            const profileData = { firstName: 'Updated', lastName: 'Name' }
            const updatedSettings = { ...mockSettings, ...profileData }
            mockRepository.updateProfile.mockResolvedValue(updatedSettings)

            const result = await settingsService.updateProfile(profileData)

            expect(mockRepository.updateProfile).toHaveBeenCalledWith('1', profileData)
            expect(result).toEqual(updatedSettings)
        })

        it('should show success notification', async () => {
            mockRepository.updateProfile.mockResolvedValue(mockSettings)

            await settingsService.updateProfile({ firstName: 'Test', lastName: 'User' })

            expect(mockNotifier.success).toHaveBeenCalledWith('Profile updated successfully')
        })

        it('should throw error for empty first name', async () => {
            await expect(
                settingsService.updateProfile({ firstName: '', lastName: 'User' })
            ).rejects.toThrow('First name is required')
        })

        it('should throw error for empty last name', async () => {
            await expect(
                settingsService.updateProfile({ firstName: 'Test', lastName: '' })
            ).rejects.toThrow('Last name is required')
        })
    })

    describe('updateNotifications', () => {
        it('should update notification settings', async () => {
            const notifData = {
                emailNotifications: false,
                loginAlerts: true,
                securityAlerts: true,
                weeklyReports: true,
            }
            const updatedSettings = { ...mockSettings, ...notifData }
            mockRepository.updateNotifications.mockResolvedValue(updatedSettings)

            const result = await settingsService.updateNotifications(notifData)

            expect(mockRepository.updateNotifications).toHaveBeenCalledWith('1', notifData)
            expect(result).toEqual(updatedSettings)
            expect(mockNotifier.success).toHaveBeenCalledWith('Notification settings updated')
        })
    })

    describe('updateSecurity', () => {
        it('should update security settings', async () => {
            const secData = { twoFactorEnabled: true, sessionTimeoutMinutes: 60 }
            const updatedSettings = { ...mockSettings, ...secData }
            mockRepository.updateSecurity.mockResolvedValue(updatedSettings)

            const result = await settingsService.updateSecurity(secData)

            expect(mockRepository.updateSecurity).toHaveBeenCalledWith('1', secData)
            expect(result).toEqual(updatedSettings)
            expect(mockNotifier.success).toHaveBeenCalledWith('Security settings updated')
        })

        it('should throw error for invalid session timeout', async () => {
            await expect(
                settingsService.updateSecurity({ twoFactorEnabled: false, sessionTimeoutMinutes: 3 })
            ).rejects.toThrow('Session timeout must be between 5 and 480 minutes')
        })
    })

    describe('changePassword', () => {
        it('should change password successfully', async () => {
            mockRepository.changePassword.mockResolvedValue(undefined)

            await settingsService.changePassword({
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!@',
                confirmPassword: 'NewPass456!@',
            })

            expect(mockRepository.changePassword).toHaveBeenCalledWith('1', {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!@',
                confirmPassword: 'NewPass456!@',
            })
            expect(mockNotifier.success).toHaveBeenCalledWith('Password changed successfully')
        })

        it('should throw error for mismatched passwords', async () => {
            await expect(
                settingsService.changePassword({
                    currentPassword: 'OldPass123!',
                    newPassword: 'NewPass456!@',
                    confirmPassword: 'DifferentPass!@',
                })
            ).rejects.toThrow('Passwords do not match')
        })
    })
})
