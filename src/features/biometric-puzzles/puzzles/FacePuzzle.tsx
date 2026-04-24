/**
 * FacePuzzle — wraps FaceCaptureStep for the Biometric Puzzle playground.
 *
 * The wrapped step calls `onSubmit(image, embedding)` on capture. We map that
 * to the puzzle-level `onSuccess`. Errors come from the step's `error` prop
 * which we never populate in stub mode — `onError` stays silent.
 */
import { useCallback, useState } from 'react'
import FaceCaptureStep from '@features/auth/components/steps/FaceCaptureStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function FacePuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        // Mirror the real flow where the server takes a beat to verify.
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <FaceCaptureStep onSubmit={handleSubmit} loading={loading} />
}
