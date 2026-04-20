import {useCallback, useEffect, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Controller, useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {z} from 'zod'
import {Alert, Box, Button, CircularProgress, Paper, TextField, Typography,} from '@mui/material'
import {Cancel, Save} from '@mui/icons-material'
import {useTenants, useTenant} from '@features/tenants'
import TenantAuthMethods from '@features/tenants/components/TenantAuthMethods'
import {useTranslation} from 'react-i18next'
import {formatApiError} from '@/utils/formatApiError'

const tenantSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters')
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only'),
    description: z.string().optional(),
    contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
    contactPhone: z.string().optional(),
    maxUsers: z.coerce.number().min(1, 'Must allow at least 1 user').max(100000),
})

type TenantFormData = z.infer<typeof tenantSchema>

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export default function TenantFormPage() {
    const navigate = useNavigate()
    const {t} = useTranslation()
    const {id} = useParams<{ id: string }>()
    const isEditMode = Boolean(id)

    const {createTenant, updateTenant} = useTenants()
    const {tenant: existingTenant, loading: fetchLoading} = useTenant(id ?? '')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [autoSlug, setAutoSlug] = useState(!isEditMode)

    const {
        control,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: {errors, isSubmitting},
    } = useForm<TenantFormData>({
        resolver: zodResolver(tenantSchema),
        defaultValues: {
            name: '',
            slug: '',
            description: '',
            contactEmail: '',
            contactPhone: '',
            maxUsers: 100,
        },
    })

    const nameValue = watch('name')

    useEffect(() => {
        if (autoSlug && nameValue) {
            setValue('slug', slugify(nameValue))
        }
    }, [nameValue, autoSlug, setValue])

    useEffect(() => {
        if (isEditMode && existingTenant) {
            reset({
                name: existingTenant.name,
                slug: existingTenant.slug || '',
                description: existingTenant.description || '',
                contactEmail: existingTenant.contactEmail || '',
                contactPhone: existingTenant.contactPhone || '',
                maxUsers: existingTenant.maxUsers,
            })
            setAutoSlug(false)
        }
    }, [existingTenant, isEditMode, reset])

    const onSubmit = useCallback(async (data: TenantFormData) => {
        setLoading(true)
        setError(null)

        try {
            if (isEditMode && id) {
                await updateTenant(id, {
                    name: data.name,
                    slug: data.slug,
                    description: data.description || undefined,
                    contactEmail: data.contactEmail || undefined,
                    contactPhone: data.contactPhone || undefined,
                    maxUsers: data.maxUsers,
                })
            } else {
                await createTenant({
                    name: data.name,
                    slug: data.slug,
                    description: data.description || undefined,
                    contactEmail: data.contactEmail || undefined,
                    contactPhone: data.contactPhone || undefined,
                    maxUsers: data.maxUsers,
                })
            }
            navigate('/tenants')
        } catch (err: unknown) {
            console.warn('Tenant save failed', err)
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [isEditMode, id, updateTenant, createTenant, navigate])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            handleSubmit(onSubmit)()
        }
    }, [handleSubmit, onSubmit])

    if (isEditMode && fetchLoading) {
        return (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 8}}>
                <CircularProgress/>
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight={600}>
                {isEditMode ? 'Edit Tenant' : 'Create New Tenant'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{mb: 3}}>
                {isEditMode ? 'Update tenant organization details' : 'Add a new tenant organization to the platform'}
            </Typography>

            {error && (
                <Alert severity="error" sx={{mb: 3}} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Paper sx={{p: 4, maxWidth: 800}}>
                <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 3}}>
                        <Controller
                            name="name"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    id="tenant-form-name"
                                    label="Organization Name"
                                    fullWidth
                                    required
                                    error={!!errors.name}
                                    helperText={errors.name?.message}
                                    FormHelperTextProps={{id: 'tenant-form-name-helper'}}
                                    inputProps={{'aria-describedby': 'tenant-form-name-helper'}}
                                    placeholder="e.g. Marmara University"
                                />
                            )}
                        />

                        <Controller
                            name="slug"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    id="tenant-form-slug"
                                    label="Slug"
                                    fullWidth
                                    required
                                    error={!!errors.slug}
                                    helperText={errors.slug?.message || 'URL-friendly identifier (auto-generated from name)'}
                                    FormHelperTextProps={{id: 'tenant-form-slug-helper'}}
                                    inputProps={{'aria-describedby': 'tenant-form-slug-helper'}}
                                    placeholder="e.g. marmara-university"
                                    onChange={(e) => {
                                        field.onChange(e)
                                        setAutoSlug(false)
                                    }}
                                />
                            )}
                        />

                        <Controller
                            name="description"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    id="tenant-form-description"
                                    label="Description"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    error={!!errors.description}
                                    helperText={errors.description?.message}
                                    FormHelperTextProps={{id: 'tenant-form-description-helper'}}
                                    inputProps={{'aria-describedby': 'tenant-form-description-helper'}}
                                    placeholder="Brief description of the organization"
                                />
                            )}
                        />

                        <Box sx={{display: 'flex', gap: 2}}>
                            <Controller
                                name="contactEmail"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        id="tenant-form-contactEmail"
                                        label="Contact Email"
                                        type="email"
                                        fullWidth
                                        error={!!errors.contactEmail}
                                        helperText={errors.contactEmail?.message}
                                        FormHelperTextProps={{id: 'tenant-form-contactEmail-helper'}}
                                        inputProps={{'aria-describedby': 'tenant-form-contactEmail-helper'}}
                                        placeholder="admin@example.com"
                                    />
                                )}
                            />

                            <Controller
                                name="contactPhone"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        id="tenant-form-contactPhone"
                                        label="Contact Phone"
                                        fullWidth
                                        error={!!errors.contactPhone}
                                        helperText={errors.contactPhone?.message}
                                        FormHelperTextProps={{id: 'tenant-form-contactPhone-helper'}}
                                        inputProps={{'aria-describedby': 'tenant-form-contactPhone-helper'}}
                                        placeholder="+90 212 123 4567"
                                    />
                                )}
                            />
                        </Box>

                        <Controller
                            name="maxUsers"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    id="tenant-form-maxUsers"
                                    label="Max Users"
                                    type="number"
                                    fullWidth
                                    required
                                    error={!!errors.maxUsers}
                                    helperText={errors.maxUsers?.message || 'Maximum number of users allowed'}
                                    FormHelperTextProps={{id: 'tenant-form-maxUsers-helper'}}
                                    inputProps={{min: 1, max: 100000, 'aria-describedby': 'tenant-form-maxUsers-helper'}}
                                />
                            )}
                        />

                        <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
                            <Button
                                variant="outlined"
                                startIcon={<Cancel/>}
                                onClick={() => navigate('/tenants')}
                                disabled={isSubmitting || loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                startIcon={loading ? <CircularProgress size={20}/> : <Save/>}
                                disabled={isSubmitting || loading}
                            >
                                {isEditMode ? 'Update Tenant' : 'Create Tenant'}
                            </Button>
                        </Box>
                    </Box>
                </form>
            </Paper>

            {isEditMode && id && (
                <Paper sx={{p: 4, maxWidth: 800, mt: 3}}>
                    <TenantAuthMethods tenantId={id}/>
                </Paper>
            )}
        </Box>
    )
}
