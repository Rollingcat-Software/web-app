import { z } from 'zod'
import { UserRole, UserStatus } from '@domain/models/User'

/**
 * Create user validation schema
 */
export const CreateUserSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email format')
        .max(255, 'Email is too long'),
    firstName: z
        .string()
        .min(1, 'First name is required')
        .max(100, 'First name is too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters'),
    lastName: z
        .string()
        .min(1, 'Last name is required')
        .max(100, 'Last name is too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters'),
    password: z
        .string()
        .min(12, 'Password must be at least 12 characters')
        .max(100, 'Password is too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    role: z.nativeEnum(UserRole),
    tenantId: z.number().int().positive('Tenant ID must be a positive number'),
})

/**
 * Update user validation schema
 * All fields optional except those that shouldn't change
 */
export const UpdateUserSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .max(255, 'Email is too long')
        .optional(),
    firstName: z
        .string()
        .min(1, 'First name is required')
        .max(100, 'First name is too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters')
        .optional(),
    lastName: z
        .string()
        .min(1, 'Last name is required')
        .max(100, 'Last name is too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters')
        .optional(),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

/**
 * Validate create user input
 */
export function validateCreateUser(data: unknown) {
    return CreateUserSchema.safeParse(data)
}

/**
 * Validate update user input
 */
export function validateUpdateUser(data: unknown) {
    return UpdateUserSchema.safeParse(data)
}
