/**
 * HardwareKeyPuzzle — wraps HardwareKeyStep for the playground.
 * Real WebAuthn still runs in-browser; we just accept whatever the step
 * component hands back and report success.
 */
import { useCallback, useState } from 'react'
import HardwareKeyStep from '@features/auth/components/steps/HardwareKeyStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function HardwareKeyPuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <HardwareKeyStep onSubmit={handleSubmit} loading={loading} />
}
