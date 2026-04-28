/**
 * BiometricPuzzleCard — tile on the Biometric Puzzles page.
 *
 * Visual language matches LoginPage: glass background, gradient avatar,
 * subtle hover lift, framer-motion-friendly. Modality drives the accent
 * color so face and hand cards are scannable at a glance.
 */
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Stack,
    Typography,
} from '@mui/material'
import { PlayArrow, AutoAwesome } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import BiometricPuzzleTaskbar from './BiometricPuzzleTaskbar'
import type {
    BiometricPuzzleDifficulty,
    BiometricPuzzleEntry,
    BiometricPuzzleModality,
} from './biometricPuzzleRegistry'

const DIFFICULTY_COLOR: Record<
    BiometricPuzzleDifficulty,
    'success' | 'warning' | 'error'
> = {
    beginner: 'success',
    intermediate: 'warning',
    advanced: 'error',
}

const MODALITY_GRADIENT: Record<BiometricPuzzleModality, string> = {
    face: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    hand: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
}

const MODALITY_GLOW: Record<BiometricPuzzleModality, string> = {
    face: '0 8px 24px rgba(99, 102, 241, 0.18)',
    hand: '0 8px 24px rgba(236, 72, 153, 0.18)',
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
    const modalityLabel = t(`biometricPuzzle.modality.${puzzle.modality}`)
    const gradient = MODALITY_GRADIENT[puzzle.modality]
    const glow = MODALITY_GLOW[puzzle.modality]

    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: '16px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                background:
                    'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)',
                backdropFilter: 'blur(8px)',
                '&:hover': {
                    borderColor: 'transparent',
                    boxShadow: glow,
                    transform: 'translateY(-3px)',
                },
                '&:hover .puzzleAccentBar': {
                    opacity: 1,
                },
            }}
        >
            <Box
                className="puzzleAccentBar"
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: gradient,
                    opacity: 0.6,
                    transition: 'opacity 0.25s ease',
                }}
            />
            <CardContent
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    p: 2.5,
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar
                        sx={{
                            width: 48,
                            height: 48,
                            background: gradient,
                            flexShrink: 0,
                            boxShadow: glow,
                        }}
                    >
                        <Icon sx={{ color: 'white', fontSize: 26 }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 700,
                                lineHeight: 1.25,
                                wordBreak: 'break-word',
                            }}
                        >
                            {title}
                        </Typography>
                        <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}
                        >
                            <Chip
                                label={modalityLabel}
                                size="small"
                                sx={{
                                    borderRadius: '6px',
                                    fontSize: '0.68rem',
                                    height: 20,
                                    fontWeight: 600,
                                    background: gradient,
                                    color: 'white',
                                }}
                            />
                            <Chip
                                label={difficultyLabel}
                                size="small"
                                color={DIFFICULTY_COLOR[puzzle.difficulty]}
                                variant="outlined"
                                sx={{ borderRadius: '6px', fontSize: '0.68rem', height: 20 }}
                            />
                            {puzzle.capability === 'realCapable' && (
                                <Chip
                                    icon={<AutoAwesome sx={{ fontSize: '0.8rem !important' }} />}
                                    label={t('biometricPuzzle.realDetectorBadge')}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        height: 20,
                                        '& .MuiChip-icon': { ml: '4px' },
                                    }}
                                />
                            )}
                            {puzzle.capability === 'stubbedOnly' && (
                                <Chip
                                    label={t('biometricPuzzle.stubbedOnly')}
                                    size="small"
                                    variant="outlined"
                                    sx={{ borderRadius: '6px', fontSize: '0.68rem', height: 20 }}
                                />
                            )}
                        </Stack>
                    </Box>
                </Stack>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flex: 1, lineHeight: 1.5 }}
                >
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
                        background: gradient,
                        boxShadow: 'none',
                        '&:hover': {
                            background: gradient,
                            filter: 'brightness(1.1)',
                            boxShadow: glow,
                        },
                    }}
                >
                    {t('biometricPuzzle.tryButton')}
                </Button>
            </CardContent>
        </Card>
    )
}
