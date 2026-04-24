/**
 * HandGesturePlaceholderPuzzle — pre-ship placeholder for the 9 hand puzzles.
 *
 * The landmarks-only MediaPipe HandLandmarker detector lives on the
 * `feat/gesture-phase2-web` branch (PR #31). Until that merges, clicking a
 * hand puzzle on the playground shows this card: explains what the challenge
 * will be and simulates success after a short delay so the flow still
 * demos end-to-end.
 */
import React, { useEffect, useRef } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { PanTool } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { PuzzleProps } from '../puzzleRegistry'

interface Props extends PuzzleProps {
    i18nKey: string
}

/**
 * Build a `ComponentType<PuzzleProps>` with `i18nKey` pre-bound so it can
 * live directly inside `PUZZLE_REGISTRY` without each card needing extra
 * props at the callsite. Each of the 9 hand puzzles uses its own bound
 * variant so the placeholder renders with the correct copy.
 */
export function makeHandGesturePlaceholder(i18nKey: string) {
    const Bound: React.FC<PuzzleProps> = (p) => (
        <HandGesturePlaceholderPuzzle {...p} i18nKey={i18nKey} />
    )
    Bound.displayName = `HandGesturePlaceholder(${i18nKey})`
    return Bound
}

function HandGesturePlaceholderPuzzle({ onSuccess, i18nKey }: Props) {
    const { t } = useTranslation()
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        timerRef.current = window.setTimeout(() => {
            onSuccess()
        }, 2000)
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

export default HandGesturePlaceholderPuzzle
