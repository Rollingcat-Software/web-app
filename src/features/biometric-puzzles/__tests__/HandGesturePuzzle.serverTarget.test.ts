/**
 * HandGesturePuzzle — server-issued finger-count / math target (contract v2).
 *
 * The puzzle session issues `params.target` for finger_count / math and bio
 * scores against it; the component must ask the user for THAT target rather
 * than a client-random one (otherwise a genuine user fails FINGER_COUNT_MISMATCH).
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@app/providers', () => ({ useService: () => ({ post: vi.fn(), get: vi.fn() }) }))
vi.mock('@core/di/types', () => ({ TYPES: { HttpClient: 'HttpClient' } }))

import { applyServerTarget } from '../puzzles/HandGesturePuzzle'
import { BiometricPuzzleId } from '../BiometricPuzzleId'
import { initialHandState } from '../puzzles/handChallenges'

describe('applyServerTarget', () => {
    it('finger_count uses the server target', () => {
        const s = applyServerTarget(BiometricPuzzleId.HAND_FINGER_COUNT, initialHandState(BiometricPuzzleId.HAND_FINGER_COUNT), { target: 4 })
        expect(s.targetFingerCount).toBe(4)
    })

    it('math builds an a + b prompt that sums to the server target', () => {
        for (const target of [1, 2, 3, 4, 5]) {
            const s = applyServerTarget(BiometricPuzzleId.HAND_MATH, initialHandState(BiometricPuzzleId.HAND_MATH), { target })
            expect(s.targetFingerCount).toBe(target)
            const [a, b] = (s.mathPrompt ?? '').split(' + ').map(Number)
            expect(a + b).toBe(target)
            expect(a).toBeGreaterThanOrEqual(1)
        }
    })

    it('ignores absent / out-of-range targets (keeps the client target)', () => {
        const base = initialHandState(BiometricPuzzleId.HAND_FINGER_COUNT)
        const before = base.targetFingerCount
        expect(applyServerTarget(BiometricPuzzleId.HAND_FINGER_COUNT, base, null).targetFingerCount).toBe(before)
        expect(applyServerTarget(BiometricPuzzleId.HAND_FINGER_COUNT, base, { target: 9 }).targetFingerCount).toBe(before)
        expect(applyServerTarget(BiometricPuzzleId.HAND_FINGER_COUNT, base, { target: 'x' }).targetFingerCount).toBe(before)
    })
})
