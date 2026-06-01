/**
 * livenessPool — THE single source of truth for which challenges the real
 * active-liveness FLOW is allowed to prompt for.
 *
 * Product decision (2026-06-01, PO-approved "curated reliable pool" redesign):
 * the liveness flow must only draw from gestures that are physically performable
 * by ~everyone and that the on-device detectors handle reliably. Three demo-era
 * challenges are explicitly EXCLUDED from every liveness flow:
 *
 *   - RAISE_LEFT_BROW / RAISE_RIGHT_BROW — single-brow raises. ~30-40% of people
 *     physically cannot raise one eyebrow independently, so prompting for it
 *     locks out a large slice of users. (RAISE_BOTH_BROWS stays — it's universal
 *     and holdable.)
 *   - FINGER_MATH (HAND_MATH) — an arithmetic gimmick, not a liveness signal.
 *
 * These EXCLUDED challenges still appear on the Biometric Puzzles library/showcase
 * page (`biometricPuzzleRegistry`) so the platform can demo its full capability
 * set — they are just visibly marked "Experimental — not used in liveness" there.
 *
 * Anything that selects a challenge for the ACTUAL flow (enrollment / verify
 * active liveness) MUST go through `LIVENESS_POOL` / `isLivenessEligible()` so
 * there is exactly one place to change the curated set.
 */

import { ChallengeType } from '../types';

/**
 * Curated, reliable FACE challenges for active-liveness flows.
 *
 * Reliable face pool = blink, winks, smile, open-mouth, turns, look up/down,
 * nod, shake, raise-both-brows. Single-brow raises are deliberately omitted
 * (see file header).
 */
export const LIVENESS_FACE_POOL: readonly ChallengeType[] = [
  ChallengeType.BLINK,
  ChallengeType.CLOSE_LEFT,
  ChallengeType.CLOSE_RIGHT,
  ChallengeType.SMILE,
  ChallengeType.OPEN_MOUTH,
  ChallengeType.TURN_LEFT,
  ChallengeType.TURN_RIGHT,
  ChallengeType.LOOK_UP,
  ChallengeType.LOOK_DOWN,
  ChallengeType.RAISE_BOTH_BROWS,
  ChallengeType.NOD,
  ChallengeType.SHAKE_HEAD,
] as const;

/**
 * The face `ChallengeType`s that are EXCLUDED from every liveness flow but kept
 * in the library showcase. Exported so the registry can mark them without
 * re-deriving the rule.
 */
export const LIVENESS_EXCLUDED_FACE: readonly ChallengeType[] = [
  ChallengeType.RAISE_LEFT_BROW,
  ChallengeType.RAISE_RIGHT_BROW,
] as const;

/**
 * The canonical curated pool the active-liveness FACE picker draws from
 * (2-3 random challenges per session). Alias of `LIVENESS_FACE_POOL` — named
 * `LIVENESS_POOL` because face is the only modality the client-side picker
 * selects from today (the hand/gesture flow's challenges are chosen by the
 * server). Reliable hand challenges (finger-count, wave, pinch) are documented
 * in `LIVENESS_RELIABLE_HAND_IDS` for the server-driven gesture flow.
 */
export const LIVENESS_POOL: readonly ChallengeType[] = LIVENESS_FACE_POOL;

const LIVENESS_POOL_SET: ReadonlySet<ChallengeType> = new Set(LIVENESS_POOL);

/**
 * True when `challenge` may be prompted for by a real active-liveness flow.
 * Single-brow raises (and any future excluded gesture) return false.
 */
export function isLivenessEligible(challenge: ChallengeType): boolean {
  return LIVENESS_POOL_SET.has(challenge);
}
