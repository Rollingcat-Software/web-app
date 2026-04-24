/**
 * PuzzleCard — a single puzzle tile on the BiometricPuzzlesPage.
 *
 * Visual language borrowed from MethodPickerStep so the playground feels like
 * a natural extension of the real MFA surface: 44px avatar with gradient,
 * subtitle description, secondary meta row.
 */
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Typography,
} from '@mui/material'
import { PlayArrow } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import PuzzleTaskbar from './PuzzleTaskbar'
import type { Puzzle, PuzzleDifficulty } from './puzzleRegistry'

const DIFFICULTY_COLOR: Record<PuzzleDifficulty, 'success' | 'warning' | 'error'> = {
    beginner: 'success',
    intermediate: 'warning',
    advanced: 'error',
}

export interface PuzzleCardProps {
    puzzle: Puzzle
    onLaunch: (puzzle: Puzzle) => void
}

export default function PuzzleCard({ puzzle, onLaunch }: PuzzleCardProps) {
    const { t } = useTranslation()
    const Icon = puzzle.icon

    const title = t(`${puzzle.i18nKey}.title`)
    const description = t(`${puzzle.i18nKey}.description`)
    const difficultyLabel = t(`biometricPuzzle.difficulty.${puzzle.difficulty}`)

    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: '14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.12)',
                    transform: 'translateY(-2px)',
                },
            }}
        >
            <CardContent
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    p: 2.5,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar
                        sx={{
                            width: 44,
                            height: 44,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ color: 'white' }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700, lineHeight: 1.25 }}
                        >
                            {title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                                label={difficultyLabel}
                                size="small"
                                color={DIFFICULTY_COLOR[puzzle.difficulty]}
                                variant="outlined"
                                sx={{ borderRadius: '6px', fontSize: '0.68rem', height: 20 }}
                            />
                            {puzzle.requiresEnrollment && (
                                <Chip
                                    label={t('biometricPuzzle.requiresEnrollment')}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        height: 20,
                                    }}
                                />
                            )}
                            {puzzle.capability === 'stubbedOnly' && (
                                <Chip
                                    label={t('biometricPuzzle.stubbedOnly')}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        height: 20,
                                    }}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flex: 1 }}
                >
                    {description}
                </Typography>

                <PuzzleTaskbar platforms={puzzle.platforms} />

                <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    startIcon={<PlayArrow />}
                    onClick={() => onLaunch(puzzle)}
                    sx={{
                        mt: 1,
                        py: 1,
                        textTransform: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                    }}
                >
                    {t('biometricPuzzle.tryButton')}
                </Button>
            </CardContent>
        </Card>
    )
}
