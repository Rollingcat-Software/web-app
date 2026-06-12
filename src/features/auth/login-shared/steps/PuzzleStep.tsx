/**
 * PuzzleStep — PUZZLE auth-method MFA step (Phase 3, 2026-06-12)
 *
 * Drives a sequential challenge session from a tenant-configured PuzzleConfig.
 * Runs challenges one by one using the biometric puzzle registry. When all
 * challenges pass, immediately calls verifyStep(PUZZLE, { puzzle_traces }).
 *
 * Mode is always 'auth' — the 404-soft-pass is disabled here so a missing
 * proxy cannot be exploited to bypass liveness (3.2 fail-closed contract).
 *
 * alsoMatchFaceIdentity (Phase 5) is intentionally not wired in this phase —
 * liveness-only for now.
 */
import { useCallback, useRef, useState } from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import { Replay } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { AuthMethodType } from '@features/auth/constants'
import {
    getBiometricPuzzle,
} from '@features/biometric-puzzles/biometricPuzzleRegistry'
import { BiometricPuzzleId } from '@features/biometric-puzzles/BiometricPuzzleId'
import type { PuzzleConfig } from '@domain/models/AuthMethod'
import StepLayout from '../../components/steps/StepLayout'

/** Resolve a string to BiometricPuzzleId when it is a valid member. */
function toValidPuzzleId(value: string): BiometricPuzzleId | null {
    return Object.values(BiometricPuzzleId).includes(value as BiometricPuzzleId)
        ? (value as BiometricPuzzleId)
        : null
}

export interface PuzzleStepProps {
    puzzleConfig: PuzzleConfig | undefined
    verifyStep: (methodType: string, data: Record<string, unknown>) => void
    loading: boolean
    error?: string
}

interface PuzzleTrace {
    challengeId: BiometricPuzzleId
    completedAt: number
}

export default function PuzzleStep({
    puzzleConfig,
    verifyStep,
    loading,
    error,
}: PuzzleStepProps) {
    const { t } = useTranslation()

    // Resolve the ordered challenge list from config on first render.
    const challengeIds = useRef<BiometricPuzzleId[]>(
        (() => {
            if (!puzzleConfig) return []
            const valid = puzzleConfig.allowedChallengeTypes
                .map(toValidPuzzleId)
                .filter((id): id is BiometricPuzzleId => id !== null && !!getBiometricPuzzle(id))
            const count = Math.min(puzzleConfig.count, valid.length)
            return valid.slice(0, count)
        })(),
    )

    const [currentIndex, setCurrentIndex] = useState(0)
    const [traces, setTraces] = useState<PuzzleTrace[]>([])
    const [challengeError, setChallengeError] = useState<string | null>(null)
    const [completing, setCompleting] = useState(false)

    const ids = challengeIds.current
    const total = ids.length
    const currentId = ids[currentIndex] ?? null

    const handleSuccess = useCallback(() => {
        setChallengeError(null)
        const trace: PuzzleTrace = { challengeId: currentId!, completedAt: Date.now() }
        const nextTraces = [...traces, trace]
        const nextIndex = currentIndex + 1

        if (nextIndex >= total) {
            // All challenges done — submit immediately.
            setCompleting(true)
            setTraces(nextTraces)
            verifyStep(AuthMethodType.PUZZLE, {
                puzzle_traces: nextTraces.map((tr) => ({
                    challengeId: tr.challengeId,
                    completedAt: tr.completedAt,
                })),
            })
        } else {
            setTraces(nextTraces)
            setCurrentIndex(nextIndex)
        }
    }, [currentId, currentIndex, total, traces, verifyStep])

    const handleError = useCallback((message: string) => {
        setChallengeError(message)
    }, [])

    const handleClose = useCallback(() => {
        // No-op: cannot close mid-auth.
    }, [])

    const handleRetry = useCallback(() => {
        setChallengeError(null)
    }, [])

    // No challenges configured.
    if (total === 0) {
        return (
            <StepLayout
                title={t('mfa.puzzle.title')}
                subtitle={t('mfa.puzzle.subtitle')}
            >
                <Alert severity="warning" sx={{ borderRadius: '12px', mt: 1 }}>
                    {t('mfa.puzzle.noChallenges')}
                </Alert>
            </StepLayout>
        )
    }

    const entry = currentId ? getBiometricPuzzle(currentId) : null
    const ChallengeComponent = entry?.component ?? null

    const aggregatedError = error ?? challengeError

    return (
        <StepLayout
            title={t('mfa.puzzle.title')}
            subtitle={t('mfa.puzzle.subtitle')}
            error={aggregatedError ?? undefined}
        >
            {/* Progress indicator */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    {t('mfa.puzzle.challengeProgress', {
                        current: currentIndex + 1,
                        total,
                    })}
                </Typography>
            </Box>

            {/* Active challenge component */}
            {ChallengeComponent && !completing && (
                <ChallengeComponent
                    onSuccess={handleSuccess}
                    onError={handleError}
                    onClose={handleClose}
                />
            )}

            {/* Completing state */}
            {completing && (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('mfa.puzzle.completing')}
                    </Typography>
                </Box>
            )}

            {/* Retry on challenge error */}
            {challengeError && !completing && (
                <Box sx={{ mt: 2 }}>
                    <Button
                        variant="outlined"
                        fullWidth
                        size="large"
                        startIcon={<Replay />}
                        onClick={handleRetry}
                        disabled={loading}
                        sx={{ py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                    >
                        {t('mfa.puzzle.retry')}
                    </Button>
                </Box>
            )}
        </StepLayout>
    )
}
