/**
 * BiometricPuzzlesPage
 *
 * Admin playground for every biometric challenge. Renders a responsive grid
 * of `PuzzleCard`s driven by PUZZLE_REGISTRY; launching a card opens the
 * shared `PuzzleRunnerModal` with stubbed dependencies.
 *
 * Future work (intentionally out of scope of this PR):
 *   - Difficulty + platform filters
 *   - "Try this puzzle" deep-link from the AuthFlow editor
 *   - Shared package so the landing-website can embed the same grid
 */
import { useCallback, useMemo, useState } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import PuzzleCard from '@features/biometric-puzzles/PuzzleCard'
import PuzzleRunnerModal from '@features/biometric-puzzles/PuzzleRunnerModal'
import { listPuzzles, type Puzzle } from '@features/biometric-puzzles/puzzleRegistry'

export default function BiometricPuzzlesPage() {
    const { t } = useTranslation()
    const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null)

    const puzzles = useMemo(() => listPuzzles(), [])

    const handleLaunch = useCallback((puzzle: Puzzle) => {
        setActivePuzzle(puzzle)
    }, [])

    const handleClose = useCallback(() => {
        setActivePuzzle(null)
    }, [])

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '100%',
                px: { xs: 2, sm: 0 },
                boxSizing: 'border-box',
            }}
        >
            <Typography
                variant="h5"
                fontWeight={700}
                sx={{ mb: 0.5, wordBreak: 'break-word' }}
            >
                {t('biometricPuzzle.pageTitle')}
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, wordBreak: 'break-word' }}
            >
                {t('biometricPuzzle.pageSubtitle')}
            </Typography>

            {/* TODO: difficulty + platform filters (post-MVP). */}

            <Grid container spacing={2}>
                {puzzles.map((puzzle) => (
                    <Grid key={puzzle.id} item xs={12} sm={6} md={4} lg={3}>
                        <PuzzleCard puzzle={puzzle} onLaunch={handleLaunch} />
                    </Grid>
                ))}
            </Grid>

            <PuzzleRunnerModal
                puzzle={activePuzzle}
                open={activePuzzle !== null}
                onClose={handleClose}
            />
        </Box>
    )
}
