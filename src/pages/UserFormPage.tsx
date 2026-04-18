import {useCallback, useEffect, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Controller, useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {z} from 'zod'
import {useTranslation} from 'react-i18next'
import {
    Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, FormHelperText,
    InputLabel, ListItemText, MenuItem, OutlinedInput, Paper, Select, TextField, Typography,
} from '@mui/material'
import type {SelectChangeEvent} from '@mui/material'
import {Cancel, Save} from '@mui/icons-material'
import {useUsers, useUser} from '@features/users'
import {useTenants} from '@features/tenants'
import {useRoles} from '@features/roles'
import {UserRole, UserStatus} from '@domain/models/User'

const userSchema = z.object({
    email: z.string().email('Invalid email address'),
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    role: z.nativeEnum(UserRole),
    status: z.nativeEnum(UserStatus).optional(),
    tenantId: z.string().uuid('Please select a tenant').min(1, 'Tenant is required'),
})

type UserFormData = z.infer<typeof userSchema>

export default function UserFormPage() {
    const navigate = useNavigate()
    const {t} = useTranslation()
    const {id} = useParams<{ id: string }>()
    const isEditMode = Boolean(id)

    const {createUser, updateUser} = useUsers()
    const {user: existingUser, loading: fetchLoading} = useUser(id ?? '')
    const {tenants, loading: tenantsLoading} = useTenants()
    const {roles: availableRoles, loading: rolesLoading} = useRoles()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

    const {
        control,
        handleSubmit,
        reset,
        formState: {errors, isSubmitting},
    } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            email: '',
            firstName: '',
            lastName: '',
            password: '',
            role: UserRole.USER,
            status: UserStatus.PENDING_ENROLLMENT,
            tenantId: '',
        },
    })

    useEffect(() => {
        if (isEditMode && existingUser) {
            reset({
                email: existingUser.email,
                firstName: existingUser.firstName,
                lastName: existingUser.lastName,
                role: existingUser.role,
                status: existingUser.status,
                tenantId: existingUser.tenantId,
            })
        }
    }, [existingUser, isEditMode, reset])

    const onSubmit = useCallback(async (data: UserFormData) => {
        setLoading(true)
        setError(null)

        try {
            if (isEditMode && id) {
                const {password: _password, ...updateData} = data
                await updateUser(id, updateData)
            } else {
                if (!data.password) {
                    setError(t('users.error.passwordRequiredNew'))
                    setLoading(false)
                    return
                }
                await createUser({
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    password: data.password,
                    role: data.role,
                    tenantId: data.tenantId,
                })
            }
            navigate('/users')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} user`
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [isEditMode, id, updateUser, createUser, navigate, t])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            handleSubmit(onSubmit)()
        }
    }, [handleSubmit, onSubmit])

    const handleRoleSelectionChange = useCallback((event: SelectChangeEvent<string[]>) => {
        const value = event.target.value
        setSelectedRoleIds(typeof value === 'string' ? value.split(',') : value)
    }, [])

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
                {isEditMode ? 'Edit User' : 'Create New User'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{mb: 3}}>
                {isEditMode ? 'Update user information and permissions' : 'Add a new user to the system'}
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
                            name="email"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    label="Email Address"
                                    type="email"
                                    fullWidth
                                    required
                                    error={!!errors.email}
                                    helperText={errors.email?.message}
                                    disabled={isEditMode}
                                />
                            )}
                        />

                        <Box sx={{display: 'flex', gap: 2}}>
                            <Controller
                                name="firstName"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        label="First Name"
                                        fullWidth
                                        required
                                        error={!!errors.firstName}
                                        helperText={errors.firstName?.message}
                                    />
                                )}
                            />

                            <Controller
                                name="lastName"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        label="Last Name"
                                        fullWidth
                                        required
                                        error={!!errors.lastName}
                                        helperText={errors.lastName?.message}
                                    />
                                )}
                            />
                        </Box>

                        {!isEditMode && (
                            <Controller
                                name="password"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        label="Password"
                                        type="password"
                                        fullWidth
                                        required
                                        error={!!errors.password}
                                        helperText={errors.password?.message}
                                    />
                                )}
                            />
                        )}

                        <Controller
                            name="role"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    label="Role"
                                    select
                                    fullWidth
                                    required
                                    error={!!errors.role}
                                    helperText={errors.role?.message}
                                >
                                    <MenuItem value={UserRole.USER}>User</MenuItem>
                                    <MenuItem value={UserRole.TENANT_ADMIN}>Tenant Admin</MenuItem>
                                    <MenuItem value={UserRole.ADMIN}>Admin</MenuItem>
                                    <MenuItem value={UserRole.SUPER_ADMIN}>Super Admin</MenuItem>
                                </TextField>
                            )}
                        />

                        {isEditMode && (
                            <Controller
                                name="status"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        label="Status"
                                        select
                                        fullWidth
                                        error={!!errors.status}
                                        helperText={errors.status?.message}
                                    >
                                        <MenuItem value={UserStatus.PENDING_ENROLLMENT}>Pending Enrollment</MenuItem>
                                        <MenuItem value={UserStatus.ACTIVE}>Active</MenuItem>
                                        <MenuItem value={UserStatus.SUSPENDED}>Suspended</MenuItem>
                                        <MenuItem value={UserStatus.LOCKED}>Locked</MenuItem>
                                    </TextField>
                                )}
                            />
                        )}

                        <Controller
                            name="tenantId"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    label="Tenant"
                                    select
                                    fullWidth
                                    required
                                    error={!!errors.tenantId}
                                    helperText={errors.tenantId?.message || 'Select the tenant this user belongs to'}
                                    disabled={isEditMode || tenantsLoading}
                                >
                                    {tenants.map((tenant) => (
                                        <MenuItem key={tenant.id} value={tenant.id}>
                                            {tenant.name} {tenant.slug ? `(${tenant.slug})` : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />

                        <FormControl fullWidth disabled={rolesLoading}>
                            <InputLabel id="roles-multi-select-label">Assigned Roles</InputLabel>
                            <Select
                                labelId="roles-multi-select-label"
                                id="roles-multi-select"
                                multiple
                                value={selectedRoleIds}
                                onChange={handleRoleSelectionChange}
                                input={<OutlinedInput label="Assigned Roles"/>}
                                renderValue={(selected) => (
                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                                        {selected.map((roleId) => {
                                            const role = availableRoles.find((r) => r.id === roleId)
                                            return (
                                                <Chip
                                                    key={roleId}
                                                    label={role?.name ?? roleId}
                                                    size="small"
                                                />
                                            )
                                        })}
                                    </Box>
                                )}
                            >
                                {availableRoles.filter((r) => r.active).map((role) => (
                                    <MenuItem key={role.id} value={role.id}>
                                        <Checkbox checked={selectedRoleIds.includes(role.id)}/>
                                        <ListItemText
                                            primary={role.name}
                                            secondary={role.description}
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>
                                {rolesLoading
                                    ? 'Loading roles...'
                                    : 'Select one or more roles to assign to this user'}
                            </FormHelperText>
                        </FormControl>

                        <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
                            <Button
                                variant="outlined"
                                startIcon={<Cancel/>}
                                onClick={() => navigate('/users')}
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
                                {isEditMode ? 'Update User' : 'Create User'}
                            </Button>
                        </Box>
                    </Box>
                </form>
            </Paper>
        </Box>
    )
}
