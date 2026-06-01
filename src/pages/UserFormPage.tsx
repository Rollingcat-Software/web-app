import {useCallback, useEffect, useRef, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Controller, useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {z} from 'zod'
import {useTranslation} from 'react-i18next'
import {formatApiError} from '@/utils/formatApiError'
import {
    Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, FormHelperText,
    InputLabel, ListItemText, MenuItem, OutlinedInput, Paper, Select, TextField, Typography,
} from '@mui/material'
import type {SelectChangeEvent} from '@mui/material'
import {Cancel, Save} from '@mui/icons-material'
import {useUsers, useUser} from '@features/users'
import {useTenants} from '@features/tenants'
import {useRoles} from '@features/roles'
import {UserStatus} from '@domain/models/User'
import type {UserType} from '@domain/models/User'
import {useAuth} from '@features/auth'
import {OperationContextBanner} from '@components/OperationContextBanner'

/**
 * Platform-tier (user_type) options — global standing, the SINGLE authority for
 * cross-tenant/can-manage-tenant capability. Distinct from the within-tenant
 * RBAC roles (the "Assigned Roles" multi-select). See
 * identity-core-api/docs/IDENTITY_ROLE_UNIFICATION.md.
 */
const USER_TYPES: UserType[] = ['ROOT', 'TENANT_ADMIN', 'TENANT_MEMBER', 'GUEST']

const userSchema = z.object({
    email: z.string().email('Invalid email address'),
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    userType: z.enum(['ROOT', 'TENANT_ADMIN', 'TENANT_MEMBER', 'GUEST']),
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
    const {user: currentUser} = useAuth()

    // Only a ROOT caller may set/grant the platform tier (backend is fail-closed
    // and 403s otherwise). For everyone else the User Type select is read-only —
    // it still SHOWS the tier, but a non-ROOT admin manages people via the
    // within-tenant roles below, not by changing global standing.
    const canEditUserType = currentUser?.isRoot() ?? false

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
            userType: 'TENANT_MEMBER',
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
                // Platform tier from the backend `userType` (authoritative).
                // Fall back to TENANT_MEMBER for older rows that predate it.
                userType: existingUser.userType ?? 'TENANT_MEMBER',
                status: existingUser.status,
                tenantId: existingUser.tenantId,
            })
        }
    }, [existingUser, isEditMode, reset])

    // Pre-populate the "Assigned Roles" multi-select on edit. The GET /users/{id}
    // response carries role NAMES (`existingUser.roles`); map them to the role
    // IDs the multi-select / submit payload uses via the loaded role catalog.
    // Runs once per (user, catalog) and only writes when the resolved id set
    // actually changes, so it never re-triggers itself.
    const rolePrefillDone = useRef(false)
    useEffect(() => {
        if (!isEditMode || !existingUser?.roles || availableRoles.length === 0) {
            return
        }
        if (rolePrefillDone.current) {
            return
        }
        const nameToId = new Map(availableRoles.map((r) => [r.name, r.id]))
        const ids = existingUser.roles
            .map((name) => nameToId.get(name))
            .filter((rid): rid is string => Boolean(rid))
        rolePrefillDone.current = true
        setSelectedRoleIds(ids)
    }, [isEditMode, existingUser, availableRoles])

    const onSubmit = useCallback(async (data: UserFormData) => {
        setLoading(true)
        setError(null)

        try {
            if (isEditMode && id) {
                const {password: _password, userType, ...rest} = data
                await updateUser(id, {
                    firstName: rest.firstName,
                    lastName: rest.lastName,
                    status: rest.status,
                    // Within-tenant RBAC roles (replace semantics on the backend).
                    roleIds: selectedRoleIds,
                    // Platform tier — only ROOT may change it; omit otherwise so a
                    // non-ROOT save never trips the backend's fail-closed 403.
                    ...(canEditUserType ? {userType} : {}),
                })
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
                    tenantId: data.tenantId,
                    // Within-tenant RBAC roles to assign on creation.
                    roleIds: selectedRoleIds,
                    // Platform tier — ROOT-only to elevate; omit for non-ROOT so
                    // the new user takes the backend default (TENANT_MEMBER).
                    ...(canEditUserType ? {userType: data.userType} : {}),
                })
            }
            navigate('/users')
        } catch (err: unknown) {
            console.warn('User save failed', err)
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [isEditMode, id, updateUser, createUser, navigate, t, selectedRoleIds, canEditUserType])

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
                {isEditMode ? t('users.form.editTitle') : t('users.form.createTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{mb: 3}}>
                {isEditMode ? t('users.form.editSubtitle') : t('users.form.createSubtitle')}
            </Typography>

            {!isEditMode && (
                <OperationContextBanner i18nKey="operationContext.addUser" />
            )}

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
                                    id="user-form-email"
                                    label={t('users.form.email')}
                                    type="email"
                                    fullWidth
                                    required
                                    error={!!errors.email}
                                    helperText={errors.email?.message}
                                    FormHelperTextProps={{id: 'user-form-email-helper'}}
                                    inputProps={{'aria-describedby': 'user-form-email-helper'}}
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
                                        id="user-form-firstName"
                                        label={t('users.form.firstName')}
                                        fullWidth
                                        required
                                        error={!!errors.firstName}
                                        helperText={errors.firstName?.message}
                                        FormHelperTextProps={{id: 'user-form-firstName-helper'}}
                                        inputProps={{'aria-describedby': 'user-form-firstName-helper'}}
                                    />
                                )}
                            />

                            <Controller
                                name="lastName"
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field}
                                        id="user-form-lastName"
                                        label={t('users.form.lastName')}
                                        fullWidth
                                        required
                                        error={!!errors.lastName}
                                        helperText={errors.lastName?.message}
                                        FormHelperTextProps={{id: 'user-form-lastName-helper'}}
                                        inputProps={{'aria-describedby': 'user-form-lastName-helper'}}
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
                                        id="user-form-password"
                                        label={t('users.form.password')}
                                        type="password"
                                        fullWidth
                                        required
                                        error={!!errors.password}
                                        helperText={errors.password?.message}
                                        FormHelperTextProps={{id: 'user-form-password-helper'}}
                                        inputProps={{'aria-describedby': 'user-form-password-helper'}}
                                    />
                                )}
                            />
                        )}

                        <Controller
                            name="userType"
                            control={control}
                            render={({field}) => (
                                <TextField
                                    {...field}
                                    id="user-form-userType"
                                    label={t('users.form.userType')}
                                    select
                                    fullWidth
                                    required
                                    disabled={!canEditUserType}
                                    error={!!errors.userType}
                                    helperText={
                                        errors.userType?.message
                                        ?? (canEditUserType
                                            ? t('users.form.userTypeHelper')
                                            : `${t('users.form.userTypeHelper')} ${t('users.form.userTypeRootOnly')}`)
                                    }
                                    FormHelperTextProps={{id: 'user-form-userType-helper'}}
                                    SelectProps={{'aria-describedby': 'user-form-userType-helper'}}
                                >
                                    {USER_TYPES.map((ut) => (
                                        <MenuItem key={ut} value={ut}>
                                            {t(`users.userType.${ut}`)}
                                        </MenuItem>
                                    ))}
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
                                        id="user-form-status"
                                        label={t('users.form.status')}
                                        select
                                        fullWidth
                                        error={!!errors.status}
                                        helperText={errors.status?.message}
                                        FormHelperTextProps={{id: 'user-form-status-helper'}}
                                        SelectProps={{'aria-describedby': 'user-form-status-helper'}}
                                    >
                                        <MenuItem value={UserStatus.PENDING_ENROLLMENT}>{t('users.status.PENDING_ENROLLMENT')}</MenuItem>
                                        <MenuItem value={UserStatus.ACTIVE}>{t('users.status.ACTIVE')}</MenuItem>
                                        <MenuItem value={UserStatus.SUSPENDED}>{t('users.status.SUSPENDED')}</MenuItem>
                                        <MenuItem value={UserStatus.LOCKED}>{t('users.status.LOCKED')}</MenuItem>
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
                                    id="user-form-tenantId"
                                    label={t('users.form.tenant')}
                                    select
                                    fullWidth
                                    required
                                    error={!!errors.tenantId}
                                    helperText={errors.tenantId?.message || t('users.form.tenantHelper')}
                                    FormHelperTextProps={{id: 'user-form-tenantId-helper'}}
                                    SelectProps={{'aria-describedby': 'user-form-tenantId-helper'}}
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
                            <InputLabel id="roles-multi-select-label">{t('users.form.assignedRoles')}</InputLabel>
                            <Select
                                labelId="roles-multi-select-label"
                                id="roles-multi-select"
                                multiple
                                value={selectedRoleIds}
                                onChange={handleRoleSelectionChange}
                                aria-describedby="roles-multi-select-helper"
                                input={<OutlinedInput label={t('users.form.assignedRoles')}/>}
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
                            <FormHelperText id="roles-multi-select-helper">
                                {rolesLoading
                                    ? t('users.form.rolesLoading')
                                    : t('users.form.assignedRolesHelper')}
                            </FormHelperText>
                        </FormControl>

                        <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
                            <Button
                                variant="outlined"
                                startIcon={<Cancel/>}
                                onClick={() => navigate('/users')}
                                disabled={isSubmitting || loading}
                            >
                                {t('users.form.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                startIcon={loading ? <CircularProgress size={20}/> : <Save/>}
                                disabled={isSubmitting || loading}
                            >
                                {isEditMode ? t('users.form.update') : t('users.form.create')}
                            </Button>
                        </Box>
                    </Box>
                </form>
            </Paper>
        </Box>
    )
}
