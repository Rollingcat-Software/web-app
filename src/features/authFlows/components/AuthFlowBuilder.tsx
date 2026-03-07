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
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    type SelectChangeEvent,
} from '@mui/material'
import {
    Add,
    Delete,
    DragIndicator,
    ArrowForward,
    Lock,
    LockOutlined,
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

const OPERATION_TYPES = [
    { value: 'APP_LOGIN', label: 'App Login' },
    { value: 'DOOR_ACCESS', label: 'Door Access' },
    { value: 'BUILDING_ACCESS', label: 'Building Access' },
    { value: 'API_ACCESS', label: 'API Access' },
    { value: 'TRANSACTION', label: 'Transaction' },
    { value: 'ENROLLMENT', label: 'Enrollment' },
    { value: 'GUEST_ACCESS', label: 'Guest Access' },
    { value: 'EXAM_PROCTORING', label: 'Exam Proctoring' },
    { value: 'CUSTOM', label: 'Custom' },
] as const

const PASSWORD_MANDATORY_OPS = new Set(['APP_LOGIN', 'API_ACCESS'])

interface AuthFlowBuilderProps {
    initialSteps?: AuthFlowStep[]
    onSave?: (data: { name: string; description: string; operationType: string; isDefault: boolean; steps: AuthFlowStep[] }) => void
    tenantId?: string
    initialOperationType?: string
    initialName?: string
    initialDescription?: string
}

export function AuthFlowBuilder({
    initialSteps = [],
    onSave,
    initialOperationType = 'APP_LOGIN',
    initialName = 'My Authentication Flow',
    initialDescription = '',
}: AuthFlowBuilderProps) {
    const [steps, setSteps] = useState<AuthFlowStep[]>(initialSteps)
    const [flowName, setFlowName] = useState(initialName)
    const [flowDescription, setFlowDescription] = useState(initialDescription)
    const [isDefault, setIsDefault] = useState(false)
    const [showMethodPicker, setShowMethodPicker] = useState(false)
    const [operationType, setOperationType] = useState(initialOperationType)

    const passwordLocked = PASSWORD_MANDATORY_OPS.has(operationType)

    const availableMethods = DEFAULT_AUTH_METHODS.filter((m) => m.isActive)

    const handleOperationTypeChange = useCallback((e: SelectChangeEvent<string>) => {
        const newType = e.target.value
        setOperationType(newType)
        if (PASSWORD_MANDATORY_OPS.has(newType)) {
            const hasPassword = steps.some(s => s.methodType === AuthMethodType.PASSWORD && s.order === 1)
            if (!hasPassword) {
                const passwordStep: AuthFlowStep = {
                    id: `step-password-${Date.now()}`,
                    order: 1,
                    methodId: 'PASSWORD',
                    methodType: AuthMethodType.PASSWORD,
                    isRequired: true,
                    timeout: 120,
                    maxAttempts: 3,
                }
                setSteps(prev => [passwordStep, ...prev.filter(s => s.methodType !== AuthMethodType.PASSWORD)].map((s, i) => ({ ...s, order: i + 1 })))
            }
        }
    }, [steps])

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
            const step = prev.find(s => s.id === stepId)
            if (step && step.methodType === AuthMethodType.PASSWORD && step.order === 1 && passwordLocked) {
                return prev
            }
            const filtered = prev.filter((s) => s.id !== stepId)
            return filtered.map((s, i) => ({ ...s, order: i + 1 }))
        })
    }, [passwordLocked])

    const updateStepRequired = useCallback((stepId: string, isRequired: boolean) => {
        setSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, isRequired } : s))
        )
    }, [])

    const handleReorder = useCallback((reordered: AuthFlowStep[]) => {
        if (passwordLocked) {
            const passwordIdx = reordered.findIndex(s => s.methodType === AuthMethodType.PASSWORD)
            if (passwordIdx !== 0) {
                return
            }
        }
        setSteps(reordered.map((s, i) => ({ ...s, order: i + 1 })))
    }, [passwordLocked])

    const handleSave = useCallback(() => {
        if (onSave) {
            onSave({ name: flowName, description: flowDescription, operationType, isDefault, steps })
        }
    }, [onSave, flowName, flowDescription, operationType, isDefault, steps])

    const getMethod = (methodType: AuthMethodType) =>
        DEFAULT_AUTH_METHODS.find((m) => m.type === methodType)

    // Cost summary removed - pricing not managed in frontend

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
                                    <FormControl fullWidth sx={{ mb: 2 }}>
                                        <InputLabel>Operation Type</InputLabel>
                                        <Select
                                            value={operationType}
                                            label="Operation Type"
                                            onChange={handleOperationTypeChange}
                                        >
                                            {OPERATION_TYPES.map((op) => (
                                                <MenuItem key={op.value} value={op.value}>
                                                    {op.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {passwordLocked && (
                                        <Alert severity="info" icon={<LockOutlined />} sx={{ mb: 2, borderRadius: 2 }}>
                                            {operationType} flows require Password as the first step. This is enforced for security.
                                        </Alert>
                                    )}
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
