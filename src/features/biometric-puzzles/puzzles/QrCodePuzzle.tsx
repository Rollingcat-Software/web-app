/**
 * QrCodePuzzle — wraps QrCodeStep. `onGenerateToken` returns a canned QR
 * payload that expires in 120s; any submitted token completes the puzzle.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import QrCodeStep from '@features/auth/components/steps/QrCodeStep'
import type { PuzzleProps } from '../puzzleRegistry'

const STUB_QR_EXPIRES_IN_SECONDS = 120

export default function QrCodePuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)
    const timerRef = useRef<number | null>(null)

    useEffect(() => () => {
        if (timerRef.current != null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const handleGenerateToken = useCallback(async (_userId: string) => {
        // Ephemeral per-run stub token — regenerated on every call so each
        // playground run sees a fresh value. Not meant to be deterministic.
        return {
            token: `puzzle-qr-${Math.random().toString(36).slice(2, 10)}`,
            expiresInSeconds: STUB_QR_EXPIRES_IN_SECONDS,
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

    return (
        <QrCodeStep
            userId="stub-user-1"
            onGenerateToken={handleGenerateToken}
            onSubmit={handleSubmit}
            loading={loading}
        />
    )
}
