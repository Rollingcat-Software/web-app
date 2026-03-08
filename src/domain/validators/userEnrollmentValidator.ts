import { z } from 'zod'

export const IdInfoSchema = z.object({
    nationalId: z
        .string()
        .min(1, 'National ID is required')
        .max(20, 'National ID must be at most 20 characters')
        .regex(/^[A-Za-z0-9-]+$/, 'National ID must contain only letters, numbers, and hyphens'),
    dateOfBirth: z
        .string()
        .min(1, 'Date of birth is required')
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
    fullName: z
        .string()
        .min(2, 'Full name must be at least 2 characters')
        .max(200, 'Full name must be at most 200 characters')
        .regex(/^[a-zA-Z\s'-]+$/, 'Full name must contain only letters, spaces, hyphens, and apostrophes'),
})

export type IdInfoInput = z.infer<typeof IdInfoSchema>

export function validateIdInfo(data: unknown) {
    return IdInfoSchema.safeParse(data)
}
