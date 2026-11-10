/**
 * Public device benchmark (Paper A): app.fivucsas.com/devbench.
 *
 * One screen at a time for people who are not technical: a 5 s countdown starts the
 * measurement by itself, a big button starts it at once, the only field is an optional
 * name. No account, no camera, no location. ROOT users also see the export buttons.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { getService } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { DevbenchExportFormat, IDevbenchRepository } from '@domain/interfaces/IDevbenchRepository'
import { useAuth } from '@features/auth/hooks/AuthContext'
import { useDevbench, type DevbenchState } from '@features/devbench/useDevbench'
import { MODEL_BYTES, ORT_VERSION, PARTICIPANT_MAX_CHARS, RUNS_PER_VISIT, WARM_RUNS } from '@features/devbench/protocol'
import { formatApiError } from '@utils/formatApiError'

const BIG_BUTTON_SX = { minHeight: 88, fontSize: '1.6rem', fontWeight: 700, borderRadius: 3 }

function DeviceLine({ state }: { state: DevbenchState }) {
    const { t } = useTranslation()
    const d = state.device
    if (!d) return <Typography variant="h6">{t('devbench.detecting')}</Typography>
    const parts = [d.label, t(`devbench.type.${d.type}`)]
    if (d.browser.name) parts.push(d.browser.name)
    if (d.hardwareConcurrency) parts.push(t('devbench.cores', { count: d.hardwareConcurrency }))
    if (d.deviceMemoryGB) parts.push(t('devbench.memory', { gb: d.deviceMemoryGB }))
    if (state.battery) {
        parts.push(
            t(state.battery.charging ? 'devbench.batteryCharging' : 'devbench.batteryNotCharging', {
                percent: Math.round(state.battery.level * 100),
            })
        )
    }
    return (
        <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
            {t('devbench.yourDevice', { details: parts.join(' · ') })}
        </Typography>
    )
}

function Warnings({ state }: { state: DevbenchState }) {
    const { t } = useTranslation()
    return (
        <Stack spacing={1} sx={{ width: '100%' }}>
            {state.battery && !state.battery.charging && <Alert severity="warning">{t('devbench.warnNotCharging')}</Alert>}
            {state.hidden && <Alert severity="warning">{t('devbench.warnHidden')}</Alert>}
        </Stack>
    )
}

function StartScreen({ state, name, setName, start, cancel }: Pick<ReturnType<typeof useDevbench>, 'state' | 'name' | 'setName' | 'start' | 'cancel'>) {
    const { t } = useTranslation()
    const counting = state.phase === 'countdown'
    return (
        <Stack spacing={3} alignItems="center" textAlign="center">
            <DeviceLine state={state} />
            {counting && (
                <Typography aria-hidden="true" sx={{ fontSize: '6rem', lineHeight: 1, fontWeight: 700, color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
                    {state.secondsLeft}
                </Typography>
            )}
            <Typography variant="h5" component="p" role="status" aria-live="polite" sx={{ fontWeight: 700 }}>
                {state.phase === 'probing'
                    ? t('devbench.detecting')
                    : counting
                      ? t('devbench.startsIn', { count: state.secondsLeft })
                      : t('devbench.pressStart')}
            </Typography>
            <Warnings state={state} />
            <Button variant="contained" fullWidth sx={BIG_BUTTON_SX} onClick={() => void start()} disabled={!state.device}>
                {t('devbench.startNow')}
            </Button>
            {counting && (
                <Button variant="outlined" size="large" fullWidth sx={{ minHeight: 56 }} onClick={cancel}>
                    {t('devbench.cancel')}
                </Button>
            )}
            <Typography color="text.secondary">{t('devbench.keepCharging')}</Typography>
            <TextField
                fullWidth
                label={t('devbench.nameLabel')}
                helperText={t('devbench.nameHelp')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputProps={{ maxLength: PARTICIPANT_MAX_CHARS, autoComplete: 'nickname' }}
            />
        </Stack>
    )
}

function RunningScreen({ state }: { state: DevbenchState }) {
    const { t } = useTranslation()
    const s = state.status
    const percent = Math.round(Math.max(0, Math.min(1, s.progress)) * 100)
    const message =
        s.run === 0
            ? t('devbench.step.download', { mb: Math.round(MODEL_BYTES / 1_000_000) })
            : s.step === 'warm'
              ? t('devbench.step.warm', { done: s.warmDone, total: WARM_RUNS })
              : t(`devbench.step.${s.step}`)
    return (
        <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography variant="h5" component="h2">
                {t('devbench.measuring')}
            </Typography>
            <Typography sx={{ fontSize: '2.6rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {t('devbench.runOf', { run: Math.max(1, s.run), total: RUNS_PER_VISIT })}
            </Typography>
            <Box sx={{ width: '100%' }}>
                <LinearProgress variant="determinate" value={percent} aria-label={t('devbench.progressLabel')} sx={{ height: 22, borderRadius: 11 }} />
            </Box>
            <Typography role="status" aria-live="polite">
                {message}
            </Typography>
            <Alert severity="info" sx={{ width: '100%', textAlign: 'start' }}>
                {t('devbench.stayOnTab')}
            </Alert>
            {state.leftTab && (
                <Alert severity="warning" sx={{ width: '100%', textAlign: 'start' }}>
                    {t('devbench.leftTab')}
                </Alert>
            )}
        </Stack>
    )
}

function DoneScreen({ state, again, resend }: { state: DevbenchState; again: () => void; resend: () => Promise<void> }) {
    const { t } = useTranslation()
    const ok = state.outcome !== 'failed'
    return (
        <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
                {ok ? t('devbench.doneTitle') : t('devbench.failedTitle')}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
                {state.results.map((r) => (
                    <Chip
                        key={r.runIndex}
                        sx={{ fontSize: '1rem', height: 40 }}
                        label={t('devbench.runResult', {
                            run: r.runIndex,
                            ms: r.timingsMs.warm?.p50 ?? '-',
                        })}
                    />
                ))}
            </Stack>
            <Alert severity={state.outcome === 'saved' ? 'success' : state.outcome === 'failed' ? 'error' : 'warning'} sx={{ width: '100%', textAlign: 'start', fontSize: '1.1rem' }}>
                {t(`devbench.outcome.${state.outcome ?? 'failed'}`, { saved: state.saved, unsent: state.unsent.length, total: RUNS_PER_VISIT })}
            </Alert>
            {state.unsent.length > 0 && (
                <Button variant="contained" fullWidth sx={BIG_BUTTON_SX} onClick={() => void resend()} disabled={state.sending}>
                    {state.sending ? t('devbench.sending') : t('devbench.resend')}
                </Button>
            )}
            {state.fatalError && (
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                    {t('devbench.technicalDetail', { detail: state.fatalError })}
                </Typography>
            )}
            <Typography color="text.secondary">{t('devbench.otherDevice')}</Typography>
            <Button variant="outlined" size="large" fullWidth sx={{ minHeight: 56 }} onClick={again}>
                {t('devbench.again')}
            </Button>
        </Stack>
    )
}

function AdminExport() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [error, setError] = useState<string | null>(null)
    if (!user?.isRoot()) return null
    const download = async (format: DevbenchExportFormat) => {
        setError(null)
        try {
            const text = await getService<IDevbenchRepository>(TYPES.DevbenchRepository).exportRuns(format)
            const blob = new Blob([text], { type: format === 'csv' ? 'text/csv' : 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `devbench_runs.${format}`
            a.click()
            URL.revokeObjectURL(a.href)
        } catch (e) {
            setError(formatApiError(e, t))
        }
    }
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6" component="h2">
                        {t('devbench.adminTitle')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Button variant="outlined" onClick={() => void download('json')}>
                            {t('devbench.exportJson')}
                        </Button>
                        <Button variant="outlined" onClick={() => void download('csv')}>
                            {t('devbench.exportCsv')}
                        </Button>
                    </Stack>
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </CardContent>
        </Card>
    )
}

export default function DevbenchPage() {
    const { t } = useTranslation()
    const bench = useDevbench()
    const { state } = bench
    return (
        <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', px: 2, py: 3 }}>
            <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto', fontSize: '1.15rem' }}>
                <Box component="header">
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                        {t('devbench.title')}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {t('devbench.intro')}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        {[`onnxruntime-web ${ORT_VERSION}`, t('devbench.specWasm'), 'Facenet512 FP16', '1x160x160x3'].map((s) => (
                            <Chip key={s} size="small" label={s} sx={{ fontFamily: 'monospace' }} />
                        ))}
                    </Stack>
                </Box>
                <Card>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        {state.phase === 'running' ? (
                            <RunningScreen state={state} />
                        ) : state.phase === 'done' ? (
                            <DoneScreen state={state} again={bench.again} resend={bench.resend} />
                        ) : (
                            <StartScreen {...bench} />
                        )}
                    </CardContent>
                </Card>
                <Typography variant="body2" color="text.secondary">
                    {t('devbench.privacy')}
                </Typography>
                <AdminExport />
            </Stack>
        </Box>
    )
}
