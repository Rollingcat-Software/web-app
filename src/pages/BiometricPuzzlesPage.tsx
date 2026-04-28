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
 *
 * Visual design (2026-04-28 polish): gradient hero, motion-staggered
 * card grid, glass section headers with accent bar + count badges.
 * Matches the language of `LoginPage` (purple/indigo gradient,
 * framer-motion entry, MUI Card system) so the surface feels like
 * part of the same product family.
 */
import { useCallback, useMemo, useState } from 'react'
import { Box, Chip, Grid, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { motion, type Variants } from 'framer-motion'
import { Face as FaceIcon, BackHand as HandIcon, AutoAwesome } from '@mui/icons-material'
import PuzzleCard from '@features/biometric-puzzles/BiometricPuzzleCard'
import PuzzleRunnerModal from '@features/biometric-puzzles/BiometricPuzzleRunnerModal'
import {
    listBiometricPuzzles,
    type BiometricPuzzleEntry,
    type BiometricPuzzleModality,
} from '@features/biometric-puzzles/biometricPuzzleRegistry'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const heroVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: easeOut },
    },
}

const sectionVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.04, delayChildren: 0.1 },
    },
}

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: easeOut },
    },
}

interface SectionHeaderProps {
    icon: React.ReactNode
    title: string
    subtitle: string
    count: number
    accent: string
}

function SectionHeader({ icon, title, subtitle, count, accent }: SectionHeaderProps) {
    return (
        <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
                mb: 2,
                p: 2,
                borderRadius: '14px',
                background:
                    'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)',
                border: '1px solid',
                borderColor: 'divider',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: accent,
                },
            }}
        >
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    background: accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    <Chip
                        label={count}
                        size="small"
                        sx={{
                            height: 20,
                            fontWeight: 700,
                            background: accent,
                            color: 'white',
                            fontSize: '0.7rem',
                        }}
                    />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    {subtitle}
                </Typography>
            </Box>
        </Stack>
    )
}

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

    const handleLaunch = useCallback(
        (p: BiometricPuzzleEntry) => setActive(p),
        [],
    )
    const handleClose = useCallback(() => setActive(null), [])

    const renderSection = (
        modality: BiometricPuzzleModality,
        puzzles: BiometricPuzzleEntry[],
    ) => (
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
            <SectionHeader
                icon={modality === 'face' ? <FaceIcon /> : <HandIcon />}
                title={t(
                    modality === 'face'
                        ? 'biometricPuzzle.sectionFace'
                        : 'biometricPuzzle.sectionHand',
                )}
                subtitle={t(
                    modality === 'face'
                        ? 'biometricPuzzle.sectionFaceSubtitle'
                        : 'biometricPuzzle.sectionHandSubtitle',
                )}
                count={puzzles.length}
                accent={
                    modality === 'face'
                        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)'
                }
            />
            <Grid container spacing={2}>
                {puzzles.map((p) => (
                    <Grid key={p.id} item xs={12} sm={6} md={4} lg={3}>
                        <motion.div variants={cardVariants} style={{ height: '100%' }}>
                            <PuzzleCard puzzle={p} onLaunch={handleLaunch} />
                        </motion.div>
                    </Grid>
                ))}
            </Grid>
        </motion.div>
    )

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '100%',
                px: { xs: 2, sm: 0 },
                boxSizing: 'border-box',
            }}
        >
            <motion.div variants={heroVariants} initial="hidden" animate="visible">
                <Box
                    sx={{
                        mb: 4,
                        p: { xs: 3, sm: 4 },
                        borderRadius: '20px',
                        background:
                            'linear-gradient(135deg, rgba(99, 102, 241, 0.10) 0%, rgba(139, 92, 246, 0.08) 50%, rgba(236, 72, 153, 0.06) 100%)',
                        border: '1px solid',
                        borderColor: 'divider',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -40,
                            right: -40,
                            width: 200,
                            height: 200,
                            borderRadius: '50%',
                            background:
                                'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
                            pointerEvents: 'none',
                        }}
                    />
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <AutoAwesome sx={{ color: '#8b5cf6', fontSize: 20 }} />
                        <Typography
                            variant="overline"
                            sx={{
                                fontWeight: 700,
                                letterSpacing: 1.5,
                                color: 'text.secondary',
                            }}
                        >
                            {t('biometricPuzzle.heroEyebrow')}
                        </Typography>
                    </Stack>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 800,
                            mb: 1,
                            background:
                                'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            wordBreak: 'break-word',
                        }}
                    >
                        {t('biometricPuzzle.pageTitle')}
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ maxWidth: 720, lineHeight: 1.6 }}
                    >
                        {t('biometricPuzzle.pageSubtitle')}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                        <Chip
                            icon={<FaceIcon />}
                            label={t('biometricPuzzle.heroChipFace', { count: facePuzzles.length })}
                            sx={{ borderRadius: '8px', fontWeight: 600 }}
                        />
                        <Chip
                            icon={<HandIcon />}
                            label={t('biometricPuzzle.heroChipHand', { count: handPuzzles.length })}
                            sx={{ borderRadius: '8px', fontWeight: 600 }}
                        />
                        <Chip
                            label={t('biometricPuzzle.heroChipReal')}
                            color="success"
                            variant="outlined"
                            sx={{ borderRadius: '8px', fontWeight: 600 }}
                        />
                    </Stack>
                </Box>
            </motion.div>

            <Box sx={{ mb: 5 }}>{renderSection('face', facePuzzles)}</Box>
            <Box>{renderSection('hand', handPuzzles)}</Box>

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
