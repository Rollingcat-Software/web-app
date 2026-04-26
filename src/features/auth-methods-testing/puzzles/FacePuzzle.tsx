/**
 * FacePuzzle — wraps FaceCaptureStep for the Biometric Puzzle playground.
 *
 * The wrapped step calls `onSubmit(image, embedding)` on capture. We map that
 * to the puzzle-level `onSuccess`. Errors come from the step's `error` prop
 * which we never populate in stub mode — `onError` stays silent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import FaceCaptureStep from '@features/auth/components/steps/FaceCaptureStep'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function FacePuzzle({ onSuccess }: AuthMethodProps) {
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
