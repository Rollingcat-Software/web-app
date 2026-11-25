/**
 * Author trial protocol — the web side of the authors-only Paper B surface.
 *
 * The wire shapes are re-exported from `@domain/models/AuthorTrial` (the one
 * definition, mirroring identity-core-api's `AUTHOR_TRIAL_CONTRACT.md`). This
 * module adds what the page needs that is NOT wire data: instrument presets +
 * labels, the lighting buckets the analysis uses, display helpers, and the
 * sanitisers/caps applied before anything is sent or stored.
 *
 * No string here is rendered directly: transport labels carry i18n keys.
 */
import type { MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type {
    AuthorTrialClientOutcome,
    AuthorTrialDeviceSnapshot,
    AuthorTrialDifficulty,
    AuthorTrialEnvSnapshot,
    AuthorTrialInstrumentPreset,
    AuthorTrialPuzzleConfig,
} from '@domain/models/AuthorTrial'

export type {
    AuthorTrialAttemptFinishRequest,
    AuthorTrialClientOutcome,
    AuthorTrialDeviceSnapshot,
    AuthorTrialDeviceType,
    AuthorTrialDifficulty,
    AuthorTrialEnrollRequest,
    AuthorTrialEnvSnapshot,
    AuthorTrialExportFormat,
    AuthorTrialFlow,
    AuthorTrialInstrumentPreset,
    AuthorTrialMode,
    AuthorTrialParticipant,
    AuthorTrialParticipantsResponse,
    AuthorTrialPuzzleConfig,
    AuthorTrialSessionRequest,
    AuthorTrialSessionResponse,
} from '@domain/models/AuthorTrial'

/** Default per-attempt ceiling (contract §5). Overridable by `?attemptTimeoutMs=`. */
export const ATTEMPT_TIMEOUT_MS = 120_000
/** Short pause between attempts so the operator can read the feed. */
export const ATTEMPT_PAUSE_MS = 1_500
/** Length of the camera measurement window. */
export const CAMERA_SAMPLE_MS = 1_000
/** Interval between luma samples inside the window. */
export const CAMERA_SAMPLE_INTERVAL_MS = 100
export const MAX_INSTRUMENT_CHARS = 120
export const MAX_FEED_ENTRIES = 100
export const MAX_DEVICE_PROFILES = 20
export const MAX_DEVICE_LABEL_CHARS = 80
export const MAX_OS_CHARS = 60
export const MAX_BROWSER_CHARS = 60
export const MAX_SCREEN_CHARS = 24
export const MAX_CAMERA_LABEL_CHARS = 80
export const MAX_CAMERA_RESOLUTION_CHARS = 16
export const MIN_ATTEMPT_TIMEOUT_MS = 1_000
export const MAX_ATTEMPT_TIMEOUT_MS = 30 * 60_000

/** `sessionStorage`: kept only for this tab, never logged or sent as data. */
export const ACCESS_CODE_STORAGE_KEY = 'authorTrial.accessCode'
/** `localStorage`: device profiles, one entry per physical setup. */
export const DEVICE_PROFILES_STORAGE_KEY = 'authorTrial.deviceProfiles'

export const EMPTY_DEVICE_SNAPSHOT: Readonly<AuthorTrialDeviceSnapshot> = Object.freeze({
    label: '',
    os: '',
    browser: '',
    screen: '',
    cameraLabel: '',
    cameraResolution: '',
    hardwareConcurrency: null,
    deviceMemoryGB: null,
    type: 'computer',
})

/**
 * Instrument presets in the dropdown order. `labelKey` is the ONLY thing the
 * UI renders (all strings go through i18n); `label` exists for tests, logs and
 * the runbook.
 */
export const INSTRUMENT_PRESETS: ReadonlyArray<{
    value: AuthorTrialInstrumentPreset
    label: string
    labelKey: string
    emoji: string
}> = Object.freeze([
    { value: 'live_face_swap', label: 'Live face swap', labelKey: 'authorTrial.instrument.live_face_swap', emoji: '🎭' },
    { value: 'deepfake_replay', label: 'Deepfake replay', labelKey: 'authorTrial.instrument.deepfake_replay', emoji: '📼' },
    { value: 'virtual_camera', label: 'Virtual camera', labelKey: 'authorTrial.instrument.virtual_camera', emoji: '🎥' },
    { value: 'other', label: 'Other', labelKey: 'authorTrial.instrument.other', emoji: '🧪' },
])

/** Emoji used on the live challenge badge (server action names are data). */
const CHALLENGE_EMOJI: Record<string, string> = {
    blink: '👁️',
    smile: '😊',
    open_mouth: '😮',
    turn_left: '👈',
    turn_right: '👉',
    look_left: '👀',
    look_right: '👀',
    look_up: '☝️',
    look_down: '👇',
    nod: '↕️',
    shake: '↔️',
    finger_count: '✋',
    pinch: '🤏',
    hand_wave: '👋',
    thumbs_up: '👍',
    victory: '✌️',
    thumb_index: '🤟',
    fist: '✊',
    point_up: '☝️',
}

export function challengeEmoji(challenge: string | null | undefined): string {
    if (!challenge) return '🧩'
    return CHALLENGE_EMOJI[challenge.toLowerCase()] ?? '🧩'
}

/** Two decimals, null stays null. */
export function round2(x: number | null | undefined): number | null {
    return x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100
}

/** Three decimals, null stays null. */
export function round3(x: number | null | undefined): number | null {
    return x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000
}

export function clampNumber(
    value: unknown,
    min: number,
    max: number,
    digits: number,
): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const clamped = Math.min(max, Math.max(min, value))
    const factor = 10 ** digits
    return Math.round(clamped * factor) / factor
}

/**
 * Lighting bucket used by the export/analysis:
 * `bright` >= 0.65, `moderate` >= 0.4, `dim` >= 0.2, `dark` below, `unknown`.
 */
export function lightingBucket(brightness: number | null | undefined): string {
    if (brightness == null || !Number.isFinite(brightness)) return 'unknown'
    if (brightness >= 0.65) return 'bright'
    if (brightness >= 0.4) return 'moderate'
    if (brightness >= 0.2) return 'dim'
    return 'dark'
}

/** Client local `HH:MM` (24 h), zero padded. */
export function localTimeOfDay(date: Date = new Date()): string {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
}

/** `WxH@DPR`, e.g. `1920x1080@2`; empty string when the screen is unknown. */
export function screenLabel(
    width: number | null | undefined,
    height: number | null | undefined,
    dpr: number | null | undefined,
): string {
    if (!width || !height || width <= 0 || height <= 0) return ''
    const ratio = dpr && dpr > 0 ? Number(dpr.toFixed(2)) : 1
    return `${Math.round(width)}x${Math.round(height)}@${ratio}`.slice(0, MAX_SCREEN_CHARS)
}

/** `<device_label> / <os> / <browser> / <camera_label>` (contract §3.7). */
export function composeDeviceSummary(
    device: Partial<AuthorTrialDeviceSnapshot> | null | undefined,
): string {
    if (!device) return ''
    const parts = [device.label, device.os, device.browser, device.cameraLabel]
        .map((part) => sanitizeText(part, MAX_DEVICE_LABEL_CHARS))
        .filter(Boolean)
    return parts.join(' / ')
}

/** Locale-neutral `R1 · 2/3`, used on the progress ring. */
export function roundPositionLabel(
    round: number | null | undefined,
    position: number | null | undefined,
    count: number | null | undefined,
): string {
    const r = Number.isFinite(round) && (round as number) > 0 ? Math.floor(round as number) : null
    const p = Number.isFinite(position) && (position as number) > 0 ? Math.floor(position as number) : null
    const n = Number.isFinite(count) && (count as number) > 0 ? Math.floor(count as number) : null
    if (r == null && p == null) return ''
    if (r == null) return n == null ? String(p) : `${p}/${n}`
    if (p == null) return `R${r}`
    return n == null ? `R${r} · ${p}` : `R${r} · ${p}/${n}`
}

/**
 * Strips control characters, collapses whitespace and caps the length. Used
 * for every free-text value before it is displayed or sent.
 */
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g')

export function sanitizeText(value: unknown, maxChars: number): string {
    if (value == null) return ''
    return String(value)
        .replace(CONTROL_CHARS, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, Math.max(0, maxChars))
}

export function sanitizeParticipantCode(value: unknown): string {
    return sanitizeText(value, 32).replace(/[^A-Za-z0-9_-]/g, '')
}

/** Free-text instrument, or undefined when empty (the contract allows absence). */
export function sanitizeInstrument(value: unknown): string | undefined {
    const text = sanitizeText(value, MAX_INSTRUMENT_CHARS)
    return text.length > 0 ? text : undefined
}

/**
 * Maps a free-text value to the contract's preset enum: a known preset passes
 * through, any other non-empty text becomes `other`, empty becomes undefined.
 */
export function normalizeInstrumentPreset(
    value: unknown,
): AuthorTrialInstrumentPreset | undefined {
    const text = sanitizeText(value, 40).toLowerCase()
    if (!text) return undefined
    const known = INSTRUMENT_PRESETS.find((p) => p.value === text)
    return known ? known.value : 'other'
}

export function instrumentPresetLabelKey(value: AuthorTrialInstrumentPreset | undefined): string | null {
    if (!value) return null
    return INSTRUMENT_PRESETS.find((p) => p.value === value)?.labelKey ?? null
}

function sanitizeNumberOrNull(value: unknown, min: number, max: number): number | null {
    return clampNumber(value, min, max, 2)
}

/** Bounded, control-character-free device snapshot (contract §3.2). */
export function sanitizeDeviceSnapshot(
    input: Partial<AuthorTrialDeviceSnapshot> | null | undefined,
): AuthorTrialDeviceSnapshot {
    const d = input ?? {}
    const hw = d.hardwareConcurrency
    const mem = d.deviceMemoryGB
    return {
        label: sanitizeText(d.label, MAX_DEVICE_LABEL_CHARS),
        os: sanitizeText(d.os, MAX_OS_CHARS),
        browser: sanitizeText(d.browser, MAX_BROWSER_CHARS),
        screen: sanitizeText(d.screen, MAX_SCREEN_CHARS),
        cameraLabel: sanitizeText(d.cameraLabel, MAX_CAMERA_LABEL_CHARS),
        cameraResolution: sanitizeText(d.cameraResolution, MAX_CAMERA_RESOLUTION_CHARS),
        hardwareConcurrency:
            typeof hw === 'number' && Number.isFinite(hw) && hw > 0
                ? Math.min(256, Math.floor(hw))
                : null,
        deviceMemoryGB: sanitizeNumberOrNull(mem, 0, 1024),
        type: d.type === 'phone_tablet' ? 'phone_tablet' : 'computer',
    }
}

export function emptyEnvSnapshot(now: Date = new Date()): AuthorTrialEnvSnapshot {
    return { localTimeOfDay: localTimeOfDay(now), brightness: null, exposureScore: null, frameRate: null }
}

/** Bounded environment snapshot; an invalid clock falls back to the local now. */
export function sanitizeEnvSnapshot(
    input: Partial<AuthorTrialEnvSnapshot> | null | undefined,
    now: Date = new Date(),
): AuthorTrialEnvSnapshot {
    const e = input ?? {}
    const time =
        typeof e.localTimeOfDay === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.localTimeOfDay)
            ? e.localTimeOfDay
            : localTimeOfDay(now)
    return {
        localTimeOfDay: time,
        brightness: clampNumber(e.brightness, 0, 1, 3),
        exposureScore: clampNumber(e.exposureScore, 0, 1, 3),
        frameRate: clampNumber(e.frameRate, 0, 240, 1),
    }
}

/**
 * Merges the auto-detected device under the operator's editable fields: every
 * non-empty manual value wins, detection fills only the gaps.
 */
export function mergeDeviceSnapshots(
    detected: Partial<AuthorTrialDeviceSnapshot> | null | undefined,
    chosen: Partial<AuthorTrialDeviceSnapshot> | null | undefined,
): AuthorTrialDeviceSnapshot {
    const d = sanitizeDeviceSnapshot(detected)
    const c = sanitizeDeviceSnapshot(chosen)
    const pick = (manual: string, auto: string) => (manual.length > 0 ? manual : auto)
    return {
        label: pick(c.label, d.label),
        os: pick(c.os, d.os),
        browser: pick(c.browser, d.browser),
        screen: pick(c.screen, d.screen),
        cameraLabel: pick(c.cameraLabel, d.cameraLabel),
        cameraResolution: pick(c.cameraResolution, d.cameraResolution),
        hardwareConcurrency: c.hardwareConcurrency ?? d.hardwareConcurrency,
        deviceMemoryGB: c.deviceMemoryGB ?? d.deviceMemoryGB,
        type: c.type === 'phone_tablet' || d.type === 'phone_tablet' ? 'phone_tablet' : 'computer',
    }
}

export interface StepClassification {
    outcome: AuthorTrialClientOutcome
    reason?: string
}

/**
 * Maps the shared MFA step response to what the trial records.
 *
 * - AUTHENTICATED -> accepted (the real login machinery decided).
 * - FAILED / ERROR / FACE_IMAGE_REQUIRED -> rejected (server verdict / gate).
 * - STEP_COMPLETED -> rejected with `step_completed`: a completed intermediate
 *   step is NEVER an accept for this trial.
 * - anything else (empty, CHALLENGE, unknown) -> error; fail closed.
 */
export function classifyStepResponse(
    response: Pick<MfaStepResponse, 'status'> | null | undefined,
): StepClassification {
    switch (response?.status) {
        case 'AUTHENTICATED':
            return { outcome: 'accepted' }
        case 'STEP_COMPLETED':
            return { outcome: 'rejected', reason: 'step_completed' }
        case 'FAILED':
            return { outcome: 'rejected', reason: 'step_failed' }
        case 'ERROR':
            return { outcome: 'rejected', reason: 'step_error' }
        case 'FACE_IMAGE_REQUIRED':
            return { outcome: 'rejected', reason: 'face_image_required' }
        case 'CHALLENGE':
            return { outcome: 'rejected', reason: 'challenge_unexpected' }
        default:
            return {
                outcome: 'error',
                reason: response ? 'unexpected_status' : 'empty_response',
            }
    }
}

/**
 * Identity score when the server happens to include it on the step response.
 * The authoritative value is written server-side and exported; this is a live
 * display convenience only, never a decision input.
 */
export function readIdentityScore(response: unknown): number | null {
    if (!response || typeof response !== 'object') return null
    const r = response as Record<string, unknown>
    const direct = r.identityScore ?? r.identity_score
    if (typeof direct === 'number' && Number.isFinite(direct)) {
        return clampNumber(direct, 0, 1, 4)
    }
    const data = r.data
    if (data && typeof data === 'object') {
        const nested = (data as Record<string, unknown>).identity_score ?? (data as Record<string, unknown>).identityScore
        if (typeof nested === 'number' && Number.isFinite(nested)) return clampNumber(nested, 0, 1, 4)
        if (typeof nested === 'string' && nested.trim() !== '') {
            const parsed = Number(nested)
            if (Number.isFinite(parsed)) return clampNumber(parsed, 0, 1, 4)
        }
    }
    return null
}

/** Build id sent as `webVersion`; falls back to a stable placeholder. */
export function webVersion(): string {
    const raw: unknown = import.meta.env.VITE_APP_VERSION
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim().slice(0, 80) : 'web-dev'
}

/** A saved device profile (localStorage; never sent as a whole). */
export interface DeviceProfile {
    name: string
    device: Pick<
        AuthorTrialDeviceSnapshot,
        'label' | 'os' | 'browser' | 'screen' | 'cameraLabel' | 'cameraResolution'
    >
    savedAt: string
}

function safeLocalStorage(): Storage | null {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null
    } catch {
        return null
    }
}

function safeSessionStorage(): Storage | null {
    try {
        return typeof sessionStorage !== 'undefined' ? sessionStorage : null
    } catch {
        return null
    }
}

function isProfile(value: unknown): value is DeviceProfile {
    if (!value || typeof value !== 'object') return false
    const p = value as Partial<DeviceProfile>
    return typeof p.name === 'string' && p.name.length > 0 && !!p.device && typeof p.device === 'object'
}

/** Reads the saved profiles; malformed storage is ignored, never thrown. */
export function loadDeviceProfiles(storage: Storage | null = safeLocalStorage()): DeviceProfile[] {
    if (!storage) return []
    try {
        const raw = storage.getItem(DEVICE_PROFILES_STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .filter(isProfile)
            .map((p) => ({
                name: sanitizeText(p.name, MAX_DEVICE_LABEL_CHARS),
                device: {
                    label: sanitizeText(p.device.label, MAX_DEVICE_LABEL_CHARS),
                    os: sanitizeText(p.device.os, MAX_OS_CHARS),
                    browser: sanitizeText(p.device.browser, MAX_BROWSER_CHARS),
                    screen: sanitizeText(p.device.screen, MAX_SCREEN_CHARS),
                    cameraLabel: sanitizeText(p.device.cameraLabel, MAX_CAMERA_LABEL_CHARS),
                    cameraResolution: sanitizeText(p.device.cameraResolution, MAX_CAMERA_RESOLUTION_CHARS),
                },
                savedAt: typeof p.savedAt === 'string' ? p.savedAt : new Date(0).toISOString(),
            }))
            .filter((p) => p.name.length > 0)
            .slice(0, MAX_DEVICE_PROFILES)
    } catch {
        return []
    }
}

/**
 * Upserts one profile by name and persists the bounded list. Returns the list
 * as stored (an unwritable storage yields the in-memory result too).
 */
export function saveDeviceProfile(
    profile: Omit<DeviceProfile, 'savedAt'> & { savedAt?: string },
    storage: Storage | null = safeLocalStorage(),
): DeviceProfile[] {
    const name = sanitizeText(profile.name, MAX_DEVICE_LABEL_CHARS)
    if (!name) return loadDeviceProfiles(storage)
    const entry: DeviceProfile = {
        name,
        device: {
            label: sanitizeText(profile.device?.label, MAX_DEVICE_LABEL_CHARS),
            os: sanitizeText(profile.device?.os, MAX_OS_CHARS),
            browser: sanitizeText(profile.device?.browser, MAX_BROWSER_CHARS),
            screen: sanitizeText(profile.device?.screen, MAX_SCREEN_CHARS),
            cameraLabel: sanitizeText(profile.device?.cameraLabel, MAX_CAMERA_LABEL_CHARS),
            cameraResolution: sanitizeText(profile.device?.cameraResolution, MAX_CAMERA_RESOLUTION_CHARS),
        },
        savedAt: profile.savedAt ?? new Date().toISOString(),
    }
    const existing = loadDeviceProfiles(storage).filter((p) => p.name !== name)
    const next = [entry, ...existing].slice(0, MAX_DEVICE_PROFILES)
    try {
        storage?.setItem(DEVICE_PROFILES_STORAGE_KEY, JSON.stringify(next))
    } catch {
        // quota / private mode: the profile is simply not remembered
    }
    return next
}

/** Access-code gate helpers (sessionStorage only; the value is never logged). */
export function readStoredAccessCode(storage: Storage | null = safeSessionStorage()): string {
    try {
        return sanitizeText(storage?.getItem(ACCESS_CODE_STORAGE_KEY), 200)
    } catch {
        return ''
    }
}

export function storeAccessCode(code: string, storage: Storage | null = safeSessionStorage()): void {
    try {
        storage?.setItem(ACCESS_CODE_STORAGE_KEY, sanitizeText(code, 200))
    } catch {
        // private mode: the code is simply not remembered for this tab
    }
}

export function clearStoredAccessCode(storage: Storage | null = safeSessionStorage()): void {
    try {
        storage?.removeItem(ACCESS_CODE_STORAGE_KEY)
    } catch {
        // ignore
    }
}

/**
 * The per-attempt ceiling. Precedence: explicit option (tests) -> query
 * parameter -> {@link ATTEMPT_TIMEOUT_MS}. Values are bounded so a typo can
 * never hang the loop forever.
 */
export function resolveAttemptTimeoutMs(
    explicit?: number,
    search: string | null = typeof window !== 'undefined' ? window.location.search : null,
): number {
    const fromQuery = (() => {
        if (!search) return NaN
        const raw = new URLSearchParams(search).get('attemptTimeoutMs')
        return raw == null ? NaN : Number(raw)
    })()
    const candidate = explicit ?? fromQuery
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0) {
        return ATTEMPT_TIMEOUT_MS
    }
    return Math.min(MAX_ATTEMPT_TIMEOUT_MS, Math.max(MIN_ATTEMPT_TIMEOUT_MS, Math.round(candidate)))
}

/** The three difficulty values the shared PUZZLE config accepts. */
export function asDifficulty(value: unknown): AuthorTrialDifficulty {
    return value === 'medium' || value === 'hard' ? value : 'easy'
}

/** Normalises a server puzzleConfig (tolerant, never throws). */
export function normalizePuzzleConfig(
    raw: Partial<AuthorTrialPuzzleConfig> | null | undefined,
    fallback?: Partial<AuthorTrialPuzzleConfig>,
): AuthorTrialPuzzleConfig {
    const source = raw ?? {}
    const base = fallback ?? {}
    const allowed = Array.isArray(source.allowedChallengeTypes)
        ? source.allowedChallengeTypes.filter((x): x is string => typeof x === 'string')
        : Array.isArray(base.allowedChallengeTypes)
          ? base.allowedChallengeTypes
          : []
    const count =
        typeof source.count === 'number' && source.count >= 1
            ? Math.floor(source.count)
            : typeof base.count === 'number' && base.count >= 1
              ? Math.floor(base.count)
              : 1
    const difficulty = asDifficulty(source.difficulty ?? base.difficulty)
    const binding =
        typeof source.alsoMatchFaceIdentity === 'boolean'
            ? source.alsoMatchFaceIdentity
            : base.alsoMatchFaceIdentity === true
    return { allowedChallengeTypes: allowed, count, difficulty, alsoMatchFaceIdentity: binding }
}

/** A mode-independent identity used by the feed keys. */
export function newLocalId(now: number = Date.now(), rand: () => number = Math.random): string {
    return `${now.toString(36)}-${rand().toString(36).slice(2, 8)}`
}