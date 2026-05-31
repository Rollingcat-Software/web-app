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
    Tooltip,
    Alert,
    Grid,
    Divider,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Switch,
    FormControlLabel,
    type SelectChangeEvent,
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
    CallSplit,
    Close,
} from '@mui/icons-material'
import { motion, AnimatePresence, Reorder, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
    AuthMethodType,
    type AuthMethod,
    type OperationType,
    AuthFlowStep,
    DEFAULT_AUTH_METHODS,
    OPERATION_TYPE_OPTIONS,
    getMethodCategoryColor,
    isOperationType,
    normalizeOperationType,
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

/**
 * Humanized fallback label for a method type the catalog doesn't know about
 * (e.g. a backend-only method missing from DEFAULT_AUTH_METHODS). Turns
 * `APPROVE_LOGIN` → `Approve Login`, `TOTP` → `Totp`, so the builder NEVER
 * renders a blank/null step name.
 */
function humanizeMethodType(type: AuthMethodType): string {
    return String(type)
        .toLowerCase()
        .split('_')
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ')
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
    onSave?: (data: { name: string; description: string; operationType: OperationType; isDefault: boolean; steps: AuthFlowStep[] }) => void
    authMethods?: AuthMethod[]
    tenantId?: string
    initialOperationType?: string
    initialName?: string
    initialDescription?: string
    /** When editing, preserve the flow's current default flag (else editing the
     *  default flow would silently recreate it as non-default → the tenant loses
     *  its default flow and all logins fail). */
    initialIsDefault?: boolean
}

export function AuthFlowBuilder({
    initialSteps = [],
    onSave,
    authMethods = DEFAULT_AUTH_METHODS,
    initialOperationType = 'APP_LOGIN',
    initialName = '',
    initialDescription = '',
    initialIsDefault = false,
}: AuthFlowBuilderProps) {
    const { t } = useTranslation()
    const [steps, setSteps] = useState<AuthFlowStep[]>(initialSteps)
    const [flowName, setFlowName] = useState(initialName || t('authFlowBuilder.defaultFlowName'))
    const [flowDescription, setFlowDescription] = useState(initialDescription)
    const [isDefault, setIsDefault] = useState(initialIsDefault)
    const [showMethodPicker, setShowMethodPicker] = useState(false)
    // The step whose CHOICE alternatives are being edited (id), or null.
    const [choiceEditorStepId, setChoiceEditorStepId] = useState<string | null>(null)
    const [operationType, setOperationType] = useState<OperationType>(normalizeOperationType(initialOperationType))

    const availableMethods = authMethods.filter((m) => m.isActive)

    const handleOperationTypeChange = useCallback((e: SelectChangeEvent<string>) => {
        const newType = e.target.value
        if (!isOperationType(newType)) {
            return
        }
        // E: password is no longer mandatory for any operation type — operation
        // type now only categorizes the flow; it never injects/locks a step.
        setOperationType(newType)
    }, [])

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
        // E: any step is removable now (password included) — no mandatory lock.
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
        // E: free reordering — password may sit at any position. After a reorder
        // a usernameless flag is only valid on the new first step, so clear it
        // from every other step.
        setSteps(
            reordered.map((s, i) => ({
                ...s,
                order: i + 1,
                usernameless: i === 0 ? s.usernameless : false,
            })),
        )
    }, [])

    // Toggle the usernameless flag on the FIRST step (Layer 1). Only valid when
    // the first step's method supports usernameless.
    const toggleFirstStepUsernameless = useCallback((checked: boolean) => {
        setSteps((prev) =>
            prev.map((s, i) => (i === 0 ? { ...s, usernameless: checked } : s)),
        )
    }, [])

    // Add / remove a CHOICE alternative method to a step.
    const toggleChoiceAlternative = useCallback((stepId: string, methodType: AuthMethodType) => {
        setSteps((prev) =>
            prev.map((s) => {
                if (s.id !== stepId) return s
                if (methodType === s.methodType) return s // primary can't be an alternative
                const current = s.alternativeMethodTypes ?? []
                const next = current.includes(methodType)
                    ? current.filter((m) => m !== methodType)
                    : [...current, methodType]
                return { ...s, alternativeMethodTypes: next }
            }),
        )
    }, [])

    const handleSave = useCallback(() => {
        if (onSave) {
            onSave({ name: flowName, description: flowDescription, operationType, isDefault, steps })
        }
    }, [onSave, flowName, flowDescription, operationType, isDefault, steps])

    const getMethod = (methodType: AuthMethodType) =>
        authMethods.find((m) => m.type === methodType)

    const firstStep = steps[0]
    const firstStepMethod = firstStep ? getMethod(firstStep.methodType) : undefined
    const firstStepUsernamelessCapable = Boolean(firstStepMethod?.supportsUsernameless)

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
                        {t('authFlowBuilder.title')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('authFlowBuilder.subtitle')}
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
                                        label={t('authFlows.flowName')}
                                        value={flowName}
                                        onChange={(e) => setFlowName(e.target.value)}
                                        sx={{ mb: 2 }}
                                    />
                                    <TextField
                                        fullWidth
                                        label={t('authFlows.description')}
                                        value={flowDescription}
                                        onChange={(e) => setFlowDescription(e.target.value)}
                                        multiline
                                        rows={2}
                                        sx={{ mb: 2 }}
                                    />
                                    <FormControl fullWidth sx={{ mb: 2 }}>
                                        <InputLabel>{t('authFlows.operationType')}</InputLabel>
                                        <Select
                                            value={operationType}
                                            label={t('authFlows.operationType')}
                                            onChange={handleOperationTypeChange}
                                        >
                                            {OPERATION_TYPE_OPTIONS.map((op) => (
                                                <MenuItem key={op.value} value={op.value}>
                                                    {op.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={isDefault}
                                                onChange={(e) => setIsDefault(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label={t('authFlowBuilder.setDefaultForNewUsers')}
                                    />
                                </Box>

                                <Divider sx={{ my: 3 }} />

                                {/* Flow Steps */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        {t('authFlows.authSteps')}
                                    </Typography>

                                    {/* Usernameless Layer-1 toggle (E): only when the
                                        first step's method supports it. */}
                                    {firstStep && firstStepUsernamelessCapable && (
                                        <FormControlLabel
                                            sx={{ mb: 1, display: 'block' }}
                                            control={
                                                <Switch
                                                    checked={Boolean(firstStep.usernameless)}
                                                    onChange={(e) => toggleFirstStepUsernameless(e.target.checked)}
                                                    color="primary"
                                                />
                                            }
                                            label={t('authFlowBuilder.usernamelessFirstStep')}
                                        />
                                    )}

                                    {steps.length === 0 ? (
                                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                                            {t('authFlows.noStepsYet')}
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
                                                    // Defensive: a step whose method type isn't in the
                                                    // catalog (backend-only / newly added) still renders
                                                    // with a humanized name + generic styling instead of
                                                    // silently disappearing (or showing a null name).
                                                    const method = getMethod(step.methodType) ?? {
                                                        id: step.methodType,
                                                        name: humanizeMethodType(step.methodType),
                                                        type: step.methodType,
                                                        description: humanizeMethodType(step.methodType),
                                                        icon: 'Lock',
                                                        platforms: [],
                                                        isActive: true,
                                                        category: 'BASIC' as const,
                                                        supportsUsernameless: false,
                                                    }
                                                    const alternatives = step.alternativeMethodTypes ?? []
                                                    const isChoice = alternatives.length > 0

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
                                                                            flexShrink: 0,
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
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                                                            <Typography variant="subtitle1" fontWeight={600}>
                                                                                {method.name}
                                                                            </Typography>
                                                                            {isChoice && (
                                                                                <Chip
                                                                                    icon={<CallSplit sx={{ fontSize: 14 }} />}
                                                                                    label={t('authFlowBuilder.choiceBadge', { count: alternatives.length + 1 })}
                                                                                    size="small"
                                                                                    color="secondary"
                                                                                    variant="outlined"
                                                                                    sx={{ height: 22 }}
                                                                                />
                                                                            )}
                                                                            {index === 0 && step.usernameless && (
                                                                                <Chip
                                                                                    label={t('authFlowBuilder.usernamelessBadge')}
                                                                                    size="small"
                                                                                    color="info"
                                                                                    variant="outlined"
                                                                                    sx={{ height: 22 }}
                                                                                />
                                                                            )}
                                                                        </Box>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {isChoice
                                                                                ? t('authFlowBuilder.choiceDescription', {
                                                                                    methods: [method.type, ...alternatives]
                                                                                        .map((mt) => getMethod(mt)?.name ?? humanizeMethodType(mt))
                                                                                        .join(', '),
                                                                                })
                                                                                : method.description}
                                                                        </Typography>
                                                                    </Box>

                                                                    {/* Required Toggle */}
                                                                    <Tooltip title={step.isRequired ? t('authFlows.required') : t('authFlows.optional')}>
                                                                        <Chip
                                                                            label={step.isRequired ? t('authFlows.required') : t('authFlows.optional')}
                                                                            size="small"
                                                                            color={step.isRequired ? 'primary' : 'default'}
                                                                            onClick={() =>
                                                                                updateStepRequired(step.id, !step.isRequired)
                                                                            }
                                                                            sx={{ cursor: 'pointer' }}
                                                                        />
                                                                    </Tooltip>

                                                                    {/* Make this step a CHOICE ("leave choice to
                                                                        user"). A labeled button — not a bare icon —
                                                                        so the affordance is discoverable on EVERY
                                                                        step/layer (incl. a 3rd), per the operator
                                                                        report that they couldn't turn a 3rd layer
                                                                        into a user-choice step. */}
                                                                    <Tooltip title={t('authFlowBuilder.leaveChoiceToUserHint')}>
                                                                        <Button
                                                                            size="small"
                                                                            variant={isChoice || choiceEditorStepId === step.id ? 'contained' : 'outlined'}
                                                                            color="secondary"
                                                                            startIcon={<CallSplit fontSize="small" />}
                                                                            onClick={() =>
                                                                                setChoiceEditorStepId(
                                                                                    choiceEditorStepId === step.id ? null : step.id,
                                                                                )
                                                                            }
                                                                            aria-label={t('authFlowBuilder.editChoices')}
                                                                            sx={{ flexShrink: 0, textTransform: 'none', whiteSpace: 'nowrap' }}
                                                                        >
                                                                            {t('authFlowBuilder.leaveChoiceToUser')}
                                                                        </Button>
                                                                    </Tooltip>

                                                                    {/* Delete */}
                                                                    <Tooltip title={t('authFlows.removeStep')}>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => removeStep(step.id)}
                                                                            sx={{
                                                                                color: 'error.main',
                                                                                '&:hover': { bgcolor: 'error.lighter' },
                                                                            }}
                                                                            aria-label={t('common.aria.remove')}
                                                                        >
                                                                            <Delete fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Paper>

                                                                {/* CHOICE editor (E): pick the alternative
                                                                    methods this step also accepts. */}
                                                                <AnimatePresence>
                                                                    {choiceEditorStepId === step.id && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, height: 0 }}
                                                                            animate={{ opacity: 1, height: 'auto' }}
                                                                            exit={{ opacity: 0, height: 0 }}
                                                                            transition={{ duration: 0.25 }}
                                                                        >
                                                                            <Paper
                                                                                elevation={0}
                                                                                sx={{
                                                                                    mt: 1,
                                                                                    p: 2,
                                                                                    bgcolor: 'background.default',
                                                                                    borderRadius: 2,
                                                                                    border: '1px dashed',
                                                                                    borderColor: 'divider',
                                                                                }}
                                                                            >
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                                                    <Typography variant="subtitle2" fontWeight={600}>
                                                                                        {t('authFlowBuilder.choiceEditorTitle')}
                                                                                    </Typography>
                                                                                    <IconButton
                                                                                        size="small"
                                                                                        onClick={() => setChoiceEditorStepId(null)}
                                                                                        aria-label={t('common.close')}
                                                                                    >
                                                                                        <Close fontSize="small" />
                                                                                    </IconButton>
                                                                                </Box>
                                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                                                                    {t('authFlowBuilder.choiceEditorHint')}
                                                                                </Typography>
                                                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                                                    {availableMethods
                                                                                        .filter((m) => m.type !== step.methodType)
                                                                                        .map((m) => {
                                                                                            const selected = alternatives.includes(m.type)
                                                                                            return (
                                                                                                <Chip
                                                                                                    key={m.id}
                                                                                                    label={m.name}
                                                                                                    icon={selected ? undefined : undefined}
                                                                                                    color={selected ? 'primary' : 'default'}
                                                                                                    variant={selected ? 'filled' : 'outlined'}
                                                                                                    onClick={() => toggleChoiceAlternative(step.id, m.type)}
                                                                                                    sx={{ cursor: 'pointer' }}
                                                                                                />
                                                                                            )
                                                                                        })}
                                                                                </Box>
                                                                            </Paper>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>

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
                                    {t('authFlowBuilder.addAuthStep')}
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
                                                    {t('authFlowBuilder.selectMethod')}
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
                                                                {method.supportsUsernameless && (
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {t('authFlowBuilder.usernamelessCapable')}
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
                                    {t('authFlowBuilder.preview')}
                                </Typography>

                                {steps.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {t('authFlowBuilder.previewEmpty')}
                                    </Typography>
                                ) : (
                                    <Box>
                                        {steps.map((step, index) => {
                                            const method = getMethod(step.methodType)
                                            const alternatives = step.alternativeMethodTypes ?? []
                                            const label = alternatives.length > 0
                                                ? [step.methodType, ...alternatives]
                                                    .map((mt) => getMethod(mt)?.name ?? humanizeMethodType(mt))
                                                    .join(' / ')
                                                : method?.name
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
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </Box>
                                                    <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0 }}>
                                                        {label}
                                                    </Typography>
                                                    {!step.isRequired && (
                                                        <Chip
                                                            label={t('authFlows.optional')}
                                                            size="small"
                                                            sx={{ height: 20, fontSize: '0.65rem' }}
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
                                {t('authFlowBuilder.saveFlow')}
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<PlayArrow />}
                                disabled={steps.length === 0}
                            >
                                {t('authFlowBuilder.testFlow')}
                            </Button>
                        </Box>
                    </motion.div>
                </Grid>
            </Grid>
        </Box>
    )
}
