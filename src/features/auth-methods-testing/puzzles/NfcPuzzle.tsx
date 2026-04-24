/**
 * NfcPuzzle — wraps NfcStep. Real NFC requires a physical reader and a
 * top-level browsing context, so in puzzle mode we simply capture the
 * serial number the user scanned (or fake-tapped) and report success.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import NfcStep from '@features/auth/components/steps/NfcStep'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function NfcPuzzle({ onSuccess, onClose }: AuthMethodProps) {
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

    return <NfcStep onSubmit={handleSubmit} loading={loading} onBack={onClose} />
}
