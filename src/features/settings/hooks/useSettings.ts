import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ISettingsService } from '@domain/interfaces/ISettingsService'
import type {
    UserSettings,
    UpdateProfileData,
    UpdateNotificationSettings,
    UpdateSecuritySettings,
    UpdateAppearanceSettings,
    ChangePasswordData,
} from '@domain/interfaces/ISettingsRepository'
import { ErrorHandler } from '@core/errors/ErrorHandler'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'

interface UseSettingsReturn {
    settings: UserSettings | null
    loading: boolean
    error: string | null
    updateProfile: (data: UpdateProfileData) => Promise<void>
    updateNotifications: (data: UpdateNotificationSettings) => Promise<void>
    updateSecurity: (data: UpdateSecuritySettings) => Promise<void>
    updateAppearance: (data: UpdateAppearanceSettings) => Promise<void>
    changePassword: (data: ChangePasswordData) => Promise<void>
    validatePassword: (password: string) => { valid: boolean; errors: string[] }
    refresh: () => Promise<void>
}

/**
 * Hook for managing user settings
 */
export function useSettings(): UseSettingsReturn {
    const { t } = useTranslation()
    const [settings, setSettings] = useState<UserSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const settingsService = useService<ISettingsService>(TYPES.SettingsService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await settingsService.getSettings()
            setSettings(data)
        } catch (err) {
            errorHandler.handle(err)
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler, t])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const updateProfile = useCallback(async (data: UpdateProfileData) => {
        try {
            setLoading(true)
            setError(null)
            const updated = await settingsService.updateProfile(data)
            setSettings(updated)
        } catch (err) {
            // P1-FE-4: also set inline `error` state so SettingsPage's
            // page-level <Alert> can render the backend's actual reason
            // instead of relying solely on the (English-only) toaster.
            errorHandler.handle(err)
            setError(formatApiError(err, t))
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler, t])

    const updateNotifications = useCallback(async (data: UpdateNotificationSettings) => {
        try {
            setLoading(true)
            setError(null)
            const updated = await settingsService.updateNotifications(data)
            setSettings(updated)
        } catch (err) {
            // P1-FE-4: also set inline `error` state so SettingsPage's
            // page-level <Alert> can render the backend's actual reason
            // instead of relying solely on the (English-only) toaster.
            errorHandler.handle(err)
            setError(formatApiError(err, t))
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler, t])

    const updateSecurity = useCallback(async (data: UpdateSecuritySettings) => {
        try {
            setLoading(true)
            setError(null)
            const updated = await settingsService.updateSecurity(data)
            setSettings(updated)
        } catch (err) {
            // P1-FE-4: also set inline `error` state so SettingsPage's
            // page-level <Alert> can render the backend's actual reason
            // instead of relying solely on the (English-only) toaster.
            errorHandler.handle(err)
            setError(formatApiError(err, t))
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler, t])

    const updateAppearance = useCallback(async (data: UpdateAppearanceSettings) => {
        try {
            setLoading(true)
            setError(null)
            const updated = await settingsService.updateAppearance(data)
            setSettings(updated)
        } catch (err) {
            // P1-FE-4: also set inline `error` state so SettingsPage's
            // page-level <Alert> can render the backend's actual reason
            // instead of relying solely on the (English-only) toaster.
            errorHandler.handle(err)
            setError(formatApiError(err, t))
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler, t])

    const changePassword = useCallback(async (data: ChangePasswordData) => {
        try {
            setLoading(true)
            setError(null)
            await settingsService.changePassword(data)
        } catch (err) {
            // P1-FE-4: also set inline `error` state so SettingsPage's
            // page-level <Alert> can render the backend's actual reason
            // instead of relying solely on the (English-only) toaster.
            errorHandler.handle(err)
            setError(formatApiError(err, t))
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler, t])

    const validatePassword = useCallback((password: string) => {
        return settingsService.validatePassword(password)
    }, [settingsService])

    return {
        settings,
        loading,
        error,
        updateProfile,
        updateNotifications,
        updateSecurity,
        updateAppearance,
        changePassword,
        validatePassword,
        refresh: fetchSettings,
    }
}
