import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    ISettingsRepository,
    UserSettings,
    UpdateProfileData,
    UpdateNotificationSettings,
    UpdateSecuritySettings,
    UpdateAppearanceSettings,
    ChangePasswordData,
} from '@domain/interfaces/ISettingsRepository'

/**
 * Settings Repository
 * Handles user settings API calls
 */
@injectable()
export class SettingsRepository implements ISettingsRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Get user settings
     */
    async getSettings(userId: string): Promise<UserSettings> {
        try {
            this.logger.debug(`Fetching settings for user ${userId}`)

            interface SettingsApiResponse {
                firstName?: string
                lastName?: string
                phoneNumber?: string
                profile?: { firstName?: string; lastName?: string; phoneNumber?: string }
                notifications?: { email?: boolean; push?: boolean; securityAlerts?: boolean }
                security?: { twoFactorEnabled?: boolean; sessionTimeout?: number }
                appearance?: { theme?: string; density?: string }
            }

            const response = await this.httpClient.get<SettingsApiResponse>(`/users/${userId}/settings`)
            const data = response.data

            // Map nested backend format to flat frontend format
            return {
                userId,
                firstName: data?.profile?.firstName ?? data?.firstName ?? '',
                lastName: data?.profile?.lastName ?? data?.lastName ?? '',
                phoneNumber: data?.profile?.phoneNumber ?? data?.phoneNumber ?? '',
                emailNotifications: data?.notifications?.email ?? true,
                loginAlerts: data?.notifications?.push ?? true,
                securityAlerts: data?.notifications?.securityAlerts ?? true,
                weeklyReports: false,
                twoFactorEnabled: data?.security?.twoFactorEnabled ?? false,
                sessionTimeoutMinutes: data?.security?.sessionTimeout ?? 30,
                darkMode: data?.appearance?.theme === 'dark',
                compactView: data?.appearance?.density === 'compact',
            }
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            // Return default settings if not found or not authorized
            if (axiosError.response?.status === 404 || axiosError.response?.status === 403) {
                return this.getDefaultSettings(userId)
            }
            this.logger.error('Failed to fetch settings', error)
            throw error
        }
    }

    /**
     * Update profile information
     */
    async updateProfile(userId: string, data: UpdateProfileData): Promise<UserSettings> {
        try {
            this.logger.info(`Updating profile for user ${userId}`)

            await this.httpClient.put<UserSettings>(`/users/${userId}`, data)

            // Return updated settings
            return this.getSettings(userId)
        } catch (error) {
            this.logger.error('Failed to update profile', error)
            throw error
        }
    }

    /**
     * Update notification settings
     */
    async updateNotifications(userId: string, data: UpdateNotificationSettings): Promise<UserSettings> {
        try {
            this.logger.info(`Updating notifications for user ${userId}`)

            await this.httpClient.put(
                `/users/${userId}/settings/notifications`,
                {
                    email: data.emailNotifications,
                    push: data.loginAlerts,
                    securityAlerts: data.securityAlerts,
                }
            )

            return this.getSettings(userId)
        } catch (error) {
            this.logger.error('Failed to update notifications', error)
            throw error
        }
    }

    /**
     * Update security settings
     */
    async updateSecurity(userId: string, data: UpdateSecuritySettings): Promise<UserSettings> {
        try {
            this.logger.info(`Updating security settings for user ${userId}`)

            await this.httpClient.put(
                `/users/${userId}/settings/security`,
                {
                    twoFactorEnabled: data.twoFactorEnabled,
                    sessionTimeout: data.sessionTimeoutMinutes,
                }
            )

            return this.getSettings(userId)
        } catch (error) {
            this.logger.error('Failed to update security settings', error)
            throw error
        }
    }

    /**
     * Update appearance settings
     */
    async updateAppearance(userId: string, data: UpdateAppearanceSettings): Promise<UserSettings> {
        try {
            this.logger.info(`Updating appearance settings for user ${userId}`)

            await this.httpClient.put(
                `/users/${userId}/settings/appearance`,
                {
                    theme: data.darkMode ? 'dark' : 'light',
                    language: 'en',
                    density: data.compactView ? 'compact' : 'comfortable',
                }
            )

            return this.getSettings(userId)
        } catch (error) {
            this.logger.error('Failed to update appearance settings', error)
            throw error
        }
    }

    /**
     * Change password
     */
    async changePassword(userId: string, data: ChangePasswordData): Promise<void> {
        try {
            this.logger.info(`Changing password for user ${userId}`)

            await this.httpClient.post(`/users/${userId}/change-password`, {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            })

            this.logger.info('Password changed successfully')
        } catch (error) {
            this.logger.error('Failed to change password', error)
            throw error
        }
    }

    /**
     * Get default settings for new users
     */
    private getDefaultSettings(userId: string): UserSettings {
        return {
            userId,
            firstName: '',
            lastName: '',
            phoneNumber: '',
            emailNotifications: true,
            loginAlerts: true,
            securityAlerts: true,
            weeklyReports: false,
            twoFactorEnabled: false,
            sessionTimeoutMinutes: 30,
            darkMode: false,
            compactView: false,
        }
    }
}
