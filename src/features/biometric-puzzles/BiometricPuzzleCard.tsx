/**
 * BiometricPuzzleCard — tile on the Biometric Puzzles page.
 *
 * Structurally identical to `AuthMethodCard` (same visual language) but
 * bound to the biometric-puzzles entry shape so the two surfaces stay
 * separate — no accidental reuse of auth-method-only registry fields.
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
import BiometricPuzzleTaskbar from './BiometricPuzzleTaskbar'
import type {
    BiometricPuzzleDifficulty,
    BiometricPuzzleEntry,
} from './biometricPuzzleRegistry'

const DIFFICULTY_COLOR: Record<
    BiometricPuzzleDifficulty,
    'success' | 'warning' | 'error'
> = {
    beginner: 'success',
    intermediate: 'warning',
    advanced: 'error',
}

export interface BiometricPuzzleCardProps {
    puzzle: BiometricPuzzleEntry
    onLaunch: (puzzle: BiometricPuzzleEntry) => void
}

export default function BiometricPuzzleCard({
    puzzle,
    onLaunch,
}: BiometricPuzzleCardProps) {
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
                            background:
                                'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
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
                            {puzzle.capability === 'stubbedOnly' && (
                                <Chip
                                    label={t('biometricPuzzle.stubbedOnly')}
                                    size="small"
                                    variant="outlined"
                                    sx={{ borderRadius: '6px', fontSize: '0.68rem', height: 20 }}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                    {description}
                </Typography>

                <BiometricPuzzleTaskbar platforms={puzzle.platforms} />

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
