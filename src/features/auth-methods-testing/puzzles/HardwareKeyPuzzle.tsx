/**
 * HardwareKeyPuzzle — wraps HardwareKeyStep for the playground.
 * Real WebAuthn still runs in-browser; we just accept whatever the step
 * component hands back and report success.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import HardwareKeyStep from '@features/auth/components/steps/HardwareKeyStep'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function HardwareKeyPuzzle({ onSuccess }: AuthMethodProps) {
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

    return <HardwareKeyStep onSubmit={handleSubmit} loading={loading} />
}
