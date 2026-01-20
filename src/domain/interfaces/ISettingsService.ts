import type {
    UserSettings,
    UpdateProfileData,
    UpdateNotificationSettings,
    UpdateSecuritySettings,
    UpdateAppearanceSettings,
    ChangePasswordData,
} from './ISettingsRepository'

/**
 * Settings Service Interface
 */
export interface ISettingsService {
    /**
     * Get current user settings
     */
    getSettings(): Promise<UserSettings>

    /**
     * Update profile information
     */
    updateProfile(data: UpdateProfileData): Promise<UserSettings>

    /**
     * Update notification settings
     */
    updateNotifications(data: UpdateNotificationSettings): Promise<UserSettings>

    /**
     * Update security settings
     */
    updateSecurity(data: UpdateSecuritySettings): Promise<UserSettings>

    /**
     * Update appearance settings
     */
    updateAppearance(data: UpdateAppearanceSettings): Promise<UserSettings>

    /**
     * Change password
     */
    changePassword(data: ChangePasswordData): Promise<void>

    /**
     * Validate password strength
     */
    validatePassword(password: string): { valid: boolean; errors: string[] }
}
