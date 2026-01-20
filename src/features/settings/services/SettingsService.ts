import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { INotifier } from '@domain/interfaces/INotifier'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type {
    ISettingsRepository,
    UserSettings,
    UpdateProfileData,
    UpdateNotificationSettings,
    UpdateSecuritySettings,
    UpdateAppearanceSettings,
    ChangePasswordData,
} from '@domain/interfaces/ISettingsRepository'
import type { ISettingsService } from '@domain/interfaces/ISettingsService'

/**
 * Settings Service
 * Business logic for user settings management
 */
@injectable()
export class SettingsService implements ISettingsService {
    constructor(
        @inject(TYPES.SettingsRepository) private readonly settingsRepository: ISettingsRepository,
        @inject(TYPES.AuthService) private readonly authService: IAuthService,
        @inject(TYPES.Notifier) private readonly notifier: INotifier
    ) {}

    /**
     * Get current user settings
     */
    async getSettings(): Promise<UserSettings> {
        const user = await this.authService.getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        return this.settingsRepository.getSettings(user.id)
    }

    /**
     * Update profile information
     */
    async updateProfile(data: UpdateProfileData): Promise<UserSettings> {
        const user = await this.authService.getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        // Validate input
        if (!data.firstName?.trim()) {
            throw new Error('First name is required')
        }
        if (!data.lastName?.trim()) {
            throw new Error('Last name is required')
        }

        const settings = await this.settingsRepository.updateProfile(user.id, data)
        this.notifier.success('Profile updated successfully')
        return settings
    }

    /**
     * Update notification settings
     */
    async updateNotifications(data: UpdateNotificationSettings): Promise<UserSettings> {
        const user = await this.authService.getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        const settings = await this.settingsRepository.updateNotifications(user.id, data)
        this.notifier.success('Notification settings updated')
        return settings
    }

    /**
     * Update security settings
     */
    async updateSecurity(data: UpdateSecuritySettings): Promise<UserSettings> {
        const user = await this.authService.getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        // Validate session timeout
        if (data.sessionTimeoutMinutes < 5 || data.sessionTimeoutMinutes > 480) {
            throw new Error('Session timeout must be between 5 and 480 minutes')
        }

        const settings = await this.settingsRepository.updateSecurity(user.id, data)
        this.notifier.success('Security settings updated')
        return settings
    }

    /**
     * Update appearance settings
     */
    async updateAppearance(data: UpdateAppearanceSettings): Promise<UserSettings> {
        const user = await this.authService.getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        const settings = await this.settingsRepository.updateAppearance(user.id, data)
        this.notifier.success('Appearance settings updated')
        return settings
    }

    /**
     * Change password
     */
    async changePassword(data: ChangePasswordData): Promise<void> {
        const user = await this.authService.getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        // Validate passwords
        if (data.newPassword !== data.confirmPassword) {
            throw new Error('Passwords do not match')
        }

        const validation = this.validatePassword(data.newPassword)
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '))
        }

        await this.settingsRepository.changePassword(user.id, data)
        this.notifier.success('Password changed successfully')
    }

    /**
     * Validate password strength
     */
    validatePassword(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = []

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters')
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter')
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter')
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number')
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }
}
