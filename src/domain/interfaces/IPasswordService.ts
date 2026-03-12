/**
 * Password Service Interface
 * Defines the contract for password management operations
 */

export interface ChangePasswordRequest {
    currentPassword: string
    newPassword: string
    confirmPassword: string
}

export interface PasswordValidation {
    isValid: boolean
    errors: string[]
    strength: 'weak' | 'medium' | 'strong'
}

export interface IPasswordService {
    /**
     * Change user's password
     */
    changePassword(userId: string, request: ChangePasswordRequest): Promise<void>

    /**
     * Validate password strength and rules
     */
    validatePassword(password: string): PasswordValidation
}
