/**
 * VoicePuzzle — wraps VoiceStep for the Biometric Puzzle playground.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import VoiceStep from '@features/auth/components/steps/VoiceStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function VoicePuzzle({ onSuccess }: PuzzleProps) {
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

    return <VoiceStep onSubmit={handleSubmit} loading={loading} />
}
