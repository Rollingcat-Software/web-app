import { useCallback, useEffect, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    Slider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from '@mui/material'
import {
    Add,
    Delete,
    ArrowUpward,
    ArrowDownward,
    ContentCopy,
    VerifiedUser,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { motion, Variants } from 'framer-motion'
import { useVerification } from '@hooks/useVerification'
import TemplateSelector from '@features/verification/components/TemplateSelector'
import type {
    VerificationTemplate,
    VerificationStepSpec,
    CreateVerificationFlowCommand,
} from '@core/repositories/VerificationRepository'

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const STEP_TYPES = [
    'document_scan',
    'face_match',
    'liveness_check',
    'address_verification',
    'phone_verification',
    'email_verification',
    'background_check',
    'credit_check',
]

const FLOW_TYPES = ['kyc', 'kyb', 'aml', 'custom']

export default function VerificationFlowBuilderPage() {
    const { t } = useTranslation()
    const {
        flows,
        loading,
        error,
        loadFlows,
        createFlow,
        deleteFlow,
        clearError,
    } = useVerification()

    const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [flowName, setFlowName] = useState('')
    const [flowType, setFlowType] = useState('kyc')
    const [steps, setSteps] = useState<VerificationStepSpec[]>([])

    useEffect(() => {
        loadFlows()
    }, [loadFlows])

    // ── Step management ─────────────────────────────────────────────────────

    const addStep = useCallback((stepType: string) => {
        setSteps(prev => [
            ...prev,
            {
                stepOrder: prev.length + 1,
                stepType,
                isRequired: true,
                confidenceThreshold: 80,
                timeoutSeconds: 300,
            },
        ])
    }, [])

    const removeStep = useCallback((index: number) => {
        setSteps(prev =>
            prev
                .filter((_, i) => i !== index)
                .map((s, i) => ({ ...s, stepOrder: i + 1 }))
        )
    }, [])

    const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
        setSteps(prev => {
            const arr = [...prev]
            const target = direction === 'up' ? index - 1 : index + 1
            if (target < 0 || target >= arr.length) return prev
            ;[arr[index], arr[target]] = [arr[target], arr[index]]
            return arr.map((s, i) => ({ ...s, stepOrder: i + 1 }))
        })
    }, [])

    const updateStepThreshold = useCallback((index: number, value: number) => {
        setSteps(prev =>
            prev.map((s, i) => (i === index ? { ...s, confidenceThreshold: value } : s))
        )
    }, [])

    const updateStepTimeout = useCallback((index: number, value: number) => {
        setSteps(prev =>
            prev.map((s, i) => (i === index ? { ...s, timeoutSeconds: value } : s))
        )
    }, [])

    // ── Template selection ──────────────────────────────────────────────────

    const handleTemplateSelect = useCallback((template: VerificationTemplate) => {
        setFlowName(template.name)
        setFlowType(template.flowType)
        setSteps(template.steps.map((s, i) => ({
            ...s,
            stepOrder: i + 1,
        })))
        setTemplateDialogOpen(false)
        setCreateDialogOpen(true)
    }, [])

    // ── Create flow ─────────────────────────────────────────────────────────

    const handleCreate = useCallback(async () => {
        if (!flowName.trim() || steps.length === 0) return
        const command: CreateVerificationFlowCommand = {
            name: flowName.trim(),
            flowType,
            steps,
        }
        const result = await createFlow(command)
        if (result) {
            setCreateDialogOpen(false)
            setFlowName('')
            setFlowType('kyc')
            setSteps([])
        }
    }, [flowName, flowType, steps, createFlow])

    const handleOpenCreate = useCallback(() => {
        setFlowName('')
        setFlowType('kyc')
        setSteps([])
        setCreateDialogOpen(true)
    }, [])

    const handleDelete = useCallback(async () => {
        if (!deleteConfirmId) return
        await deleteFlow(deleteConfirmId)
        setDeleteConfirmId(null)
    }, [deleteConfirmId, deleteFlow])

    const statusColor = (status: string): 'success' | 'warning' | 'default' => {
        if (status === 'active') return 'success'
        if (status === 'draft') return 'warning'
        return 'default'
    }

    if (loading && flows.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <Box>
                <motion.div variants={itemVariants}>
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <VerifiedUser sx={{ color: 'primary.main', fontSize: 32 }} />
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {t('verification.flowsTitle')}
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary">
                            {t('verification.flowsSubtitle')}
                        </Typography>
                    </Box>
                </motion.div>

                {error && (
                    <Alert severity="error" onClose={clearError} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                <motion.div variants={itemVariants}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={handleOpenCreate}
                        >
                            {t('verification.createFlow')}
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ContentCopy />}
                            onClick={() => setTemplateDialogOpen(true)}
                        >
                            {t('verification.createFromTemplate')}
                        </Button>
                    </Box>
                </motion.div>

                {/* Flows table */}
                <motion.div variants={itemVariants}>
                    <Card>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('common.name')}</TableCell>
                                        <TableCell>{t('verification.flowType')}</TableCell>
                                        <TableCell>{t('verification.template')}</TableCell>
                                        <TableCell>{t('common.steps')}</TableCell>
                                        <TableCell>{t('common.status')}</TableCell>
                                        <TableCell align="right">{t('common.actions')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {flows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">
                                                <Typography color="text.secondary" sx={{ py: 4 }}>
                                                    {t('verification.noFlows')}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        flows.map((flow) => (
                                            <TableRow key={flow.id} hover>
                                                <TableCell>
                                                    <Typography fontWeight={500}>{flow.name}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={flow.flowType.toUpperCase()}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {flow.templateName || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {flow.steps.length} {t('common.steps')}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={flow.status}
                                                        size="small"
                                                        color={statusColor(flow.status)}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title={t('common.delete')}>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => setDeleteConfirmId(flow.id)}
                                                        >
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </motion.div>

                {/* Template selector dialog */}
                <TemplateSelector
                    open={templateDialogOpen}
                    onClose={() => setTemplateDialogOpen(false)}
                    onSelect={handleTemplateSelect}
                />

                {/* Create / edit flow dialog */}
                <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>{t('verification.createFlow')}</DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={t('common.name')}
                                    value={flowName}
                                    onChange={(e) => setFlowName(e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>{t('verification.flowType')}</InputLabel>
                                    <Select
                                        value={flowType}
                                        label={t('verification.flowType')}
                                        onChange={(e) => setFlowType(e.target.value)}
                                    >
                                        {FLOW_TYPES.map((ft) => (
                                            <MenuItem key={ft} value={ft}>
                                                {ft.toUpperCase()}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {/* Step editor */}
                        <Typography variant="h6" fontWeight={600} sx={{ mt: 3, mb: 1 }}>
                            {t('verification.stepEditor')}
                        </Typography>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {STEP_TYPES.map((type) => (
                                <Button
                                    key={type}
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Add />}
                                    onClick={() => addStep(type)}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {type.replace(/_/g, ' ')}
                                </Button>
                            ))}
                        </Box>

                        {steps.length === 0 ? (
                            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                {t('verification.noStepsYet')}
                            </Typography>
                        ) : (
                            steps.map((step, index) => (
                                <Card key={index} variant="outlined" sx={{ mb: 1.5, p: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                                            {t('verification.step')} {step.stepOrder}: {step.stepType.replace(/_/g, ' ')}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => moveStep(index, 'up')}
                                            disabled={index === 0}
                                        >
                                            <ArrowUpward fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => moveStep(index, 'down')}
                                            disabled={index === steps.length - 1}
                                        >
                                            <ArrowDownward fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => removeStep(index)}
                                        >
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('verification.confidenceThreshold')}: {step.confidenceThreshold}%
                                            </Typography>
                                            <Slider
                                                value={step.confidenceThreshold}
                                                onChange={(_, val) => updateStepThreshold(index, val as number)}
                                                min={0}
                                                max={100}
                                                step={5}
                                                valueLabelDisplay="auto"
                                                size="small"
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('verification.timeout')}: {step.timeoutSeconds}s
                                            </Typography>
                                            <Slider
                                                value={step.timeoutSeconds}
                                                onChange={(_, val) => updateStepTimeout(index, val as number)}
                                                min={30}
                                                max={900}
                                                step={30}
                                                valueLabelDisplay="auto"
                                                size="small"
                                            />
                                        </Grid>
                                    </Grid>
                                </Card>
                            ))
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={!flowName.trim() || steps.length === 0}
                        >
                            {t('common.create')}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
                    <DialogTitle>{t('verification.deleteFlowTitle')}</DialogTitle>
                    <DialogContent>
                        <Typography>{t('verification.deleteFlowConfirm')}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
                        <Button variant="contained" color="error" onClick={handleDelete}>
                            {t('common.delete')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </motion.div>
    )
}
