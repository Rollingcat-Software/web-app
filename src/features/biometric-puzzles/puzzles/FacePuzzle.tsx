/**
 * FacePuzzle (biometric-puzzles)
 *
 * Wraps FaceCaptureStep for the Biometric Puzzles page. Uses the real
 * biometric engine + real DependencyProvider from the app root (no stub DI)
 * so BlazeFace + MediaPipe detection actually runs during preview.
 *
 * Only the upstream HTTP verification call is stubbed: when the capture
 * succeeds we simulate a short server round-trip then report `onSuccess` to
 * the runner modal. Once the active-liveness surface lands (gesture-phase2
 * branch) this component will drive `BiometricPuzzle` from
 * `biometric-engine/core/BiometricPuzzle.ts` directly and report true
 * per-challenge pass/fail via `challengeType`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import FaceCaptureStep from '@features/auth/components/steps/FaceCaptureStep'
import type { BiometricPuzzleProps } from '../biometricPuzzleRegistry'

export default function FacePuzzle({ onSuccess }: BiometricPuzzleProps) {
    const [loading, setLoading] = useState(false)
    const timerRef = useRef<number | null>(null)

    useEffect(() => () => {
        if (timerRef.current != null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const handleSubmit = useCallback(() => {
        setLoading(true)
        // Mirror the real flow where the server takes a beat to verify.
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <FaceCaptureStep onSubmit={handleSubmit} loading={loading} />
}
