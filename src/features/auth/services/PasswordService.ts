import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { INotifier } from '@domain/interfaces/INotifier'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IPasswordService,
    ChangePasswordRequest,
    PasswordValidation,
} from '@domain/interfaces/IPasswordService'
import {
    ChangePasswordSchema,
    calculatePasswordStrength,
    validatePasswordRules,
} from '@domain/validators/passwordValidator'

/**
 * Password Service
 * Handles password change and validation operations
 */
@injectable()
export class PasswordService implements IPasswordService {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Notifier) private readonly notifier: INotifier,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async changePassword(userId: number, request: ChangePasswordRequest): Promise<void> {
        this.logger.debug('[PasswordService] Attempting password change', { userId })

        // Validate request
        const validation = ChangePasswordSchema.safeParse(request)
        if (!validation.success) {
            const errors = validation.error.errors.map((e) => e.message)
            this.logger.warn('[PasswordService] Password validation failed', { errors })
            throw new Error(errors[0])
        }

        try {
            await this.httpClient.post(`/users/${userId}/change-password`, {
                currentPassword: request.currentPassword,
                newPassword: request.newPassword,
                confirmPassword: request.confirmPassword,
            })

            this.notifier.success('Password changed successfully')
            this.logger.info('[PasswordService] Password changed successfully', { userId })
        } catch (error) {
            this.logger.error('[PasswordService] Password change failed', { userId, error })
            this.notifier.error('Failed to change password')
            throw error
        }
    }

    validatePassword(password: string): PasswordValidation {
        const { isValid, errors } = validatePasswordRules(password)
        const strength = calculatePasswordStrength(password)

        return {
            isValid,
            errors,
            strength,
        }
    }
}
