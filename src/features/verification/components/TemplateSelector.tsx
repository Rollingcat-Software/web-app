import { useEffect } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    Typography,
} from '@mui/material'
import { AccessTime, Checklist } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useVerification } from '@hooks/useVerification'
import type { VerificationTemplate } from '@core/repositories/VerificationRepository'

interface TemplateSelectorProps {
    open: boolean
    onClose: () => void
    onSelect: (template: VerificationTemplate) => void
}

const STEP_TYPE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'error'> = {
    document_scan: 'primary',
    face_match: 'success',
    liveness_check: 'info',
    address_verification: 'warning',
    phone_verification: 'info',
    email_verification: 'info',
    background_check: 'error',
    credit_check: 'warning',
}

export default function TemplateSelector({ open, onClose, onSelect }: TemplateSelectorProps) {
    const { t } = useTranslation()
    const { templates, loading, error, loadTemplates } = useVerification()

    useEffect(() => {
        if (open) {
            loadTemplates()
        }
    }, [open, loadTemplates])

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('verification.selectTemplate')}</DialogTitle>
            <DialogContent>
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && (
                    <Typography color="error" sx={{ py: 2 }}>
                        {error}
                    </Typography>
                )}

                {!loading && templates.length === 0 && (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        {t('verification.noTemplates')}
                    </Typography>
                )}

                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    {templates.map((template) => (
                        <Grid item xs={12} sm={6} key={template.id}>
                            <Card
                                variant="outlined"
                                sx={{
                                    height: '100%',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        boxShadow: 2,
                                    },
                                }}
                                onClick={() => onSelect(template)}
                            >
                                <CardContent>
                                    <Typography variant="h6" fontWeight={600} gutterBottom>
                                        {template.name}
                                    </Typography>
                                    <Chip
                                        label={template.industry}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ mb: 1.5 }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 2, minHeight: 40 }}
                                    >
                                        {template.description}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                        <Checklist fontSize="small" color="action" />
                                        <Typography variant="body2">
                                            {template.steps.length} {t('common.steps')}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                                        {template.steps.map((step, idx) => (
                                            <Chip
                                                key={idx}
                                                label={step.stepType.replace(/_/g, ' ')}
                                                size="small"
                                                color={STEP_TYPE_COLORS[step.stepType] || 'default'}
                                                variant="outlined"
                                                sx={{ fontSize: 11 }}
                                            />
                                        ))}
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccessTime fontSize="small" color="action" />
                                        <Typography variant="body2" color="text.secondary">
                                            ~{template.estimatedTimeMinutes} {t('verification.minutes')}
                                        </Typography>
                                    </Box>

                                    <Button
                                        variant="contained"
                                        size="small"
                                        fullWidth
                                        sx={{ mt: 2 }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onSelect(template)
                                        }}
                                    >
                                        {t('verification.useTemplate')}
                                    </Button>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
            </DialogActions>
        </Dialog>
    )
}
