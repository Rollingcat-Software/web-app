import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container } from 'inversify'
import { PasswordService } from '../PasswordService'
import { TYPES } from '@core/di/types'

describe('PasswordService', () => {
    let container: Container
    let passwordService: PasswordService
    let mockHttpClient: {
        post: ReturnType<typeof vi.fn>
        get: ReturnType<typeof vi.fn>
        put: ReturnType<typeof vi.fn>
        delete: ReturnType<typeof vi.fn>
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

    beforeEach(() => {
        mockHttpClient = {
            post: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
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
        container.bind(TYPES.HttpClient).toConstantValue(mockHttpClient)
        container.bind(TYPES.Notifier).toConstantValue(mockNotifier)
        container.bind(TYPES.Logger).toConstantValue(mockLogger)
        container.bind(PasswordService).toSelf()

        passwordService = container.get(PasswordService)
    })

    describe('changePassword', () => {
        it('should call API with correct payload', async () => {
            mockHttpClient.post.mockResolvedValue({ data: {} })

            await passwordService.changePassword(1, {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!',
                confirmPassword: 'NewPass456!',
            })

            expect(mockHttpClient.post).toHaveBeenCalledWith('/users/1/change-password', {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!',
                confirmPassword: 'NewPass456!',
            })
        })

        it('should show success notification on success', async () => {
            mockHttpClient.post.mockResolvedValue({ data: {} })

            await passwordService.changePassword(1, {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!',
                confirmPassword: 'NewPass456!',
            })

            expect(mockNotifier.success).toHaveBeenCalledWith('Password changed successfully')
        })

        it('should throw error for mismatched passwords', async () => {
            await expect(
                passwordService.changePassword(1, {
                    currentPassword: 'OldPass123!',
                    newPassword: 'NewPass456!',
                    confirmPassword: 'DifferentPass!',
                })
            ).rejects.toThrow("Passwords don't match")
        })

        it('should throw error for weak password', async () => {
            await expect(
                passwordService.changePassword(1, {
                    currentPassword: 'OldPass123!',
                    newPassword: 'weak',
                    confirmPassword: 'weak',
                })
            ).rejects.toThrow()
        })

        it('should throw error when new password is same as current', async () => {
            await expect(
                passwordService.changePassword(1, {
                    currentPassword: 'SamePass123!',
                    newPassword: 'SamePass123!',
                    confirmPassword: 'SamePass123!',
                })
            ).rejects.toThrow('New password must be different from current password')
        })

        it('should show error notification on API failure', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('API Error'))

            await expect(
                passwordService.changePassword(1, {
                    currentPassword: 'OldPass123!',
                    newPassword: 'NewPass456!',
                    confirmPassword: 'NewPass456!',
                })
            ).rejects.toThrow('API Error')

            expect(mockNotifier.error).toHaveBeenCalledWith('Failed to change password')
        })
    })

    describe('validatePassword', () => {
        it('should return weak for short passwords', () => {
            const result = passwordService.validatePassword('abc')
            expect(result.strength).toBe('weak')
            expect(result.isValid).toBe(false)
        })

        it('should return weak for passwords without uppercase', () => {
            const result = passwordService.validatePassword('password123!')
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain(
                'Password must contain at least one uppercase letter'
            )
        })

        it('should return weak for passwords without lowercase', () => {
            const result = passwordService.validatePassword('PASSWORD123!')
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain(
                'Password must contain at least one lowercase letter'
            )
        })

        it('should return weak for passwords without numbers', () => {
            const result = passwordService.validatePassword('Password!')
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain('Password must contain at least one number')
        })

        it('should return weak for passwords without special characters', () => {
            const result = passwordService.validatePassword('Password123')
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain(
                'Password must contain at least one special character'
            )
        })

        it('should return strong for complex passwords', () => {
            const result = passwordService.validatePassword('ComplexPass123!@#')
            expect(result.strength).toBe('strong')
            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should return strong for passwords meeting all criteria', () => {
            const result = passwordService.validatePassword('Pass123!')
            expect(result.strength).toBe('strong')
            expect(result.isValid).toBe(true)
        })

        it('should return medium for passwords missing some criteria', () => {
            // Has length >= 8, uppercase, lowercase, number but no special char => score 4
            const result = passwordService.validatePassword('Abcdefg1')
            expect(result.strength).toBe('medium')
            expect(result.isValid).toBe(false)
        })
    })
})
