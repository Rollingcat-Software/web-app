import {
    Alert,
    Box,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
    Tooltip,
    Typography,
    type SelectChangeEvent,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { PuzzleConfig } from '@domain/models/AuthMethod'
import {
    listBiometricPuzzlesByModality,
    listBiometricPuzzles,
} from '@features/biometric-puzzles/biometricPuzzleRegistry'
import { isRenderablePuzzleId } from '@features/biometric-puzzles/puzzleServerAction'

interface PuzzleLayerConfigProps {
    value: PuzzleConfig
    onChange: (updated: PuzzleConfig) => void
}

/**
 * Only RENDERABLE challenge types are offered in the builder — those a
 * server-issued action can map back to a web component (`serverActionToPuzzleId`)
 * AND can actually satisfy. This drops:
 *   - `HAND_TRACE_TEMPLATE` (client-only, no server action);
 *   - `HAND_SHAPE_TRACE` (free-form trace produces no `dtw_cost`, so its
 *     metric-REQUIRED auth path is unsatisfiable — unmapped 2026-06-12);
 *   - the component-less `light` / `hold_position` actions.
 * so an admin can't configure a flow that issues a challenge the web cannot
 * render or satisfy. (The PUZZLE step also fails closed at runtime; this
 * prevents the misconfig up front.)
 */
const ALL_PUZZLES = listBiometricPuzzles().filter((p) => isRenderablePuzzleId(p.id))
const FACE_PUZZLES = listBiometricPuzzlesByModality('face').filter((p) =>
    isRenderablePuzzleId(p.id),
)
const HAND_PUZZLES = listBiometricPuzzlesByModality('hand').filter((p) =>
    isRenderablePuzzleId(p.id),
)

export function PuzzleLayerConfig({ value, onChange }: PuzzleLayerConfigProps) {
    const { t } = useTranslation()

    const toggleChallengeType = (id: string) => {
        const next = value.allowedChallengeTypes.includes(id)
            ? value.allowedChallengeTypes.filter((c) => c !== id)
            : [...value.allowedChallengeTypes, id]
        onChange({ ...value, allowedChallengeTypes: next })
    }

    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value, 10)
        if (!isNaN(parsed) && parsed >= 1) {
            onChange({ ...value, count: parsed })
        }
    }

    const handleDifficultyChange = (e: SelectChangeEvent<string>) => {
        const difficulty = e.target.value as PuzzleConfig['difficulty']
        if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
            onChange({ ...value, difficulty })
        }
    }

    const handleIdentityBindingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...value, alsoMatchFaceIdentity: e.target.checked })
    }

    return (
        <Box sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('biometricPuzzle.builder.layerLabel')}
            </Typography>

            {/* Challenge type checkboxes — face then hand */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {t('biometricPuzzle.builder.challengeTypesLabel')}
            </Typography>

            <Box sx={{ mb: 2 }}>
                {/* Face challenges */}
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    {t('biometricPuzzle.modality.face')}
                </Typography>
                <FormGroup>
                    <Grid container spacing={0}>
                        {FACE_PUZZLES.map((puzzle) => (
                            <Grid item xs={12} sm={6} md={4} key={puzzle.id}>
                                <FormControlLabel
                                    sx={{ m: 0, width: '100%' }}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={value.allowedChallengeTypes.includes(puzzle.id)}
                                            onChange={() => toggleChallengeType(puzzle.id)}
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" noWrap>
                                            {t(`${puzzle.i18nKey}.title`)}
                                        </Typography>
                                    }
                                />
                            </Grid>
                        ))}
                    </Grid>
                </FormGroup>

                {/* Hand challenges */}
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mt: 1, mb: 0.5, display: 'block' }}>
                    {t('biometricPuzzle.modality.hand')}
                </Typography>
                <FormGroup>
                    <Grid container spacing={0}>
                        {HAND_PUZZLES.map((puzzle) => (
                            <Grid item xs={12} sm={6} md={4} key={puzzle.id}>
                                <FormControlLabel
                                    sx={{ m: 0, width: '100%' }}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={value.allowedChallengeTypes.includes(puzzle.id)}
                                            onChange={() => toggleChallengeType(puzzle.id)}
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" noWrap>
                                            {t(`${puzzle.i18nKey}.title`)}
                                        </Typography>
                                    }
                                />
                            </Grid>
                        ))}
                    </Grid>
                </FormGroup>
            </Box>

            {/* Count + Difficulty in a row */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={5}>
                    <TextField
                        fullWidth
                        type="number"
                        label={t('biometricPuzzle.builder.countLabel')}
                        value={value.count}
                        onChange={handleCountChange}
                        inputProps={{ min: 1, max: ALL_PUZZLES.length }}
                        size="small"
                    />
                </Grid>
                <Grid item xs={12} sm={7}>
                    <FormControl fullWidth size="small">
                        <InputLabel>{t('biometricPuzzle.builder.difficultyLabel')}</InputLabel>
                        <Select
                            value={value.difficulty}
                            label={t('biometricPuzzle.builder.difficultyLabel')}
                            onChange={handleDifficultyChange}
                        >
                            <MenuItem value="easy">{t('biometricPuzzle.builder.difficultyEasy')}</MenuItem>
                            <MenuItem value="medium">{t('biometricPuzzle.builder.difficultyMedium')}</MenuItem>
                            <MenuItem value="hard">{t('biometricPuzzle.builder.difficultyHard')}</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {/* Identity-binding toggle */}
            <Tooltip title={t('biometricPuzzle.builder.identityBindingHint')}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={value.alsoMatchFaceIdentity}
                            onChange={handleIdentityBindingChange}
                            color="primary"
                            size="small"
                        />
                    }
                    label={
                        <Typography variant="body2">
                            {t('biometricPuzzle.builder.identityBinding')}
                        </Typography>
                    }
                />
            </Tooltip>

            {/* Lower-assurance warning when identity binding is OFF */}
            {!value.alsoMatchFaceIdentity && (
                <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
                    {t('biometricPuzzle.builder.lowerAssuranceWarning')}
                </Alert>
            )}
        </Box>
    )
}
