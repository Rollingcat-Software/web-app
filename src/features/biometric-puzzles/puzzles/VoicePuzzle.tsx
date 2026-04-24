/**
 * VoicePuzzle — wraps VoiceStep for the Biometric Puzzle playground.
 */
import { useCallback, useState } from 'react'
import VoiceStep from '@features/auth/components/steps/VoiceStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function VoicePuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <VoiceStep onSubmit={handleSubmit} loading={loading} />
}
