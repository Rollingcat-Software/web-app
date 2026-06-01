/**
 * biometricPuzzleRegistry.test
 *
 * Locks in the contract that every one of the 23 puzzles is now backed
 * by a real per-challenge component (post-2026-04-25 fix). Two earlier
 * dispatches shipped placeholders that resolved success on a timer; if
 * a future change re-introduces a single shared component it will fail
 * here.
 */
import { describe, it, expect } from 'vitest'
import {
    BIOMETRIC_PUZZLE_REGISTRY,
    listBiometricPuzzles,
    listBiometricPuzzlesByModality,
} from '../biometricPuzzleRegistry'
import { BiometricPuzzleId } from '../BiometricPuzzleId'
import { ChallengeType } from '@/lib/biometric-engine/types'
import { isLivenessEligible } from '@/lib/biometric-engine/core/livenessPool'

describe('biometricPuzzleRegistry', () => {
    it('exposes 23 entries (14 face + 9 hand)', () => {
        const all = listBiometricPuzzles()
        expect(all).toHaveLength(23)
        expect(listBiometricPuzzlesByModality('face')).toHaveLength(14)
        expect(listBiometricPuzzlesByModality('hand')).toHaveLength(9)
    })

    it('every entry resolves to a unique React component (no shared "always succeed" placeholder)', () => {
        const components = listBiometricPuzzles().map((p) => p.component)
        const unique = new Set(components)
        expect(unique.size).toBe(components.length)
    })

    it('every face entry pins a ChallengeType from the engine enum', () => {
        const validTypes = new Set(Object.values(ChallengeType))
        for (const entry of listBiometricPuzzlesByModality('face')) {
            expect(entry.challengeType).toBeDefined()
            expect(validTypes.has(entry.challengeType!)).toBe(true)
        }
    })

    it('every hand entry is realCapable (no stubbedOnly placeholder remains)', () => {
        for (const entry of listBiometricPuzzlesByModality('hand')) {
            expect(entry.capability).toBe('realCapable')
        }
    })

    it('FACE_BLINK pins ChallengeType.BLINK', () => {
        const blink = BIOMETRIC_PUZZLE_REGISTRY[BiometricPuzzleId.FACE_BLINK]
        expect(blink.challengeType).toBe(ChallengeType.BLINK)
    })

    it('FACE_SMILE pins ChallengeType.SMILE — verifies the bug fix', () => {
        const smile = BIOMETRIC_PUZZLE_REGISTRY[BiometricPuzzleId.FACE_SMILE]
        expect(smile.challengeType).toBe(ChallengeType.SMILE)
        // The crucial regression check: blink and smile must not share a
        // component. The "always succeed" bug was caused by every face
        // puzzle reaching the same component without being parameterised.
        const blink = BIOMETRIC_PUZZLE_REGISTRY[BiometricPuzzleId.FACE_BLINK]
        expect(smile.component).not.toBe(blink.component)
    })

    // ── Curated reliable pool: library still lists ALL, drops are marked ──────
    it('the library still lists ALL 23 challenges (showcase keeps the dropped ones)', () => {
        // Re-affirms the showcase contract: nothing is REMOVED from the library,
        // the excluded challenges are only flagged experimental.
        expect(listBiometricPuzzles()).toHaveLength(23)
    })

    it('marks ONLY single-brow + finger-math as experimental', () => {
        const experimental = listBiometricPuzzles()
            .filter((p) => p.experimental)
            .map((p) => p.id)
            .sort()
        expect(experimental).toEqual(
            [
                BiometricPuzzleId.FACE_RAISE_LEFT_BROW,
                BiometricPuzzleId.FACE_RAISE_RIGHT_BROW,
                BiometricPuzzleId.HAND_MATH,
            ].sort(),
        )
    })

    it('every NON-experimental face entry is liveness-eligible, and every experimental face entry is NOT', () => {
        for (const entry of listBiometricPuzzlesByModality('face')) {
            expect(isLivenessEligible(entry.challengeType!)).toBe(!entry.experimental)
        }
    })

    it('the curated face challenges (blink/smile/etc.) are NOT experimental', () => {
        for (const id of [
            BiometricPuzzleId.FACE_BLINK,
            BiometricPuzzleId.FACE_SMILE,
            BiometricPuzzleId.FACE_OPEN_MOUTH,
            BiometricPuzzleId.FACE_TURN_LEFT,
            BiometricPuzzleId.FACE_NOD,
            BiometricPuzzleId.FACE_RAISE_BOTH_BROWS,
        ]) {
            expect(BIOMETRIC_PUZZLE_REGISTRY[id].experimental).toBeFalsy()
        }
    })
})
