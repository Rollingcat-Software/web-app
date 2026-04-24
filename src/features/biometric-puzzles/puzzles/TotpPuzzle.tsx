/**
 * TotpPuzzle — wraps TotpStep. Any 6-digit code is accepted in stub mode.
 */
import { useCallback, useState } from 'react'
import TotpStep from '@features/auth/components/steps/TotpStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function TotpPuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <TotpStep onSubmit={handleSubmit} loading={loading} />
}
