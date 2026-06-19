import { AuthMethodType, type AuthFlowStep, type PuzzleConfig } from '@domain/models/AuthMethod'

/**
 * Per-step config serialization for the auth-flow builder.
 *
 * The backend persists arbitrary per-step configuration as a JSON blob in
 * `auth_flow_steps.config` (surfaced on `FlowStepSpec.config`). Two builder
 * controls write into it: a PUZZLE layer's {@link PuzzleConfig} and a FACE
 * layer's active-puzzle-liveness toggle. Before this module those controls were
 * rendered and edited but never serialized on save, so the tenant's puzzle
 * selection / count / difficulty (and the FACE toggle) were silently dropped and
 * the runtime then rejected the step as unconfigured. These helpers serialize on
 * save and parse back when a flow is opened for editing, so the config
 * round-trips through create → get faithfully.
 */

type StepConfigFields = Pick<
    AuthFlowStep,
    'methodType' | 'alternativeMethodTypes' | 'puzzleConfig' | 'requireActivePuzzleLiveness'
>

/** Methods that participate in a step (primary + CHOICE alternatives). */
function stepMethods(step: StepConfigFields): AuthMethodType[] {
    return [step.methodType, ...(step.alternativeMethodTypes ?? [])]
}

/**
 * Serialize a builder step's PUZZLE/FACE config into the `FlowStepSpec.config`
 * JSON string. Returns `undefined` for ordinary steps (or unconfigured ones), so
 * the payload shape is unchanged when there is nothing to persist.
 */
export function serializeStepConfig(step: StepConfigFields): string | undefined {
    const methods = stepMethods(step)
    if (methods.includes(AuthMethodType.PUZZLE) && step.puzzleConfig) {
        return JSON.stringify(step.puzzleConfig)
    }
    if (methods.includes(AuthMethodType.FACE) && step.requireActivePuzzleLiveness) {
        return JSON.stringify({ requireActivePuzzleLiveness: true })
    }
    return undefined
}

/**
 * Parse a `FlowStepSpec.config` blob back into the builder fields it serialized.
 * Tolerant of `undefined` / empty `"{}"` / malformed JSON (returns `{}`), so an
 * unexpected blob never breaks opening a flow for editing.
 */
export function parseStepConfig(config?: string): {
    puzzleConfig?: PuzzleConfig
    requireActivePuzzleLiveness?: boolean
} {
    if (!config) return {}
    let raw: Record<string, unknown>
    try {
        raw = JSON.parse(config) as Record<string, unknown>
    } catch {
        return {}
    }
    if (!raw || typeof raw !== 'object') return {}

    const out: { puzzleConfig?: PuzzleConfig; requireActivePuzzleLiveness?: boolean } = {}

    if (Array.isArray(raw.allowedChallengeTypes)) {
        const difficulty = raw.difficulty
        out.puzzleConfig = {
            allowedChallengeTypes: (raw.allowedChallengeTypes as unknown[]).map(String),
            count: typeof raw.count === 'number' && raw.count >= 1 ? raw.count : 2,
            difficulty: difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium',
            // defaults to the higher-assurance binding unless explicitly disabled
            alsoMatchFaceIdentity: raw.alsoMatchFaceIdentity !== false,
        }
    }
    if (raw.requireActivePuzzleLiveness === true) {
        out.requireActivePuzzleLiveness = true
    }
    return out
}
