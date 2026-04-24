/**
 * TotpPuzzle — wraps TotpStep. Any 6-digit code is accepted in stub mode.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import TotpStep from '@features/auth/components/steps/TotpStep'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function TotpPuzzle({ onSuccess }: AuthMethodProps) {
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

    return <TotpStep onSubmit={handleSubmit} loading={loading} />
}
