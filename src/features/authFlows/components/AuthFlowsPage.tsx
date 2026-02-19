import { useState, useEffect, useCallback } from 'react'
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Tooltip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'
import { AuthFlowBuilder } from './AuthFlowBuilder'
import { TYPES } from '@core/di/types'
import { useService } from '@app/providers/DependencyProvider'
import type { AuthFlowRepository, AuthFlowResponse, CreateAuthFlowCommand } from '@core/repositories/AuthFlowRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

export default function AuthFlowsPage() {
    const authFlowRepo = useService<AuthFlowRepository>(TYPES.AuthFlowRepository)
    const logger = useService<ILogger>(TYPES.Logger)

    const [flows, setFlows] = useState<AuthFlowResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showBuilder, setShowBuilder] = useState(false)
    const [filterType, setFilterType] = useState<string>('')

    // TODO: Get from auth context or selector
    const tenantId = 'system'

    const loadFlows = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await authFlowRepo.listFlows(tenantId, filterType || undefined)
            setFlows(data)
        } catch (err) {
            logger.error('Failed to load auth flows', err)
            setError('Failed to load authentication flows')
        } finally {
            setLoading(false)
        }
    }, [authFlowRepo, logger, tenantId, filterType])

    useEffect(() => {
        loadFlows()
    }, [loadFlows])

    const handleSave = async (data: {
        name: string
        description: string
        operationType: string
        isDefault: boolean
        steps: { methodType: string; isRequired: boolean; timeout: number; maxAttempts: number; order: number }[]
    }) => {
        try {
            const command: CreateAuthFlowCommand = {
                name: data.name,
                description: data.description,
                operationType: data.operationType,
                isDefault: data.isDefault,
                steps: data.steps.map((s) => ({
                    authMethodType: s.methodType.toUpperCase(),
                    stepOrder: s.order,
                    isRequired: s.isRequired,
                    timeoutSeconds: s.timeout,
                    maxAttempts: s.maxAttempts,
                    allowsDelegation: false,
                })),
            }
            await authFlowRepo.createFlow(tenantId, command)
            setShowBuilder(false)
            await loadFlows()
        } catch (err) {
            logger.error('Failed to save auth flow', err)
            setError('Failed to save authentication flow')
        }
    }

    const handleDelete = async (flowId: string) => {
        try {
            await authFlowRepo.deleteFlow(tenantId, flowId)
            await loadFlows()
        } catch (err) {
            logger.error('Failed to delete auth flow', err)
            setError('Failed to delete authentication flow')
        }
    }

    return (
        <PageTransition>
            <Box>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                            <Typography variant="h4" fontWeight={700}>
                                Authentication Flows
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Configure multi-step authentication sequences per operation type
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => setShowBuilder(true)}
                            sx={{
                                py: 1.2,
                                px: 3,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            }}
                        >
                            Create Flow
                        </Button>
                    </Box>
                </motion.div>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

                {/* Filter */}
                <Box sx={{ mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Filter by Operation</InputLabel>
                        <Select
                            value={filterType}
                            label="Filter by Operation"
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <MenuItem value="">All Operations</MenuItem>
                            <MenuItem value="APP_LOGIN">App Login</MenuItem>
                            <MenuItem value="DOOR_ACCESS">Door Access</MenuItem>
                            <MenuItem value="BUILDING_ACCESS">Building Access</MenuItem>
                            <MenuItem value="API_ACCESS">API Access</MenuItem>
                            <MenuItem value="TRANSACTION">Transaction</MenuItem>
                            <MenuItem value="ENROLLMENT">Enrollment</MenuItem>
                            <MenuItem value="GUEST_ACCESS">Guest Access</MenuItem>
                            <MenuItem value="EXAM_PROCTORING">Exam Proctoring</MenuItem>
                            <MenuItem value="CUSTOM">Custom</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {/* Flows Table */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : flows.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <Typography variant="h6" color="text.secondary">
                                No authentication flows configured
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Create your first flow to get started
                            </Typography>
                            <Button variant="outlined" startIcon={<Add />} onClick={() => setShowBuilder(true)}>
                                Create Flow
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Operation Type</TableCell>
                                    <TableCell>Steps</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Default</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {flows.map((flow) => (
                                    <TableRow key={flow.id} hover>
                                        <TableCell>
                                            <Typography variant="subtitle2" fontWeight={600}>{flow.name}</Typography>
                                            {flow.description && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {flow.description}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={flow.operationType} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={`${flow.steps?.length ?? 0} steps`} size="small" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={flow.isActive ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={flow.isActive ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {flow.isDefault && <Chip label="Default" size="small" color="primary" />}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(flow.id)}
                                                    sx={{ color: 'error.main' }}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Builder Dialog */}
                <Dialog open={showBuilder} onClose={() => setShowBuilder(false)} maxWidth="lg" fullWidth>
                    <DialogTitle>Create Authentication Flow</DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 1 }}>
                            <AuthFlowBuilder onSave={handleSave} />
                        </Box>
                    </DialogContent>
                </Dialog>
            </Box>
        </PageTransition>
    )
}
