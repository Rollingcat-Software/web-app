/**
 * NfcPuzzle — wraps NfcStep. Real NFC requires a physical reader and a
 * top-level browsing context, so in puzzle mode we simply capture the
 * serial number the user scanned (or fake-tapped) and report success.
 */
import { useCallback, useState } from 'react'
import NfcStep from '@features/auth/components/steps/NfcStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function NfcPuzzle({ onSuccess, onClose }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    return <NfcStep onSubmit={handleSubmit} loading={loading} onBack={onClose} />
}
