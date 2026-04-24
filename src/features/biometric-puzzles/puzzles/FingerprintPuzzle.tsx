/**
 * FingerprintPuzzle — wraps FingerprintStep for the playground.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import FingerprintStep from '@features/auth/components/steps/FingerprintStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function FingerprintPuzzle({ onSuccess }: PuzzleProps) {
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
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <FingerprintStep onSubmit={handleSubmit} loading={loading} />
}
