/**
 * BiometricPuzzlesPage
 *
 * Lists the 23 real biometric micro-challenges (14 face + 9 hand) the
 * active-liveness engine supports. Face cards use the REAL biometric
 * engine through the app-wide `DependencyProvider` — no stub DI — so
 * BlazeFace + MediaPipe + ONNX all load the same way they do on
 * `/login`. Only the upstream HTTP verification call is mocked inside
 * each puzzle wrapper.
 *
 * This is a separate surface from `/auth-methods-testing`, which is
 * the 9-auth-method showcase (email OTP, SMS, TOTP, QR, Face, Voice,
 * Fingerprint, NFC, Hardware Key). Biometric puzzles and auth methods
 * are different concepts — see `biometricPuzzleRegistry.ts`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import PuzzleCard from '@features/biometric-puzzles/BiometricPuzzleCard'
import PuzzleRunnerModal from '@features/biometric-puzzles/BiometricPuzzleRunnerModal'
import {
    listBiometricPuzzles,
    type BiometricPuzzleEntry,
} from '@features/biometric-puzzles/biometricPuzzleRegistry'

export default function BiometricPuzzlesPage() {
    const { t } = useTranslation()
    const [active, setActive] = useState<BiometricPuzzleEntry | null>(null)

    const all = useMemo(() => listBiometricPuzzles(), [])
    const facePuzzles = useMemo(
        () => all.filter((p) => p.modality === 'face'),
        [all],
    )
    const handPuzzles = useMemo(
        () => all.filter((p) => p.modality === 'hand'),
        [all],
    )

    const handleLaunch = useCallback((p: BiometricPuzzleEntry) => setActive(p), [])
    const handleClose = useCallback(() => setActive(null), [])

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '100%',
                px: { xs: 2, sm: 0 },
                boxSizing: 'border-box',
            }}
        >
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
                {t('biometricPuzzle.pageTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('biometricPuzzle.pageSubtitle')}
            </Typography>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
                {t('biometricPuzzle.sectionFace')}
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {facePuzzles.map((p) => (
                    <Grid key={p.id} item xs={12} sm={6} md={4} lg={3}>
                        <PuzzleCard puzzle={p} onLaunch={handleLaunch} />
                    </Grid>
                ))}
            </Grid>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
                {t('biometricPuzzle.sectionHand')}
            </Typography>
            <Grid container spacing={2}>
                {handPuzzles.map((p) => (
                    <Grid key={p.id} item xs={12} sm={6} md={4} lg={3}>
                        <PuzzleCard puzzle={p} onLaunch={handleLaunch} />
                    </Grid>
                ))}
            </Grid>

            {active && (
                <PuzzleRunnerModal
                    open={active !== null}
                    puzzle={active}
                    onClose={handleClose}
                />
            )}
        </Box>
    )
}
