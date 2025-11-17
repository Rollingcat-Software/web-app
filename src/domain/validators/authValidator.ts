import { z } from 'zod'

/**
 * Login credentials validation schema
 */
export const LoginCredentialsSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email format')
        .max(255, 'Email is too long'),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password is too long'),
    mfaCode: z
        .string()
        .length(6, 'MFA code must be 6 digits')
        .regex(/^\d+$/, 'MFA code must be numeric')
        .optional(),
})

export type LoginCredentialsInput = z.infer<typeof LoginCredentialsSchema>

/**
 * Validate login credentials
 */
export function validateLoginCredentials(data: unknown): {
    success: boolean
    data?: LoginCredentialsInput
    errors?: z.ZodError
} {
    const result = LoginCredentialsSchema.safeParse(data)
    if (result.success) {
        return { success: true, data: result.data }
    }
    return { success: false, errors: result.error }
}
