/**
 * Authors-only trial page (Paper B, BPCER/APCER): `/author-trial`.
 *
 * Public route (no dashboard login). One screen, visual-first:
 *   access-code gate -> participant (pseudonymous code) -> device profile ->
 *   genuine/attack mode -> instrument -> Start/Stop -> live attempt ring,
 *   statistics and feed -> server export.
 *
 * Every attempt drives the REAL shared PUZZLE step through `MfaStepRenderer`;
 * the verdict comes from `AuthRepository.verifyMfaStep` (the public
 * `/auth/mfa/step` endpoint). No verdict is ever fabricated client-side, and
 * the finish call carries technical metadata only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    ArrowForward,
    CameraAlt,
    Cancel,
    CheckCircle,
    Download,
    ErrorOutline,
    Fingerprint,
    GppBad,
    Insights,
    Lock,
    Monitor,
    Person,
    PlayArrow,
    Save,
    Science,
    Smartphone,
    Speed,
    Stop,
    VerifiedUser,
    Videocam,
    WarningAmber,
} from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthorTrialRepository } from '@domain/interfaces/IAuthorTrialRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type {
    AuthorTrialDeviceSnapshot,
    AuthorTrialExportFormat,
    AuthorTrialInstrumentPreset,
    AuthorTrialMode,
} from '@domain/models/AuthorTrial'
import { AuthMethodType } from '@domain/models/AuthMethod'
import MfaStepRenderer from '@features/auth/login-shared/MfaStepRenderer'
import EnrollDialog from '@features/author-trial/EnrollDialog'
import { probeTrialEnvironment } from '@features/author-trial/cameraProbe'
import {
    EMPTY_DEVICE_SNAPSHOT,
    INSTRUMENT_PRESETS,
    MAX_DEVICE_LABEL_CHARS,
    MAX_INSTRUMENT_CHARS,
    challengeEmoji,
    composeDeviceSummary,
    loadDeviceProfiles,
    localTimeOfDay,
    mergeDeviceSnapshots,
    readStoredAccessCode,
    resolveAttemptTimeoutMs,
    roundPositionLabel,
    sanitizeText,
    saveDeviceProfile,
    storeAccessCode,
    type DeviceProfile,
} from '@features/author-trial/protocol'
import {
    useAuthorTrial,
    type TrialFeedEntry,
    type TrialRunConfig,
} from '@features/author-trial/useAuthorTrial'
import { formatApiError } from '@utils/formatApiError'

const HERO_SX = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    p: { xs: 2.5, md: 4 },
    color: '#f8fafc',
    background: 'linear-gradient(135deg, #1e1b4b 0%, #0e7490 55%, #065f46 100%)',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
} as const

const BIG_BUTTON_SX = {
    minHeight: 72,
    fontSize: '1.25rem',
    fontWeight: 800,
    borderRadius: 3,
} as const

const FIELD_GRID_SX = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
    gap: 1.5,
} as const

const MODE_COLOR: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
    accepted: 'success',
    rejected: 'error',
    error: 'warning',
    abandoned: 'default',
    session_error: 'warning',
}

function reasonText(t: TFunction, reason: string | undefined): string {
    if (!reason) return ''
    const key = `authorTrial.reason.${reason}`
    const translated = t(key)
    return translated === key ? reason : translated
}

function deviceFromForm(
    form: Pick<AuthorTrialDeviceSnapshot, 'label' | 'os' | 'browser' | 'screen' | 'cameraLabel' | 'cameraResolution'>,
    detected: AuthorTrialDeviceSnapshot | null,
): AuthorTrialDeviceSnapshot {
    return mergeDeviceSnapshots(detected ?? EMPTY_DEVICE_SNAPSHOT, form)
}

function StatTile({
    icon,
    label,
    value,
    tone,
    hint,
}: {
    icon: React.ReactNode
    label: string
    value: string
    tone: string
    hint?: string
}) {
    const tile = (
        <Box
            sx={{
                borderRadius: 3,
                p: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                minHeight: 96,
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: tone }}>
                {icon}
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                    {label}
                </Typography>
            </Stack>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </Typography>
        </Box>
    )
    return hint ? <Tooltip title={hint}>{tile}</Tooltip> : tile
}

function FeedRow({ entry }: { entry: TrialFeedEntry }) {
    const { t } = useTranslation()
    const color = MODE_COLOR[entry.outcome] ?? 'default'
    const isAttack = entry.mode === 'attack'
    return (
        <Box
            data-testid="attempt-feed-entry"
            sx={{
                p: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: isAttack ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box component="span" sx={{ fontSize: '1.35rem' }} aria-hidden="true">
                        {isAttack ? '🎭' : '😀'}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                        {entry.participantCode} → {entry.targetCode}
                    </Typography>
                    {entry.round != null && entry.position != null && (
                        <Chip
                            size="small"
                            label={roundPositionLabel(entry.round, entry.position, entry.count)}
                            sx={{ fontFamily: 'monospace' }}
                        />
                    )}
                </Stack>
                <Chip size="small" color={color} label={t(`authorTrial.outcome.${entry.outcome}`)} />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
                {entry.challenge && (
                    <Chip
                        size="small"
                        variant="outlined"
                        icon={<span aria-hidden="true">{challengeEmoji(entry.challenge)}</span>}
                        label={entry.challenge}
                    />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {localTimeOfDay(new Date(entry.at))}
                </Typography>
                {entry.latencyMs != null && (
                    <Typography variant="caption" color="text.secondary">
                        {t('authorTrial.feedLatency', { ms: entry.latencyMs })}
                    </Typography>
                )}
                {entry.identityScore != null && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {t('authorTrial.feedIdentityScore', { score: entry.identityScore.toFixed(3) })}
                    </Typography>
                )}
                {entry.reason && (
                    <Typography variant="caption" color="text.secondary">
                        {reasonText(t, entry.reason)}
                    </Typography>
                )}
            </Stack>
        </Box>
    )
}

export default function AuthorTrialPage() {
    const { t } = useTranslation()
    const repository = useService<IAuthorTrialRepository>(TYPES.AuthorTrialRepository)
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const trial = useAuthorTrial()
    const { state } = trial

    const [codeInput, setCodeInput] = useState(() => readStoredAccessCode())
    const [accessCode, setAccessCode] = useState(() => readStoredAccessCode())
    const [gateError, setGateError] = useState<string | null>(null)
    const [detection, setDetection] = useState<'idle' | 'detecting' | 'done' | 'failed'>('idle')
    const [detected, setDetected] = useState<AuthorTrialDeviceSnapshot | null>(null)
    const [deviceForm, setDeviceForm] = useState({
        label: '',
        os: '',
        browser: '',
        screen: '',
        cameraLabel: '',
        cameraResolution: '',
    })
    const [profiles, setProfiles] = useState<DeviceProfile[]>([])
    const [profileName, setProfileName] = useState('__auto__')
    const [profileSaved, setProfileSaved] = useState(false)
    const [participantCode, setParticipantCode] = useState('')
    const [mode, setMode] = useState<AuthorTrialMode>('genuine')
    const [targetCode, setTargetCode] = useState('')
    const [instrumentPreset, setInstrumentPreset] = useState<AuthorTrialInstrumentPreset>('live_face_swap')
    const [instrumentName, setInstrumentName] = useState('')
    const [enrollOpen, setEnrollOpen] = useState(false)
    const [exporting, setExporting] = useState<AuthorTrialExportFormat | null>(null)
    const [exportError, setExportError] = useState<string | null>(null)
    const [clock, setClock] = useState(() => Date.now())
    const autoConnectRef = useRef(false)
    const detectionRef = useRef(false)

    const participant = state.participants.find((p) => p.code === participantCode) ?? null
    const targetOptions = useMemo(
        () => state.participants.filter((p) => p.code !== participantCode),
        [state.participants, participantCode],
    )
    const isRunning = state.phase !== 'idle'
    const canStart =
        state.connected &&
        !!participantCode &&
        detection !== 'detecting' &&
        !state.participantsLoading &&
        (mode === 'genuine' ||
            // The API rejects an attack attempt without an instrument name
            // (TRIAL_INSTRUMENT_REQUIRED); do not let Start enter that retry loop.
            (!!targetCode && targetCode !== participantCode && instrumentName.trim().length > 0))
    const device = deviceFromForm(deviceForm, detected)
    const deviceSummary = composeDeviceSummary(device)

    const handleConnect = useCallback(
        async (candidate: string) => {
            setGateError(null)
            const ok = await trial.connect(candidate)
            if (ok) {
                const code = sanitizeText(candidate, 200)
                setAccessCode(code)
                storeAccessCode(code)
                setCodeInput('')
            } else {
                setGateError(t('authorTrial.serverError'))
            }
        },
        [trial, t],
    )

    // Remember the access code for this tab only; reconnect silently on reload.
    useEffect(() => {
        if (autoConnectRef.current) return
        autoConnectRef.current = true
        const saved = readStoredAccessCode()
        if (saved) {
            setCodeInput(saved)
            void trial.connect(saved).then((ok) => {
                if (ok) setAccessCode(saved)
                else setGateError(t('authorTrial.serverError'))
            })
        }
        // run once; trial.connect is stable enough for this boot effect
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Auto-detect the device + camera once the code is accepted (the camera
    // permission prompt is justified by the trial itself). Best effort.
    useEffect(() => {
        if (!state.connected || detectionRef.current) return
        detectionRef.current = true
        setDetection('detecting')
        setProfiles(loadDeviceProfiles())
        void probeTrialEnvironment()
            .then((result) => {
                setDetected(result.device)
                setDeviceForm((prev) => ({
                    label: prev.label || result.device.label,
                    os: prev.os || result.device.os,
                    browser: prev.browser || result.device.browser,
                    screen: prev.screen || result.device.screen,
                    cameraLabel: prev.cameraLabel || result.device.cameraLabel,
                    cameraResolution: prev.cameraResolution || result.device.cameraResolution,
                }))
                setDetection('done')
            })
            .catch(() => setDetection('failed'))
    }, [state.connected])

    useEffect(() => {
        if (!participantCode && state.participants.length > 0) {
            setParticipantCode(state.participants[0].code)
        }
    }, [participantCode, state.participants])

    useEffect(() => {
        if (mode !== 'attack') return
        if (!targetCode || targetCode === participantCode) {
            setTargetCode(targetOptions[0]?.code ?? '')
        }
    }, [mode, participantCode, targetCode, targetOptions])

    useEffect(() => {
        if (!isRunning) return
        const timer = setInterval(() => setClock(Date.now()), 1_000)
        return () => clearInterval(timer)
    }, [isRunning])

    const perMinute = useMemo(() => {
        if (!state.runStartedAt || state.attempts === 0) return 0
        const elapsedMinutes = Math.max(1 / 60, (clock - state.runStartedAt) / 60_000)
        return state.attempts / elapsedMinutes
    }, [clock, state.attempts, state.runStartedAt])

    const applyProfile = useCallback(
        (name: string) => {
            setProfileName(name)
            setProfileSaved(false)
            if (name === '__auto__') {
                setDeviceForm((prev) => ({
                    label: detected?.label ?? prev.label,
                    os: detected?.os ?? prev.os,
                    browser: detected?.browser ?? prev.browser,
                    screen: detected?.screen ?? prev.screen,
                    cameraLabel: detected?.cameraLabel ?? prev.cameraLabel,
                    cameraResolution: detected?.cameraResolution ?? prev.cameraResolution,
                }))
                return
            }
            const profile = profiles.find((p) => p.name === name)
            if (!profile) return
            setDeviceForm({
                label: profile.device.label,
                os: profile.device.os,
                browser: profile.device.browser,
                screen: profile.device.screen,
                cameraLabel: profile.device.cameraLabel,
                cameraResolution: profile.device.cameraResolution,
            })
        },
        [detected, profiles],
    )

    const saveCurrentProfile = useCallback(() => {
        const name = sanitizeText(deviceForm.label || detected?.label || '', MAX_DEVICE_LABEL_CHARS)
        if (!name) return
        const next = saveDeviceProfile({
            name,
            device: {
                label: deviceForm.label,
                os: deviceForm.os,
                browser: deviceForm.browser,
                screen: deviceForm.screen,
                cameraLabel: deviceForm.cameraLabel,
                cameraResolution: deviceForm.cameraResolution,
            },
        })
        setProfiles(next)
        setProfileName(name)
        setProfileSaved(true)
    }, [detected?.label, deviceForm])

    const handleStart = useCallback(() => {
        if (!canStart) return
        const config: TrialRunConfig = {
            participantCode,
            mode,
            targetCode: mode === 'attack' ? targetCode : undefined,
            instrument: mode === 'attack' ? instrumentName : undefined,
            instrumentPreset: mode === 'attack' ? instrumentPreset : undefined,
            device: deviceFromForm(deviceForm, detected),
        }
        trial.start(config)
    }, [canStart, detected, deviceForm, instrumentName, instrumentPreset, mode, participantCode, targetCode, trial])

    const handleDownload = useCallback(
        async (format: AuthorTrialExportFormat) => {
            if (!accessCode) return
            setExporting(format)
            setExportError(null)
            try {
                const text = await repository.exportSessions(accessCode, format)
                const type = format === 'csv' ? 'text/csv' : 'application/json'
                const blob = new Blob([text], { type })
                const anchor = document.createElement('a')
                anchor.href = URL.createObjectURL(blob)
                anchor.download = `author_trial_sessions.${format}`
                anchor.click()
                URL.revokeObjectURL(anchor.href)
            } catch (error) {
                setExportError(formatApiError(error, t))
            } finally {
                setExporting(null)
            }
        },
        [accessCode, repository, t],
    )

    const flow = state.flow
    const deviceEdit = (field: keyof typeof deviceForm, maxChars: number) => ({
        value: deviceForm[field],
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            setProfileSaved(false)
            setDeviceForm((prev) => ({ ...prev, [field]: event.target.value.slice(0, maxChars) }))
        },
        inputProps: { maxLength: maxChars },
    })

    return (
        <Box
            component="main"
            sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', px: 2, py: 3 }}
        >
            <Stack spacing={2.5} sx={{ maxWidth: 1180, mx: 'auto' }}>
                <Box component="header" sx={HERO_SX}>
                    <Box
                        aria-hidden="true"
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            opacity: 0.18,
                            background:
                                'radial-gradient(circle at 15% 20%, #f0abfc 0, transparent 32%), radial-gradient(circle at 85% 15%, #67e8f9 0, transparent 30%), radial-gradient(circle at 70% 90%, #34d399 0, transparent 35%)',
                        }}
                    />
                    <Stack spacing={1.5} sx={{ position: 'relative' }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Box sx={{ fontSize: { xs: '2.2rem', md: '3rem' }, lineHeight: 1 }} aria-hidden="true">
                                🧪
                            </Box>
                            <Science sx={{ fontSize: { xs: 32, md: 44 } }} />
                            <Typography variant="h3" component="h1" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>
                                {t('authorTrial.heroTitle')}
                            </Typography>
                        </Stack>
                        <Typography sx={{ maxWidth: 820, fontSize: '1.05rem', color: 'rgba(248,250,252,0.9)' }}>
                            {t('authorTrial.heroSubtitle')}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                                size="small"
                                icon={<Science />}
                                label={t('authorTrial.badgePaper')}
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.12)' }}
                                variant="outlined"
                            />
                            <Chip
                                size="small"
                                icon={<Videocam />}
                                label={t('authorTrial.badgeNoImages')}
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.12)' }}
                                variant="outlined"
                            />
                            <Chip
                                size="small"
                                icon={<Lock />}
                                label={t('authorTrial.badgeAuthorsOnly')}
                                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.12)' }}
                                variant="outlined"
                            />
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.78)', maxWidth: 900 }}>
                            {t('authorTrial.privacy')}
                        </Typography>
                    </Stack>
                </Box>

                {!state.connected ? (
                    <Card elevation={8} sx={{ borderRadius: 4 }}>
                        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
                            <Stack spacing={2.5} sx={{ maxWidth: 560, mx: 'auto' }} alignItems="stretch">
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 2,
                                            display: 'grid',
                                            placeItems: 'center',
                                            color: 'white',
                                            background: 'linear-gradient(135deg,#4f46e5,#0891b2)',
                                        }}
                                    >
                                        <Lock />
                                    </Box>
                                    <Box>
                                        <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                                            {t('authorTrial.gateTitle')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('authorTrial.gateSubtitle')}
                                        </Typography>
                                    </Box>
                                </Stack>
                                <TextField
                                    type="password"
                                    label={t('authorTrial.accessCodeLabel')}
                                    value={codeInput}
                                    onChange={(event) => setCodeInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && codeInput.trim() && !state.participantsLoading) {
                                            void handleConnect(codeInput)
                                        }
                                    }}
                                    autoComplete="off"
                                    fullWidth
                                    error={!!(state.participantsError || gateError)}
                                    helperText={
                                        state.participantsError ?? gateError ?? t('authorTrial.accessCodeHelp')
                                    }
                                    inputProps={{ 'aria-label': t('authorTrial.accessCodeLabel') }}
                                />
                                <Button
                                    variant="contained"
                                    size="large"
                                    sx={BIG_BUTTON_SX}
                                    onClick={() => void handleConnect(codeInput)}
                                    disabled={!codeInput.trim() || state.participantsLoading}
                                    startIcon={
                                        state.participantsLoading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />
                                    }
                                >
                                    {state.participantsLoading ? t('authorTrial.connecting') : t('authorTrial.connect')}
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                ) : (
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.3fr) minmax(0, 0.7fr)' },
                            gap: 2,
                            alignItems: 'start',
                        }}
                    >
                        <Stack spacing={2}>
                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                            <Chip color="success" icon={<CheckCircle />} label={t('authorTrial.connected')} />
                                            {flow && (
                                                <>
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        icon={<Fingerprint />}
                                                        label={t('authorTrial.flowMethod', { method: flow.method })}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={t('authorTrial.flowBinding', {
                                                            value: flow.binding ? t('authorTrial.flowOn') : t('authorTrial.flowOff'),
                                                        })}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={t('authorTrial.flowChallenges', {
                                                            count: flow.challenges?.length ?? 0,
                                                        })}
                                                    />
                                                </>
                                            )}
                                        </Stack>

                                        <Divider />

                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Person color="primary" />
                                            <Box>
                                                <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                                                    {t('authorTrial.whoTitle')}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('authorTrial.whoSubtitle')}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id="author-trial-participant">
                                                    {t('authorTrial.participantLabel')}
                                                </InputLabel>
                                                <Select
                                                    labelId="author-trial-participant"
                                                    label={t('authorTrial.participantLabel')}
                                                    value={participantCode}
                                                    onChange={(event) => setParticipantCode(event.target.value)}
                                                    inputProps={{ 'data-testid': 'participant-select' }}
                                                >
                                                    {state.participants.map((p) => (
                                                        <MenuItem key={p.code} value={p.code}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                                    {p.code}
                                                                </Typography>
                                                                <Chip
                                                                    size="small"
                                                                    color={p.enrolled ? 'success' : 'warning'}
                                                                    label={
                                                                        p.enrolled
                                                                            ? t('authorTrial.enrolled')
                                                                            : t('authorTrial.notEnrolled')
                                                                    }
                                                                />
                                                            </Stack>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                            {participant && !participant.enrolled && (
                                                <Button
                                                    variant="outlined"
                                                    color="warning"
                                                    startIcon={<CameraAlt />}
                                                    onClick={() => setEnrollOpen(true)}
                                                    sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
                                                >
                                                    {t('authorTrial.enroll')}
                                                </Button>
                                            )}
                                        </Stack>

                                        <Divider />

                                        <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                                            {t('authorTrial.modeTitle')}
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={mode}
                                            exclusive
                                            fullWidth
                                            onChange={(_event, next: AuthorTrialMode | null) => {
                                                if (next) setMode(next)
                                            }}
                                            aria-label={t('authorTrial.modeTitle')}
                                        >
                                            <ToggleButton value="genuine" sx={{ py: 1.2, gap: 1 }}>
                                                <Box component="span" aria-hidden="true" sx={{ fontSize: '1.4rem' }}>
                                                    😀
                                                </Box>
                                                <Box sx={{ textAlign: 'start' }}>
                                                    <Typography sx={{ fontWeight: 800 }}>{t('authorTrial.modeGenuine')}</Typography>
                                                    <Typography variant="caption" display="block">
                                                        {t('authorTrial.modeGenuineHint')}
                                                    </Typography>
                                                </Box>
                                            </ToggleButton>
                                            <ToggleButton value="attack" sx={{ py: 1.2, gap: 1 }}>
                                                <Box component="span" aria-hidden="true" sx={{ fontSize: '1.4rem' }}>
                                                    🎭
                                                </Box>
                                                <Box sx={{ textAlign: 'start' }}>
                                                    <Typography sx={{ fontWeight: 800 }}>{t('authorTrial.modeAttack')}</Typography>
                                                    <Typography variant="caption" display="block">
                                                        {t('authorTrial.modeAttackHint')}
                                                    </Typography>
                                                </Box>
                                            </ToggleButton>
                                        </ToggleButtonGroup>

                                        <AnimatePresence initial={false}>
                                            {mode === 'attack' && (
                                                <motion.div
                                                    key="attack-fields"
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                                                        <FormControl fullWidth size="small">
                                                            <InputLabel id="author-trial-target">
                                                                {t('authorTrial.targetLabel')}
                                                            </InputLabel>
                                                            <Select
                                                                labelId="author-trial-target"
                                                                label={t('authorTrial.targetLabel')}
                                                                value={targetCode}
                                                                onChange={(event) => setTargetCode(event.target.value)}
                                                                inputProps={{ 'data-testid': 'target-select' }}
                                                            >
                                                                {targetOptions.map((p) => (
                                                                    <MenuItem key={p.code} value={p.code}>
                                                                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                                            {p.code}
                                                                        </Typography>
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('authorTrial.targetHelp')}
                                                        </Typography>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                            {t('authorTrial.instrumentTitle')}
                                                        </Typography>
                                                        <ToggleButtonGroup
                                                            value={instrumentPreset}
                                                            exclusive
                                                            fullWidth
                                                            onChange={(_event, next: AuthorTrialInstrumentPreset | null) => {
                                                                if (next) setInstrumentPreset(next)
                                                            }}
                                                            aria-label={t('authorTrial.instrumentPresetLabel')}
                                                        >
                                                            {INSTRUMENT_PRESETS.map((preset) => (
                                                                <ToggleButton key={preset.value} value={preset.value} sx={{ py: 1, gap: 0.5 }}>
                                                                    <Box component="span" aria-hidden="true">
                                                                        {preset.emoji}
                                                                    </Box>
                                                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                                                        {t(preset.labelKey)}
                                                                    </Typography>
                                                                </ToggleButton>
                                                            ))}
                                                        </ToggleButtonGroup>
                                                        <TextField
                                                            size="small"
                                                            label={t('authorTrial.instrumentNameLabel')}
                                                            helperText={t('authorTrial.instrumentNameHelp', {
                                                                max: MAX_INSTRUMENT_CHARS,
                                                            })}
                                                            value={instrumentName}
                                                            onChange={(event) =>
                                                                setInstrumentName(event.target.value.slice(0, MAX_INSTRUMENT_CHARS))
                                                            }
                                                            inputProps={{ maxLength: MAX_INSTRUMENT_CHARS }}
                                                        />
                                                    </Stack>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card sx={{ borderRadius: 3 }} data-testid="device-card">
                                <CardContent>
                                    <Stack spacing={1.5}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Monitor color="primary" />
                                            <Box>
                                                <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                                                    {t('authorTrial.deviceTitle')}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('authorTrial.deviceSubtitle')}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                        {detection === 'detecting' && (
                                            <Stack direction="row" spacing={1} alignItems="center" role="status">
                                                <CircularProgress size={18} />
                                                <Typography variant="body2">{t('authorTrial.detecting')}</Typography>
                                            </Stack>
                                        )}
                                        {detection === 'failed' && (
                                            <Alert severity="warning" icon={<WarningAmber />}>
                                                {t('authorTrial.detectFailed')}
                                            </Alert>
                                        )}
                                        {deviceSummary && (
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                icon={<Smartphone />}
                                                label={t('authorTrial.deviceSummary', { summary: deviceSummary })}
                                                sx={{ alignSelf: 'flex-start', maxWidth: '100%' }}
                                            />
                                        )}
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id="author-trial-profile">
                                                    {t('authorTrial.profileLabel')}
                                                </InputLabel>
                                                <Select
                                                    labelId="author-trial-profile"
                                                    label={t('authorTrial.profileLabel')}
                                                    value={profileName}
                                                    onChange={(event) => applyProfile(event.target.value)}
                                                >
                                                    <MenuItem value="__auto__">{t('authorTrial.profileDetected')}</MenuItem>
                                                    {profiles.map((profile) => (
                                                        <MenuItem key={profile.name} value={profile.name}>
                                                            {profile.name}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Save />}
                                                onClick={saveCurrentProfile}
                                                disabled={!deviceForm.label.trim()}
                                                sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
                                            >
                                                {t('authorTrial.profileSave')}
                                            </Button>
                                        </Stack>
                                        {profileSaved && (
                                            <Typography variant="caption" color="success.main" role="status">
                                                {t('authorTrial.profileSaved')}
                                            </Typography>
                                        )}
                                        <Box sx={FIELD_GRID_SX}>
                                            <TextField
                                                size="small"
                                                label={t('authorTrial.deviceLabel')}
                                                {...deviceEdit('label', MAX_DEVICE_LABEL_CHARS)}
                                            />
                                            <TextField size="small" label={t('authorTrial.deviceOs')} {...deviceEdit('os', 60)} />
                                            <TextField
                                                size="small"
                                                label={t('authorTrial.deviceBrowser')}
                                                {...deviceEdit('browser', 60)}
                                            />
                                            <TextField
                                                size="small"
                                                label={t('authorTrial.deviceScreen')}
                                                {...deviceEdit('screen', 24)}
                                            />
                                            <TextField
                                                size="small"
                                                label={t('authorTrial.deviceCamera')}
                                                {...deviceEdit('cameraLabel', 80)}
                                            />
                                            <TextField
                                                size="small"
                                                label={t('authorTrial.deviceCameraResolution')}
                                                {...deviceEdit('cameraResolution', 16)}
                                            />
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Box>
                                {!isRunning ? (
                                    <motion.div whileHover={{ scale: canStart ? 1.01 : 1 }} whileTap={{ scale: canStart ? 0.99 : 1 }}>
                                        <Button
                                            data-testid="trial-start"
                                            variant="contained"
                                            fullWidth
                                            sx={{
                                                ...BIG_BUTTON_SX,
                                                background: 'linear-gradient(135deg,#059669,#0891b2)',
                                                '&:hover': { background: 'linear-gradient(135deg,#047857,#0e7490)' },
                                            }}
                                            startIcon={<PlayArrow sx={{ fontSize: 32 }} />}
                                            onClick={handleStart}
                                            disabled={!canStart}
                                        >
                                            {t('authorTrial.start')}
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        animate={{
                                            boxShadow: [
                                                '0 0 0 0 rgba(239,68,68,0.45)',
                                                '0 0 0 14px rgba(239,68,68,0)',
                                            ],
                                        }}
                                        transition={{ repeat: Infinity, duration: 1.8 }}
                                        style={{ borderRadius: 12 }}
                                    >
                                        <Button
                                            data-testid="trial-stop"
                                            variant="contained"
                                            color="error"
                                            fullWidth
                                            sx={BIG_BUTTON_SX}
                                            startIcon={<Stop sx={{ fontSize: 32 }} />}
                                            onClick={trial.stop}
                                            disabled={state.phase === 'stopping'}
                                        >
                                            {state.phase === 'stopping' ? t('authorTrial.stopping') : t('authorTrial.stop')}
                                        </Button>
                                    </motion.div>
                                )}
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, textAlign: 'center' }}>
                                    {t('authorTrial.stopHint')} · {t('authorTrial.nextAttemptHint')}
                                </Typography>
                            </Box>

                            <AnimatePresence>
                                {isRunning && (
                                    <motion.div
                                        key="stage"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                    >
                                        <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'primary.main' }}>
                                            <CardContent>
                                                <Stack spacing={2}>
                                                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                                        <Chip
                                                            color="primary"
                                                            label={t('authorTrial.running')}
                                                            icon={<Speed />}
                                                        />
                                                        {state.current && (
                                                            <>
                                                                <Chip
                                                                    variant="outlined"
                                                                    label={t('authorTrial.roundLabel', { round: state.current.round })}
                                                                />
                                                                <Chip
                                                                    variant="outlined"
                                                                    icon={
                                                                        <Box component="span" aria-hidden="true" sx={{ fontSize: '1rem', ml: 0.5 }}>
                                                                            {challengeEmoji(state.current.challenge)}
                                                                        </Box>
                                                                    }
                                                                    label={t('authorTrial.challengeLabel', {
                                                                        challenge: state.current.challenge,
                                                                    })}
                                                                />
                                                                {state.current.binding && (
                                                                    <Chip color="secondary" size="small" label={t('authorTrial.bindingOn')} />
                                                                )}
                                                            </>
                                                        )}
                                                    </Stack>

                                                    {state.current && (
                                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                                                            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                                                <CircularProgress
                                                                    variant="determinate"
                                                                    value={
                                                                        state.current.count > 0
                                                                            ? Math.min(
                                                                                  100,
                                                                                  (state.current.position / state.current.count) * 100,
                                                                              )
                                                                            : 0
                                                                    }
                                                                    size={124}
                                                                    thickness={5}
                                                                />
                                                                <Box
                                                                    sx={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        display: 'grid',
                                                                        placeItems: 'center',
                                                                        textAlign: 'center',
                                                                    }}
                                                                >
                                                                    <Box>
                                                                        <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', lineHeight: 1 }}>
                                                                            {state.current.position}/{state.current.count}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {t('authorTrial.positionLabel', {
                                                                                position: state.current.position,
                                                                                count: state.current.count,
                                                                            })}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                                                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                                    {t('authorTrial.attemptStage', { attempt: state.attempts })}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {state.current.participantCode} → {state.current.targetCode}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                                    {roundPositionLabel(
                                                                        state.current.round,
                                                                        state.current.position,
                                                                        state.current.count,
                                                                    )}
                                                                </Typography>
                                                            </Stack>
                                                        </Stack>
                                                    )}

                                                    <Divider />

                                                    {state.current ? (
                                                        <MfaStepRenderer
                                                            method={AuthMethodType.PUZZLE}
                                                            mfaSessionToken={state.current.mfaSessionToken}
                                                            verifyStep={trial.verifyStep}
                                                            requestWebAuthnChallenge={trial.requestWebAuthnChallenge}
                                                            httpClient={httpClient}
                                                            onAuthenticated={trial.onAuthenticated}
                                                            onBack={trial.onBack}
                                                            loading={state.stepLoading}
                                                            error={state.stepError ?? undefined}
                                                            onError={trial.onStepError}
                                                            puzzleConfig={state.current.puzzleConfig}
                                                        />
                                                    ) : (
                                                        <Stack alignItems="center" spacing={1.5} sx={{ py: 3 }}>
                                                            <CircularProgress size={30} />
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} role="status">
                                                                {t('authorTrial.prepareTitle')}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {t('authorTrial.prepareHint')}
                                                            </Typography>
                                                        </Stack>
                                                    )}
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Stack>

                        <Stack spacing={2}>
                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Stack spacing={1.5}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Insights color="primary" />
                                            <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                                                {t('authorTrial.statsTitle')}
                                            </Typography>
                                        </Stack>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                                            <StatTile
                                                icon={<VerifiedUser fontSize="small" />}
                                                label={t('authorTrial.statAccepted')}
                                                value={String(state.accepted)}
                                                tone="#16a34a"
                                            />
                                            <StatTile
                                                icon={<GppBad fontSize="small" />}
                                                label={t('authorTrial.statRejected')}
                                                value={String(state.rejected)}
                                                tone="#dc2626"
                                            />
                                            <StatTile
                                                icon={<ErrorOutline fontSize="small" />}
                                                label={t('authorTrial.statErrors')}
                                                value={String(state.errors)}
                                                tone="#d97706"
                                            />
                                            <StatTile
                                                icon={<Speed fontSize="small" />}
                                                label={t('authorTrial.statPerMinute')}
                                                value={perMinute.toFixed(1)}
                                                tone="#0284c7"
                                            />
                                        </Box>
                                        <StatTile
                                            icon={<Fingerprint fontSize="small" />}
                                            label={t('authorTrial.statLastScore')}
                                            value={
                                                state.lastIdentityScore != null
                                                    ? state.lastIdentityScore.toFixed(3)
                                                    : t('authorTrial.statNoScore')
                                            }
                                            tone="#7c3aed"
                                            hint={t('authorTrial.identityScoreUnavailable')}
                                        />
                                        {state.lastError && (
                                            <Alert severity="warning" sx={{ wordBreak: 'break-word' }}>
                                                {state.lastError}
                                            </Alert>
                                        )}
                                        <Typography variant="caption" color="text.secondary">
                                            {t('authorTrial.attemptTimeoutNotice', {
                                                seconds: Math.round(resolveAttemptTimeoutMs() / 1000),
                                            })}
                                        </Typography>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card sx={{ borderRadius: 3 }} data-testid="attempt-feed">
                                <CardContent>
                                    <Stack spacing={1.25}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Videocam color="primary" />
                                            <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                                                {t('authorTrial.feedTitle')}
                                            </Typography>
                                        </Stack>
                                        {state.feed.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                {t('authorTrial.feedEmpty')}
                                            </Typography>
                                        ) : (
                                            <Stack spacing={1} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
                                                {[...state.feed].reverse().map((entry) => (
                                                    <FeedRow key={entry.key} entry={entry} />
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Stack spacing={1.25}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Download color="primary" />
                                            <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                                                {t('authorTrial.exportTitle')}
                                            </Typography>
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('authorTrial.exportHint')}
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Button
                                                variant="outlined"
                                                startIcon={
                                                    exporting === 'csv' ? <CircularProgress size={16} /> : <Download />
                                                }
                                                onClick={() => void handleDownload('csv')}
                                                disabled={exporting != null}
                                            >
                                                {t('authorTrial.exportCsv')}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={
                                                    exporting === 'json' ? <CircularProgress size={16} /> : <Download />
                                                }
                                                onClick={() => void handleDownload('json')}
                                                disabled={exporting != null}
                                            >
                                                {t('authorTrial.exportJson')}
                                            </Button>
                                        </Stack>
                                        {exportError && <Alert severity="error">{exportError}</Alert>}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Stack direction="row" spacing={1} alignItems="flex-start">
                                        <CameraAlt fontSize="small" color="action" />
                                        <Stack spacing={0.5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('authorTrial.privacyShort')}
                                            </Typography>
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                <Chip size="small" icon={<Cancel />} label={t('authorTrial.noRawData')} />
                                                <Chip size="small" icon={<Lock />} label={t('authorTrial.pseudonymous')} />
                                            </Stack>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Box>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pb: 2 }}>
                    {t('authorTrial.footerNote')}
                </Typography>
            </Stack>

            {participant && (
                <EnrollDialog
                    open={enrollOpen}
                    accessCode={accessCode}
                    participantCode={participant.code}
                    onClose={() => setEnrollOpen(false)}
                    onEnrolled={() => void trial.refreshParticipants()}
                />
            )}
        </Box>
    )
}