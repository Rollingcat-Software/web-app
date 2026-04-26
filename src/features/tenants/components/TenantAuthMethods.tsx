import {useCallback, useEffect, useState} from 'react'
import {
    Alert,
    Box,
    CircularProgress,
    Divider,
    FormControlLabel,
    Switch,
    Typography,
} from '@mui/material'
import {Security} from '@mui/icons-material'
import {useService} from '@app/providers'
import {TYPES} from '@core/di/types'
import type {IHttpClient} from '@domain/interfaces/IHttpClient'
import {useTranslation} from 'react-i18next'
import {formatApiError} from '@utils/formatApiError'

interface AuthMethodResponse {
    id: string
    type: string
    name: string
    description: string
    category: string
    platforms: string[]
    requiresEnrollment: boolean
    isActive: boolean
}

interface TenantAuthMethodResponse {
    id: string
    authMethod: AuthMethodResponse
    isEnabled: boolean
    config: string | null
    createdAt: string
}

interface TenantAuthMethodsProps {
    tenantId: string
}

export default function TenantAuthMethods({tenantId}: TenantAuthMethodsProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const {t} = useTranslation()

    const [allMethods, setAllMethods] = useState<AuthMethodResponse[]>([])
    const [tenantMethods, setTenantMethods] = useState<TenantAuthMethodResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [allRes, tenantRes] = await Promise.all([
                httpClient.get<AuthMethodResponse[]>('/auth-methods'),
                httpClient.get<TenantAuthMethodResponse[]>(`/tenants/${tenantId}/auth-methods`),
            ])
            setAllMethods(allRes.data)
            setTenantMethods(tenantRes.data)
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [httpClient, tenantId, t])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const isMethodEnabled = (methodId: string): boolean => {
        return tenantMethods.some(
            (tm) => tm.authMethod.id === methodId && tm.isEnabled
        )
    }

    const handleToggle = async (method: AuthMethodResponse) => {
        const currentlyEnabled = isMethodEnabled(method.id)
        const newEnabled = !currentlyEnabled

        setTogglingIds((prev) => new Set(prev).add(method.id))
        setError(null)

        try {
            const res = await httpClient.put<TenantAuthMethodResponse>(
                `/tenants/${tenantId}/auth-methods/${method.id}?enabled=${newEnabled}`,
            )

            setTenantMethods((prev) => {
                const existing = prev.findIndex((tm) => tm.authMethod.id === method.id)
                if (existing >= 0) {
                    const updated = [...prev]
                    updated[existing] = res.data
                    return updated
                }
                return [...prev, res.data]
            })
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setTogglingIds((prev) => {
                const next = new Set(prev)
                next.delete(method.id)
                return next
            })
        }
    }

    if (loading) {
        return (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                <CircularProgress size={28}/>
            </Box>
        )
    }

    return (
        <Box>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                <Security color="primary"/>
                <Typography variant="h6" fontWeight={600}>
                    Auth Methods
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                Enable or disable authentication methods available for this tenant.
            </Typography>

            {error && (
                <Alert severity="error" sx={{mb: 2}} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {allMethods.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No auth methods available.
                </Typography>
            ) : (
                <Box>
                    {allMethods.map((method, index) => {
                        const enabled = isMethodEnabled(method.id)
                        const toggling = togglingIds.has(method.id)

                        return (
                            <Box key={method.id}>
                                {index > 0 && <Divider/>}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 1.5,
                                        px: 1,
                                    }}
                                >
                                    <Box>
                                        <Typography variant="body1" fontWeight={500}>
                                            {method.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {method.type} — {method.category}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            toggling ? (
                                                <CircularProgress size={20} sx={{mx: 1.25}}/>
                                            ) : (
                                                <Switch
                                                    checked={enabled}
                                                    onChange={() => handleToggle(method)}
                                                    color="primary"
                                                />
                                            )
                                        }
                                        label=""
                                        sx={{mr: 0}}
                                    />
                                </Box>
                            </Box>
                        )
                    })}
                </Box>
            )}
        </Box>
    )
}
