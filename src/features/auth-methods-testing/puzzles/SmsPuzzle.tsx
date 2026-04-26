/**
 * SmsPuzzle — wraps SmsOtpStep. `onSendOtp` is a no-op in stub mode; any
 * 6-digit code is accepted.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import SmsOtpStep from '@features/auth/components/steps/SmsOtpStep'
import type { AuthMethodProps } from '../authMethodRegistry'

export default function SmsPuzzle({ onSuccess }: AuthMethodProps) {
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

    const handleSendOtp = useCallback(() => {
        // No-op in puzzle mode — the stub backend has nothing to mail.
    }, [])

    return (
        <SmsOtpStep
            onSubmit={handleSubmit}
            onSendOtp={handleSendOtp}
            loading={loading}
        />
    )
}
