/**
 * SmsPuzzle — wraps SmsOtpStep. `onSendOtp` is a no-op in stub mode; any
 * 6-digit code is accepted.
 */
import { useCallback, useState } from 'react'
import SmsOtpStep from '@features/auth/components/steps/SmsOtpStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function SmsPuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
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
