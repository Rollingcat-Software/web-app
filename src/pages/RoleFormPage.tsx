import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import { Cancel, Save } from '@mui/icons-material'
import { useRoles } from '@features/roles'
import { Permission } from '@domain/models/Permission'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@/utils/formatApiError'

export default function RoleFormPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const { id } = useParams<{ id: string }>()
    const isEditMode = Boolean(id)
    const { roles, permissions, loading: dataLoading, createRole, updateRole, assignPermission, revokePermission } = useRoles()

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const existingRole = isEditMode ? roles.find((r) => r.id === id) : null

    useEffect(() => {
        if (isEditMode && existingRole) {
            setName(existingRole.name)
            setDescription(existingRole.description)
            setSelectedPermissionIds(new Set(existingRole.permissions.map((p) => p.id)))
        }
    }, [existingRole, isEditMode])

    const handleTogglePermission = (permissionId: string) => {
        setSelectedPermissionIds((prev) => {
            const next = new Set(prev)
            if (next.has(permissionId)) {
                next.delete(permissionId)
            } else {
                next.add(permissionId)
            }
            return next
        })
    }

    const handleSelectAll = (resourcePerms: Permission[]) => {
        const allSelected = resourcePerms.every((p) => selectedPermissionIds.has(p.id))
        setSelectedPermissionIds((prev) => {
            const next = new Set(prev)
            resourcePerms.forEach((p) => {
                if (allSelected) {
                    next.delete(p.id)
                } else {
                    next.add(p.id)
                }
            })
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError(t('roleForm.roleNameRequired'))
            return
        }
        setSaving(true)
        setError(null)

        try {
            if (isEditMode && id) {
                await updateRole(id, { name, description })
                // Sync permissions
                const currentPermIds = new Set(existingRole?.permissions.map((p) => p.id) ?? [])
                const toAssign = [...selectedPermissionIds].filter((pid) => !currentPermIds.has(pid))
                const toRevoke = [...currentPermIds].filter((pid) => !selectedPermissionIds.has(pid))
                for (const pid of toAssign) {
                    await assignPermission(id, pid)
                }
                for (const pid of toRevoke) {
                    await revokePermission(id, pid)
                }
            } else {
                await createRole({
                    name,
                    description,
                    tenantId: '',
                    permissionIds: [...selectedPermissionIds],
                })
            }
            navigate('/roles')
        } catch (err) {
            console.warn('Role save failed', err)
            setError(formatApiError(err, t))
        } finally {
            setSaving(false)
        }
    }

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            const form = (e.target as HTMLElement).closest('form')
            if (form) form.requestSubmit()
        }
    }, [])

    // Group permissions by resource
    const permissionsByResource = permissions.reduce(
        (acc, perm) => {
            const resource = perm.resource || 'other'
            if (!acc[resource]) acc[resource] = []
            acc[resource].push(perm)
            return acc
        },
        {} as Record<string, Permission[]>
    )

    if (dataLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (isEditMode && existingRole?.systemRole) {
        return (
            <Box>
                <Typography variant="h4" gutterBottom fontWeight={600}>
                    {t('roleForm.viewTitle')}
                </Typography>
                <Alert severity="info" sx={{ mb: 3 }}>
                    {t('roleForm.systemRoleReadOnly')}
                </Alert>
                <Paper sx={{ p: 4, maxWidth: 800 }}>
                    <Typography variant="h6" gutterBottom>{existingRole.name}</Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>{existingRole.description}</Typography>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('roleForm.permissionsCount', { count: existingRole.permissionCount })}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {existingRole.permissions.map((p) => (
                            <Chip key={p.id} label={p.authority} size="small" variant="outlined" />
                        ))}
                    </Box>
                    <Box sx={{ mt: 3 }}>
                        <Button variant="outlined" onClick={() => navigate('/roles')}>{t('roleForm.backToRoles')}</Button>
                    </Box>
                </Paper>
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight={600}>
                {isEditMode ? t('roleForm.editTitle') : t('roleForm.createTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {isEditMode ? t('roleForm.editSubtitle') : t('roleForm.createSubtitle')}
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <Paper sx={{ p: 4, mb: 3, maxWidth: 800 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <TextField
                            label={t('roleForm.roleNameLabel')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            required
                            placeholder={t('roleForm.roleNamePlaceholder')}
                        />
                        <TextField
                            label={t('roleForm.descriptionLabel')}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                            placeholder={t('roleForm.descriptionPlaceholder')}
                        />
                    </Box>
                </Paper>

                <Paper sx={{ p: 4, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {t('roleForm.permissionsHeader', { count: selectedPermissionIds.size })}
                    </Typography>

                    {Object.entries(permissionsByResource).map(([resource, perms]) => {
                        const allSelected = perms.every((p) => selectedPermissionIds.has(p.id))
                        const someSelected = perms.some((p) => selectedPermissionIds.has(p.id))

                        return (
                            <Box key={resource} sx={{ mb: 3 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={allSelected}
                                            indeterminate={someSelected && !allSelected}
                                            onChange={() => handleSelectAll(perms)}
                                        />
                                    }
                                    label={
                                        <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                                            {resource}
                                        </Typography>
                                    }
                                />
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell padding="checkbox" />
                                                <TableCell>{t('roleForm.columnPermission')}</TableCell>
                                                <TableCell>{t('roleForm.columnAuthority')}</TableCell>
                                                <TableCell>{t('roleForm.columnDescription')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {perms.map((perm) => (
                                                <TableRow key={perm.id} hover>
                                                    <TableCell padding="checkbox">
                                                        <Checkbox
                                                            checked={selectedPermissionIds.has(perm.id)}
                                                            onChange={() => handleTogglePermission(perm.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>{perm.name}</TableCell>
                                                    <TableCell>
                                                        <Chip label={perm.authority} size="small" variant="outlined" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {perm.description || '-'}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )
                    })}

                    {permissions.length === 0 && (
                        <Typography color="text.secondary" sx={{ py: 2 }}>
                            {t('roleForm.noPermissionsAvailable')}
                        </Typography>
                    )}
                </Paper>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button variant="outlined" startIcon={<Cancel />} onClick={() => navigate('/roles')} disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                        disabled={saving}
                    >
                        {isEditMode ? t('roleForm.updateRole') : t('roleForm.createRole')}
                    </Button>
                </Box>
            </form>
        </Box>
    )
}
