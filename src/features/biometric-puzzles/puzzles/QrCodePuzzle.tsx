/**
 * QrCodePuzzle — wraps QrCodeStep. `onGenerateToken` returns a canned QR
 * payload that expires in 120s; any submitted token completes the puzzle.
 */
import { useCallback, useState } from 'react'
import QrCodeStep from '@features/auth/components/steps/QrCodeStep'
import type { PuzzleProps } from '../puzzleRegistry'

const STUB_QR_EXPIRES_IN_SECONDS = 120

export default function QrCodePuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleGenerateToken = useCallback(async (_userId: string) => {
        // Deterministic payload so tests can assert on a known value if needed.
        return {
            token: `puzzle-qr-${Math.random().toString(36).slice(2, 10)}`,
            expiresInSeconds: STUB_QR_EXPIRES_IN_SECONDS,
        }
    }, [])

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
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
