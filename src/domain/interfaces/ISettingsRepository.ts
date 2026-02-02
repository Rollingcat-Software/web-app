/**
 * User Settings Repository Interface
 */

export interface UserSettings {
    userId: string
    // Profile settings
    firstName: string
    lastName: string
    // Notification settings
    emailNotifications: boolean
    loginAlerts: boolean
    securityAlerts: boolean
    weeklyReports: boolean
    // Security settings
    twoFactorEnabled: boolean
    sessionTimeoutMinutes: number
    // Appearance settings
    darkMode: boolean
    compactView: boolean
}

export interface UpdateProfileData {
    firstName: string
    lastName: string
}

export interface UpdateNotificationSettings {
    emailNotifications: boolean
    loginAlerts: boolean
    securityAlerts: boolean
    weeklyReports: boolean
}

export interface UpdateSecuritySettings {
    twoFactorEnabled: boolean
    sessionTimeoutMinutes: number
}

export interface UpdateAppearanceSettings {
    darkMode: boolean
    compactView: boolean
}

export interface ChangePasswordData {
    currentPassword: string
    newPassword: string
    confirmPassword: string
}

export interface ISettingsRepository {
    /**
     * Get user settings
     */
    getSettings(userId: string): Promise<UserSettings>

    /**
     * Update profile information
     */
    updateProfile(userId: string, data: UpdateProfileData): Promise<UserSettings>

    /**
     * Update notification settings
     */
    updateNotifications(userId: string, data: UpdateNotificationSettings): Promise<UserSettings>

    /**
     * Update security settings
     */
    updateSecurity(userId: string, data: UpdateSecuritySettings): Promise<UserSettings>

    /**
     * Update appearance settings
     */
    updateAppearance(userId: string, data: UpdateAppearanceSettings): Promise<UserSettings>

    /**
     * Change password
     */
    changePassword(userId: string, data: ChangePasswordData): Promise<void>
}
