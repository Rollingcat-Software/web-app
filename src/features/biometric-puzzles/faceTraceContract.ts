/**
 * Contract-v2 face trace timing rules shared by `FacePuzzle` and the
 * cross-repo contract test (`__tests__/puzzleContract.test.ts`): the return
 * tail after a head turn / look, the face-gap restart, and which challenges
 * are transient (blink / wink). Pure — no React.
 */
import { ChallengeType } from '@/lib/biometric-engine/types'

/**
 * Contract v2 return tail: head turn / look challenges must come back toward
 * the neutral pose after the excursion (bio enforces "rest → excursion →
 * return"). After completion the trace keeps recording until the pose is back
 * within this fraction of the server threshold (yaw 15°, pitch 10°) of the
 * attempt's starting pose. The completion is NEVER submitted before the head
 * has returned: a trace without the return is rejected by bio and would burn
 * one of the session's 3 attempts. After RETURN_TAIL_MAX_MS the prompt becomes
 * more insistent; after RETURN_TAIL_GIVEUP_MS (or the attempt timeout) the
 * attempt fails LOCALLY (no server call, no attempt burned). The give-up bound
 * keeps the trace within bio's limits: ≤ 4 s pre-completion window + ≤ 3.5 s
 * tail stays under the 10 s span ceiling and, at ≤ 25 fps, under the 190-frame
 * cap (so the rest phase is not trimmed off the front).
 */
export const RETURN_TAIL_MAX_MS = 2_000
export const RETURN_TAIL_GIVEUP_MS = 3_500
export const RETURN_TAIL_SETTLE_MS = 160
/**
 * Return tolerances (web pose, degrees from the attempt's starting pose). bio
 * accepts a return within 7.5° yaw / 5° pitch of ITS baseline, measured with its
 * own landmark pose estimate, which on real clips reads ≈ 1.2× the matrix-based
 * web estimate; 5° / 3.5° keep the client's "returned" inside the server's
 * (2026-11-01: 6° let a real return end at 8.1° server-side).
 */
export const RETURN_YAW_TOLERANCE_DEG = 5
export const RETURN_PITCH_TOLERANCE_DEG = 3.5
/**
 * Contract v2: a face gap longer than this restarts the attempt (trace +
 * engine). bio rejects any trace with a gap > 700 ms (FRAME_GAP_TOO_LARGE), so a
 * completion spanning a longer face loss would burn a server attempt.
 */
export const FACE_GAP_RESET_MS = 600

export function isTransientChallenge(challengeType: ChallengeType): boolean {
    return (
        challengeType === ChallengeType.BLINK ||
        challengeType === ChallengeType.CLOSE_LEFT ||
        challengeType === ChallengeType.CLOSE_RIGHT
    )
}

export function needsReturnTail(challengeType: ChallengeType): 'yaw' | 'pitch' | null {
    switch (challengeType) {
        case ChallengeType.TURN_LEFT:
        case ChallengeType.TURN_RIGHT:
            return 'yaw'
        case ChallengeType.LOOK_UP:
        case ChallengeType.LOOK_DOWN:
            return 'pitch'
        default:
            return null
    }
}

export function median(values: number[]): number {
    const s = [...values].sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : 0
}
