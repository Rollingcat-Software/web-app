import { useState, useCallback } from 'react'
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    IconButton,
    Paper,
    TextField,
    Switch,
    FormControlLabel,
    Tooltip,
    Alert,
    Grid,
    Divider,
} from '@mui/material'
import {
    Add,
    Delete,
    DragIndicator,
    ArrowForward,
    Lock,
    Email,
    Sms,
    PhonelinkLock,
    QrCode2,
    Face,
    Fingerprint,
    RecordVoiceOver,
    Nfc,
    Key,
    Save,
    PlayArrow,
    Settings,
} from '@mui/icons-material'
import { motion, AnimatePresence, Reorder, Variants } from 'framer-motion'
import {
    AuthMethodType,
    AuthFlowStep,
    DEFAULT_AUTH_METHODS,
    getMethodCategoryColor,
} from '@domain/models/AuthMethod'

// Bezier easing
const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
    exit: {
        opacity: 0,
        x: -20,
        transition: { duration: 0.2 },
    },
}

// Icon mapping
const methodIcons: Record<string, React.ReactNode> = {
    Lock: <Lock />,
    Email: <Email />,
    Sms: <Sms />,
    PhonelinkLock: <PhonelinkLock />,
    QrCode2: <QrCode2 />,
    Face: <Face />,
    Fingerprint: <Fingerprint />,
    RecordVoiceOver: <RecordVoiceOver />,
    Nfc: <Nfc />,
    Key: <Key />,
}

interface AuthFlowBuilderProps {
    initialSteps?: AuthFlowStep[]
    onSave?: (steps: AuthFlowStep[]) => void
    tenantId?: string
}

export function AuthFlowBuilder({ initialSteps = [], onSave }: AuthFlowBuilderProps) {
    const [steps, setSteps] = useState<AuthFlowStep[]>(initialSteps)
    const [flowName, setFlowName] = useState('My Authentication Flow')
    const [flowDescription, setFlowDescription] = useState('')
    const [isDefault, setIsDefault] = useState(false)
    const [showMethodPicker, setShowMethodPicker] = useState(false)

    const availableMethods = DEFAULT_AUTH_METHODS.filter((m) => m.isActive)

    const addStep = useCallback((methodId: string, methodType: AuthMethodType) => {
        const newStep: AuthFlowStep = {
            id: `step-${Date.now()}`,
            order: steps.length + 1,
            methodId,
            methodType,
            isRequired: true,
            timeout: 120,
            maxAttempts: 3,
        }
        setSteps((prev) => [...prev, newStep])
        setShowMethodPicker(false)
    }, [steps.length])

    const removeStep = useCallback((stepId: string) => {
        setSteps((prev) => {
            const filtered = prev.filter((s) => s.id !== stepId)
            return filtered.map((s, i) => ({ ...s, order: i + 1 }))
        })
    }, [])

    const updateStepRequired = useCallback((stepId: string, isRequired: boolean) => {
        setSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, isRequired } : s))
        )
    }, [])

    const handleReorder = useCallback((reordered: AuthFlowStep[]) => {
        setSteps(reordered.map((s, i) => ({ ...s, order: i + 1 })))
    }, [])

    const handleSave = useCallback(() => {
        if (onSave) {
            onSave(steps)
        }
    }, [onSave, steps])

    const getMethod = (methodType: AuthMethodType) =>
        DEFAULT_AUTH_METHODS.find((m) => m.type === methodType)

    const totalMonthlyCost = steps.reduce((acc, step) => {
        const method = getMethod(step.methodType)
        return acc + (method?.pricePerMonth ?? 0)
    }, 0)

    return (
        <Box>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeOut }}
            >
                <Box sx={{ mb: 4 }}>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 1,
                        }}
                    >
                        Authentication Flow Builder
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Create custom authentication sequences for your users
                    </Typography>
                </Box>
            </motion.div>

            <Grid container spacing={3}>
                {/* Flow Configuration */}
                <Grid item xs={12} md={8}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, ease: easeOut }}
                    >
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                {/* Flow Details */}
                                <Box sx={{ mb: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Flow Name"
                                        value={flowName}
                                        onChange={(e) => setFlowName(e.target.value)}
                                        sx={{ mb: 2 }}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Description"
                                        value={flowDescription}
                                        onChange={(e) => setFlowDescription(e.target.value)}
                                        multiline
                                        rows={2}
                                        sx={{ mb: 2 }}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={isDefault}
                                                onChange={(e) => setIsDefault(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label="Set as default flow for new users"
                                    />
                                </Box>

                                <Divider sx={{ my: 3 }} />

                                {/* Flow Steps */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        Authentication Steps
                                    </Typography>

                                    {steps.length === 0 ? (
                                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                                            No steps added yet. Click "Add Step" to start building your
                                            authentication flow.
                                        </Alert>
                                    ) : (
                                        <Reorder.Group
                                            axis="y"
                                            values={steps}
                                            onReorder={handleReorder}
                                            style={{ listStyle: 'none', padding: 0, margin: 0 }}
                                        >
                                            <AnimatePresence>
                                                {steps.map((step, index) => {
                                                    const method = getMethod(step.methodType)
                                                    if (!method) return null

                                                    return (
                                                        <Reorder.Item
                                                            key={step.id}
                                                            value={step}
                                                            style={{ marginBottom: 12 }}
                                                        >
                                                            <motion.div
                                                                variants={itemVariants}
                                                                initial="hidden"
                                                                animate="visible"
                                                                exit="exit"
                                                                layout
                                                            >
                                                                <Paper
                                                                    elevation={0}
                                                                    sx={{
                                                                        p: 2,
                                                                        border: '2px solid',
                                                                        borderColor: 'divider',
                                                                        borderRadius: 3,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 2,
                                                                        cursor: 'grab',
                                                                        transition: 'all 0.2s ease',
                                                                        '&:hover': {
                                                                            borderColor: 'primary.light',
                                                                            bgcolor: 'rgba(99, 102, 241, 0.04)',
                                                                        },
                                                                    }}
                                                                >
                                                                    {/* Drag Handle */}
                                                                    <DragIndicator
                                                                        sx={{ color: 'text.secondary', cursor: 'grab' }}
                                                                    />

                                                                    {/* Step Number */}
                                                                    <Box
                                                                        sx={{
                                                                            width: 32,
                                                                            height: 32,
                                                                            borderRadius: '50%',
                                                                            bgcolor: 'primary.main',
                                                                            color: 'white',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontWeight: 700,
                                                                            fontSize: '0.875rem',
                                                                        }}
                                                                    >
                                                                        {index + 1}
                                                                    </Box>

                                                                    {/* Method Icon */}
                                                                    <Box
                                                                        sx={{
                                                                            p: 1.5,
                                                                            borderRadius: 2,
                                                                            bgcolor: `${getMethodCategoryColor(method.category)}15`,
                                                                            color: getMethodCategoryColor(method.category),
                                                                        }}
                                                                    >
                                                                        {methodIcons[method.icon] || <Lock />}
                                                                    </Box>

                                                                    {/* Method Info */}
                                                                    <Box sx={{ flex: 1 }}>
                                                                        <Typography variant="subtitle1" fontWeight={600}>
                                                                            {method.name}
                                                                        </Typography>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {method.description}
                                                                        </Typography>
                                                                    </Box>

                                                                    {/* Required Toggle */}
                                                                    <Tooltip title={step.isRequired ? 'Required' : 'Optional'}>
                                                                        <Chip
                                                                            label={step.isRequired ? 'Required' : 'Optional'}
                                                                            size="small"
                                                                            color={step.isRequired ? 'primary' : 'default'}
                                                                            onClick={() =>
                                                                                updateStepRequired(step.id, !step.isRequired)
                                                                            }
                                                                            sx={{ cursor: 'pointer' }}
                                                                        />
                                                                    </Tooltip>

                                                                    {/* Price */}
                                                                    {method.pricePerMonth > 0 && (
                                                                        <Chip
                                                                            label={`$${method.pricePerMonth}/mo`}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                borderColor: getMethodCategoryColor(method.category),
                                                                                color: getMethodCategoryColor(method.category),
                                                                            }}
                                                                        />
                                                                    )}

                                                                    {/* Settings */}
                                                                    <Tooltip title="Step settings">
                                                                        <IconButton size="small">
                                                                            <Settings fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>

                                                                    {/* Delete */}
                                                                    <Tooltip title="Remove step">
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => removeStep(step.id)}
                                                                            sx={{
                                                                                color: 'error.main',
                                                                                '&:hover': { bgcolor: 'error.lighter' },
                                                                            }}
                                                                        >
                                                                            <Delete fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Paper>

                                                                {/* Arrow connector */}
                                                                {index < steps.length - 1 && (
                                                                    <Box
                                                                        sx={{
                                                                            display: 'flex',
                                                                            justifyContent: 'center',
                                                                            py: 1,
                                                                        }}
                                                                    >
                                                                        <ArrowForward
                                                                            sx={{
                                                                                color: 'primary.main',
                                                                                transform: 'rotate(90deg)',
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                )}
                                                            </motion.div>
                                                        </Reorder.Item>
                                                    )
                                                })}
                                            </AnimatePresence>
                                        </Reorder.Group>
                                    )}
                                </Box>

                                {/* Add Step Button */}
                                <Button
                                    variant="outlined"
                                    startIcon={<Add />}
                                    onClick={() => setShowMethodPicker(true)}
                                    fullWidth
                                    sx={{
                                        py: 1.5,
                                        borderStyle: 'dashed',
                                        borderWidth: 2,
                                        '&:hover': {
                                            borderStyle: 'dashed',
                                            borderWidth: 2,
                                        },
                                    }}
                                >
                                    Add Authentication Step
                                </Button>

                                {/* Method Picker */}
                                <AnimatePresence>
                                    {showMethodPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <Paper
                                                elevation={0}
                                                sx={{
                                                    mt: 2,
                                                    p: 2,
                                                    bgcolor: 'background.default',
                                                    borderRadius: 3,
                                                }}
                                            >
                                                <Typography
                                                    variant="subtitle2"
                                                    fontWeight={600}
                                                    sx={{ mb: 2 }}
                                                >
                                                    Select Authentication Method
                                                </Typography>
                                                <Grid container spacing={1.5}>
                                                    {availableMethods.map((method) => (
                                                        <Grid item xs={6} sm={4} key={method.id}>
                                                            <Paper
                                                                elevation={0}
                                                                sx={{
                                                                    p: 2,
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                    borderRadius: 2,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease',
                                                                    '&:hover': {
                                                                        borderColor: getMethodCategoryColor(
                                                                            method.category
                                                                        ),
                                                                        bgcolor: `${getMethodCategoryColor(method.category)}08`,
                                                                        transform: 'translateY(-2px)',
                                                                    },
                                                                }}
                                                                onClick={() =>
                                                                    addStep(method.id, method.type)
                                                                }
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        color: getMethodCategoryColor(method.category),
                                                                        mb: 1,
                                                                    }}
                                                                >
                                                                    {methodIcons[method.icon] || <Lock />}
                                                                </Box>
                                                                <Typography
                                                                    variant="body2"
                                                                    fontWeight={600}
                                                                >
                                                                    {method.name}
                                                                </Typography>
                                                                {method.pricePerMonth > 0 && (
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                    >
                                                                        ${method.pricePerMonth}/mo
                                                                    </Typography>
                                                                )}
                                                            </Paper>
                                                        </Grid>
                                                    ))}
                                                </Grid>
                                            </Paper>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                {/* Flow Preview & Actions */}
                <Grid item xs={12} md={4}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2, ease: easeOut }}
                    >
                        {/* Preview Card */}
                        <Card sx={{ mb: 3 }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                    Flow Preview
                                </Typography>

                                {steps.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Add steps to preview your flow
                                    </Typography>
                                ) : (
                                    <Box>
                                        {steps.map((step, index) => {
                                            const method = getMethod(step.methodType)
                                            return (
                                                <Box
                                                    key={step.id}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1.5,
                                                        mb: index < steps.length - 1 ? 2 : 0,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: '50%',
                                                            bgcolor: 'primary.main',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </Box>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {method?.name}
                                                    </Typography>
                                                    {!step.isRequired && (
                                                        <Chip
                                                            label="Optional"
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.65rem',
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            )
                                        })}
                                    </Box>
                                )}
                            </CardContent>
                        </Card>

                        {/* Cost Summary */}
                        <Card sx={{ mb: 3 }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                    Cost Summary
                                </Typography>

                                {steps.map((step) => {
                                    const method = getMethod(step.methodType)
                                    if (!method || method.pricePerMonth === 0) return null
                                    return (
                                        <Box
                                            key={step.id}
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                mb: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                {method.name}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={500}>
                                                ${method.pricePerMonth}/mo
                                            </Typography>
                                        </Box>
                                    )
                                })}

                                <Divider sx={{ my: 2 }} />

                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Total
                                    </Typography>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={700}
                                        color="primary.main"
                                    >
                                        ${totalMonthlyCost}/mo
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<Save />}
                                onClick={handleSave}
                                disabled={steps.length === 0}
                                sx={{
                                    py: 1.5,
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                }}
                            >
                                Save Flow
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<PlayArrow />}
                                disabled={steps.length === 0}
                            >
                                Test Flow
                            </Button>
                        </Box>
                    </motion.div>
                </Grid>
            </Grid>
        </Box>
    )
}
