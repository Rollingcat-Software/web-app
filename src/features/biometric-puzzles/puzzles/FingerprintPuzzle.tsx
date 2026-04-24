/**
 * FingerprintPuzzle — wraps FingerprintStep for the playground.
 */
import { useCallback, useState } from 'react'
import FingerprintStep from '@features/auth/components/steps/FingerprintStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function FingerprintPuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <FingerprintStep onSubmit={handleSubmit} loading={loading} />
}
