/**
 * StepProgress — Compact top-of-step indicator for hosted login + MFA flows.
 *
 * Replaces per-step inline "Step N of M" text (e.g. the NFC component's bespoke
 * copy) so every method renders a consistent progress affordance. Hidden when
 * the flow has only a single step to avoid visual noise on trivial flows.
 *
 * @param current 1-based current step number.
 * @param total total step count for the flow; component renders nothing when <= 1.
 */

import { Box, LinearProgress, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface StepProgressProps {
    current: number
    total: number
    /** Optional labeled override (e.g. localized method name) shown after the counter. */
    label?: string
}

export default function StepProgress({ current, total, label }: StepProgressProps) {
    const { t } = useTranslation()
    if (!total || total <= 1) return null

    const safeCurrent = Math.max(1, Math.min(current, total))
    const pct = Math.round((safeCurrent / total) * 100)

    return (
        <Box
            sx={{ mb: 2 }}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={safeCurrent}
            aria-label={t('widget.stepOfTotal', { current: safeCurrent, total })}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {t('widget.stepOfTotal', { current: safeCurrent, total })}
                </Typography>
                {label ? (
                    <Typography variant="caption" color="text.secondary">
                        {label}
                    </Typography>
                ) : null}
            </Box>
            <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                    },
                }}
            />
        </Box>
    )
}
