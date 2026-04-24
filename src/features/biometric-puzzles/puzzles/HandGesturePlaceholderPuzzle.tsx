/**
 * HandGesturePlaceholderPuzzle — 9 hand challenges share this placeholder
 * until the real @mediapipe/tasks-vision HandLandmarker detector from
 * `feat/gesture-phase2-web` merges. Simulates a 2-second detection so the
 * flow can still demo end-to-end.
 */
import React, { useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material'
import { PanTool } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { BiometricPuzzleProps } from '../biometricPuzzleRegistry'

interface Props extends BiometricPuzzleProps {
    i18nKey: string
}

function HandGesturePlaceholderPuzzle({ onSuccess, i18nKey }: Props) {
    const { t } = useTranslation()
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        timerRef.current = window.setTimeout(() => onSuccess(), 2000)
        return () => {
            if (timerRef.current != null) {
                window.clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [onSuccess])

    return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
            <PanTool sx={{ fontSize: 72, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {t(`${i18nKey}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t(`${i18nKey}.description`)}
            </Typography>
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                {t('biometricPuzzle.handComingSoon')}
            </Alert>
            <Stack spacing={2} alignItems="center">
                <CircularProgress size={32} />
                <Typography variant="caption" color="text.secondary">
                    {t('biometricPuzzle.simulatingDetection')}
                </Typography>
                <Button onClick={() => onSuccess()} size="small">
                    {t('biometricPuzzle.skipDemo')}
                </Button>
            </Stack>
        </Box>
    )
}

/**
 * Build a `ComponentType<BiometricPuzzleProps>` with `i18nKey` pre-bound
 * so the registry can hold one component per hand-puzzle entry without
 * each card needing extra props at the callsite.
 */
export function makeHandGesturePlaceholder(i18nKey: string) {
    const Bound: React.FC<BiometricPuzzleProps> = (p) => (
        <HandGesturePlaceholderPuzzle {...p} i18nKey={i18nKey} />
    )
    Bound.displayName = `HandGesturePlaceholder(${i18nKey})`
    return Bound
}

export default HandGesturePlaceholderPuzzle
