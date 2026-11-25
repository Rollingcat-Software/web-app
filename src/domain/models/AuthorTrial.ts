/**
 * Wire types for the authors-only trial surface
 * (`/api/v1/author-trial`, identity-core-api).
 *
 * Single source of truth: the shapes below mirror
 * `docs/AUTHOR_TRIAL_CONTRACT.md` in identity-core-api. Any wire-name change
 * must change that contract first. The web feature (`features/author-trial`)
 * re-exports these and adds the display/sanitising helpers.
 */

/** A genuine attempt (own account) or an attack attempt (another author's account). */
export type AuthorTrialMode = 'genuine' | 'attack'

/** The attack instrument families named by the contract. */
export type AuthorTrialInstrumentPreset =
    | 'live_face_swap'
    | 'deepfake_replay'
    | 'virtual_camera'
    | 'other'

/** What the page saw happen during one attempt (technical status only). */
export type AuthorTrialClientOutcome = 'accepted' | 'rejected' | 'error' | 'abandoned'

export type AuthorTrialExportFormat = 'csv' | 'json'

export type AuthorTrialDeviceType = 'computer' | 'phone_tablet'

export type AuthorTrialDifficulty = 'easy' | 'medium' | 'hard'

/** One pseudonymous participant. Never carries a name, email or user id. */
export interface AuthorTrialParticipant {
    code: string
    enrolled: boolean
}

/** The tenant flow the trial sessions run (PUZZLE with identity binding). */
export interface AuthorTrialFlow {
    method: string
    binding: boolean
    difficulty: string
    count: number
    challenges: string[]
}

export interface AuthorTrialParticipantsResponse {
    tenantId: string
    participants: AuthorTrialParticipant[]
    flow: AuthorTrialFlow
}

/**
 * Device snapshot stored on the attempt. Values are best-effort: unknown
 * fields are empty strings / null, never invented. The server sanitises and
 * bounds every value; none of them drives an auth decision.
 */
export interface AuthorTrialDeviceSnapshot {
    label: string
    os: string
    browser: string
    /** `WxH@DPR`, e.g. `1920x1080@2`. */
    screen: string
    cameraLabel: string
    /** `WxH`, e.g. `1280x720`. */
    cameraResolution: string
    hardwareConcurrency: number | null
    deviceMemoryGB: number | null
    type: AuthorTrialDeviceType
}

/** Per-attempt environment measurements (never an auth input). */
export interface AuthorTrialEnvSnapshot {
    /** Client local `HH:MM`. */
    localTimeOfDay: string
    /** 0..1 mean luma. */
    brightness: number | null
    /** 0..1 clipped-pixel fraction. */
    exposureScore: number | null
    /** Measured frames per second. */
    frameRate: number | null
}

export interface AuthorTrialSessionRequest {
    participantCode: string
    mode: AuthorTrialMode
    targetCode?: string
    /** Free text, max 120 chars. */
    instrument?: string
    instrumentPreset?: AuthorTrialInstrumentPreset
    device: AuthorTrialDeviceSnapshot
    env: AuthorTrialEnvSnapshot
    webVersion: string
}

/** The PUZZLE layer config the page threads into the shared step. */
export interface AuthorTrialPuzzleConfig {
    allowedChallengeTypes: string[]
    count: number
    difficulty: AuthorTrialDifficulty
    alsoMatchFaceIdentity: boolean
}

export interface AuthorTrialSessionResponse {
    attemptId: string
    mfaSessionToken: string
    participantCode: string
    targetCode: string
    mode: AuthorTrialMode
    /** 1-based plan round. */
    round: number
    /** 1-based position inside the round. */
    position: number
    challenge: string
    binding: boolean
    difficulty: AuthorTrialDifficulty
    count: number
    puzzleConfig: AuthorTrialPuzzleConfig
}

export interface AuthorTrialAttemptFinishRequest {
    clientOutcome: AuthorTrialClientOutcome
    clientLatencyMs: number
    failureReason?: string
    device?: AuthorTrialDeviceSnapshot
    env?: AuthorTrialEnvSnapshot
}

export interface AuthorTrialEnrollRequest {
    participantCode: string
    /** Facenet512 vector computed in the browser; the raw image never leaves it. */
    embedding: number[]
    webVersion: string
}