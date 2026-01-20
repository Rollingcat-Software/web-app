import { useState, useEffect, useCallback } from 'react'
import { container } from '@core/di/container'
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
    const [settings, setSettings] = useState<UserSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const settingsService = container.get<ISettingsService>(TYPES.SettingsService)
    const errorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler)

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await settingsService.getSettings()
            setSettings(data)
        } catch (err) {
            errorHandler.handle(err)
            setError(err instanceof Error ? err.message : 'Failed to load settings')
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const updateProfile = useCallback(async (data: UpdateProfileData) => {
        try {
            setLoading(true)
            const updated = await settingsService.updateProfile(data)
            setSettings(updated)
        } catch (err) {
            errorHandler.handle(err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler])

    const updateNotifications = useCallback(async (data: UpdateNotificationSettings) => {
        try {
            setLoading(true)
            const updated = await settingsService.updateNotifications(data)
            setSettings(updated)
        } catch (err) {
            errorHandler.handle(err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler])

    const updateSecurity = useCallback(async (data: UpdateSecuritySettings) => {
        try {
            setLoading(true)
            const updated = await settingsService.updateSecurity(data)
            setSettings(updated)
        } catch (err) {
            errorHandler.handle(err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler])

    const updateAppearance = useCallback(async (data: UpdateAppearanceSettings) => {
        try {
            setLoading(true)
            const updated = await settingsService.updateAppearance(data)
            setSettings(updated)
        } catch (err) {
            errorHandler.handle(err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler])

    const changePassword = useCallback(async (data: ChangePasswordData) => {
        try {
            setLoading(true)
            await settingsService.changePassword(data)
        } catch (err) {
            errorHandler.handle(err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [settingsService, errorHandler])

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
