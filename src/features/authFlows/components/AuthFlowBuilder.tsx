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
    Checkbox,
    FormGroup,
    type SelectChangeEvent,
} from '@mui/material'
import {
    Add,
    Delete,
    Save,
} from '@mui/icons-material'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
    AuthMethodType,
    type AuthMethod,
    type OperationType,
    AuthFlowStep,
    DEFAULT_AUTH_METHODS,
    OPERATION_TYPE_OPTIONS,
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
 * renders a blank/null method name.
 */
function humanizeMethodType(type: AuthMethodType): string {
    return String(type)
        .toLowerCase()
        .split('_')
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ')
}

/**
 * The ordered set of auth methods a LAYER (step) accepts. The user satisfies a
 * layer by completing ANY ONE of these methods. This is the in-memory
 * source-of-truth; the persisted wire shape derives from it:
 *   authMethodType        = methods[0]
 *   alternativeMethodTypes = methods.slice(1)
 */
function getLayerMethods(step: AuthFlowStep): AuthMethodType[] {
    return [step.methodType, ...(step.alternativeMethodTypes ?? [])].filter(
        (m): m is AuthMethodType => Boolean(m),
    )
}

/**
 * Write a layer's method set back onto the step, keeping the wire contract
 * (authMethodType = first, alternativeMethodTypes = rest). An empty set leaves
 * methodType blank — such a layer is blocked from saving (see canSave).
 */
function setLayerMethods(step: AuthFlowStep, methods: AuthMethodType[]): AuthFlowStep {
    const [first, ...rest] = methods
    return {
        ...step,
        methodType: (first ?? ('' as AuthMethodType)),
        methodId: first ?? '',
        alternativeMethodTypes: rest.length > 0 ? rest : undefined,
        // A layer with no usernameless-capable method can't be usernameless.
        usernameless: step.usernameless,
    }
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
    const [operationType, setOperationType] = useState<OperationType>(normalizeOperationType(initialOperationType))

    const availableMethods = authMethods.filter((m) => m.isActive)

    const handleOperationTypeChange = useCallback((e: SelectChangeEvent<string>) => {
        const newType = e.target.value
        if (!isOperationType(newType)) {
            return
        }
        // Operation type only categorizes the flow; it never injects/locks a step.
        setOperationType(newType)
    }, [])

    // Append a new EMPTY layer (no methods selected, required by default).
    const addLayer = useCallback(() => {
        setSteps((prev) => [
            ...prev,
            {
                // Date.now() alone collides when two layers are added within the
                // same millisecond → duplicate React keys + cross-layer edits.
                id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                order: prev.length + 1,
                methodId: '',
                methodType: '' as AuthMethodType,
                isRequired: true,
                timeout: 120,
                maxAttempts: 3,
            },
        ])
    }, [])

    const removeLayer = useCallback((stepId: string) => {
        setSteps((prev) =>
            prev
                .filter((s) => s.id !== stepId)
                .map((s, i) => ({
                    ...s,
                    order: i + 1,
                    // usernameless is only valid on Layer 1.
                    usernameless: i === 0 ? s.usernameless : false,
                })),
        )
    }, [])

    const updateLayerRequired = useCallback((stepId: string, isRequired: boolean) => {
        setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, isRequired } : s)))
    }, [])

    // Check / uncheck a method within a layer. Recomputes the wire shape
    // (methodType = first, alternativeMethodTypes = rest) on every edit.
    const toggleLayerMethod = useCallback((stepId: string, methodType: AuthMethodType) => {
        setSteps((prev) =>
            prev.map((s) => {
                if (s.id !== stepId) return s
                const current = getLayerMethods(s)
                const next = current.includes(methodType)
                    ? current.filter((m) => m !== methodType)
                    : [...current, methodType]
                const updated = setLayerMethods(s, next)
                // If the layer no longer contains a usernameless-capable method,
                // drop the usernameless flag so we never persist an invalid combo.
                const stillUsernamelessCapable = next.some((mt) =>
                    availableMethods.find((m) => m.type === mt)?.supportsUsernameless,
                )
                return stillUsernamelessCapable ? updated : { ...updated, usernameless: false }
            }),
        )
    }, [availableMethods])

    // Toggle the usernameless flag on Layer 1. Only valid when Layer 1's selected
    // methods include a usernameless-capable one.
    const toggleFirstLayerUsernameless = useCallback((checked: boolean) => {
        setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, usernameless: checked } : s)))
    }, [])

    const getMethod = useCallback(
        (methodType: AuthMethodType) => authMethods.find((m) => m.type === methodType),
        [authMethods],
    )

    const methodName = useCallback(
        (methodType: AuthMethodType) => getMethod(methodType)?.name ?? humanizeMethodType(methodType),
        [getMethod],
    )

    // Validation: every layer must have ≥1 method, and there must be ≥1 layer.
    const emptyLayer = steps.some((s) => getLayerMethods(s).length === 0)
    const canSave = steps.length > 0 && !emptyLayer

    const handleSave = useCallback(() => {
        if (!onSave || !canSave) return
        // Defensive: never send a 0-method layer (would 400 the backend).
        const payloadSteps = steps
            .filter((s) => getLayerMethods(s).length > 0)
            .map((s, i) => ({ ...s, order: i + 1 }))
        onSave({ name: flowName, description: flowDescription, operationType, isDefault, steps: payloadSteps })
    }, [onSave, canSave, flowName, flowDescription, operationType, isDefault, steps])

    const firstStep = steps[0]
    const firstLayerUsernamelessCapable = firstStep
        ? getLayerMethods(firstStep).some((mt) => getMethod(mt)?.supportsUsernameless)
        : false

    return (
        <Box>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeOut }}
            >
                <Box sx={{ mb: 2.5 }}>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 0.5,
                        }}
                    >
                        {t('authFlowBuilder.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
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

                                {/* Layers */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
                                        {t('authFlowBuilder.layersTitle')}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {t('authFlowBuilder.layersHint')}
                                    </Typography>

                                    {steps.length === 0 ? (
                                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                                            {t('authFlowBuilder.noLayersYet')}
                                        </Alert>
                                    ) : (
                                        <AnimatePresence>
                                            {steps.map((step, index) => {
                                                const selected = getLayerMethods(step)
                                                const isFirst = index === 0
                                                const hasNone = selected.length === 0
                                                const isChoice = selected.length >= 2

                                                return (
                                                    <motion.div
                                                        key={step.id}
                                                        variants={itemVariants}
                                                        initial="hidden"
                                                        animate="visible"
                                                        exit="exit"
                                                        layout
                                                        style={{ marginBottom: 16 }}
                                                    >
                                                        <Paper
                                                            elevation={0}
                                                            sx={{
                                                                p: 2.5,
                                                                border: '2px solid',
                                                                borderColor: hasNone ? 'error.light' : 'divider',
                                                                borderRadius: 3,
                                                            }}
                                                        >
                                                            {/* Layer header */}
                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 1.5,
                                                                    mb: 1.5,
                                                                }}
                                                            >
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
                                                                <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                                                                    {t('authFlowBuilder.layerLabel', { number: index + 1 })}
                                                                </Typography>
                                                                <FormControlLabel
                                                                    sx={{ mr: 0 }}
                                                                    control={
                                                                        <Switch
                                                                            checked={step.isRequired}
                                                                            onChange={(e) =>
                                                                                updateLayerRequired(step.id, e.target.checked)
                                                                            }
                                                                            color="primary"
                                                                            size="small"
                                                                            inputProps={{
                                                                                'aria-label': t('authFlows.required'),
                                                                            }}
                                                                        />
                                                                    }
                                                                    label={
                                                                        <Typography variant="body2">
                                                                            {t('authFlows.required')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                                <Tooltip title={t('authFlowBuilder.removeLayer')}>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => removeLayer(step.id)}
                                                                        sx={{
                                                                            color: 'error.main',
                                                                            '&:hover': { bgcolor: 'error.lighter' },
                                                                        }}
                                                                        aria-label={t('authFlowBuilder.removeLayer')}
                                                                    >
                                                                        <Delete fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>

                                                            {/* Method checkboxes — uniform tidy grid */}
                                                            <FormGroup>
                                                                <Grid container spacing={0.5}>
                                                                    {availableMethods.map((method) => (
                                                                        <Grid item xs={12} sm={6} md={4} key={method.id}>
                                                                            <FormControlLabel
                                                                                sx={{ width: '100%', m: 0 }}
                                                                                control={
                                                                                    <Checkbox
                                                                                        size="small"
                                                                                        checked={selected.includes(method.type)}
                                                                                        onChange={() =>
                                                                                            toggleLayerMethod(step.id, method.type)
                                                                                        }
                                                                                    />
                                                                                }
                                                                                label={
                                                                                    <Typography variant="body2" noWrap>
                                                                                        {method.name}
                                                                                    </Typography>
                                                                                }
                                                                            />
                                                                        </Grid>
                                                                    ))}
                                                                </Grid>
                                                            </FormGroup>

                                                            {/* Helper text reflecting the current selection */}
                                                            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                                {hasNone ? (
                                                                    <Typography variant="caption" color="error">
                                                                        {t('authFlowBuilder.layerSelectAtLeastOne')}
                                                                    </Typography>
                                                                ) : isChoice ? (
                                                                    <>
                                                                        <Chip
                                                                            label={t('authFlowBuilder.choiceBadge', { count: selected.length })}
                                                                            size="small"
                                                                            color="secondary"
                                                                            variant="outlined"
                                                                            sx={{ height: 22 }}
                                                                        />
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {t('authFlowBuilder.layerAnyOneOf')}
                                                                        </Typography>
                                                                    </>
                                                                ) : (
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {t('authFlowBuilder.layerSingleMethod')}
                                                                    </Typography>
                                                                )}
                                                            </Box>

                                                            {/* Usernameless toggle — Layer 1 only, only when a
                                                                usernameless-capable method is selected. */}
                                                            {isFirst && firstLayerUsernamelessCapable && (
                                                                <Tooltip title={t('authFlowBuilder.usernamelessTooltip')}>
                                                                    <FormControlLabel
                                                                        sx={{ mt: 1, display: 'block' }}
                                                                        control={
                                                                            <Switch
                                                                                checked={Boolean(step.usernameless)}
                                                                                onChange={(e) =>
                                                                                    toggleFirstLayerUsernameless(e.target.checked)
                                                                                }
                                                                                color="primary"
                                                                                size="small"
                                                                            />
                                                                        }
                                                                        label={
                                                                            <Typography variant="body2">
                                                                                {t('authFlowBuilder.usernamelessFirstStep')}
                                                                            </Typography>
                                                                        }
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </Paper>
                                                    </motion.div>
                                                )
                                            })}
                                        </AnimatePresence>
                                    )}
                                </Box>

                                {/* Add Layer Button */}
                                <Button
                                    variant="outlined"
                                    startIcon={<Add />}
                                    onClick={addLayer}
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
                                    {t('authFlowBuilder.addLayer')}
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                {/* Flow Preview & Actions */}
                <Grid item xs={12} md={4}>
                    {/* UX: keep the live preview + Save/Test actions visible while the
                        user scrolls the (often long) layers column. */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2, ease: easeOut }}
                        style={{ position: 'sticky', top: 16 }}
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
                                            const selected = getLayerMethods(step)
                                            const label =
                                                selected.length > 0
                                                    ? selected.map(methodName).join(' / ')
                                                    : t('authFlowBuilder.layerEmptyPreview')
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
                                                            bgcolor: selected.length > 0 ? 'primary.main' : 'error.main',
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
                            {!canSave && (
                                <Alert severity="info" sx={{ borderRadius: 2 }}>
                                    {steps.length === 0
                                        ? t('authFlowBuilder.saveDisabledNoLayers')
                                        : t('authFlowBuilder.saveDisabledEmptyLayer')}
                                </Alert>
                            )}
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<Save />}
                                onClick={handleSave}
                                disabled={!canSave}
                                sx={{
                                    py: 1.5,
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                }}
                            >
                                {t('authFlowBuilder.saveFlow')}
                            </Button>
                            {/* "Test Flow" removed: it had no behaviour (no backend
                                simulate endpoint) and read as broken. The live Flow
                                Preview above shows the configured sequence; a real
                                tester (run the flow on the hosted login) can be added
                                later behind a dedicated endpoint. */}
                        </Box>
                    </motion.div>
                </Grid>
            </Grid>
        </Box>
    )
}
