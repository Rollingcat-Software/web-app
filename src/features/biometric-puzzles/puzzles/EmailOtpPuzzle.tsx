/**
 * EmailOtpPuzzle — wraps EmailOtpStep (the enrollment variant with the same
 * UX contract as SMS). We deliberately avoid EmailOtpMfaStep here because it
 * reaches into InversifyJS for an HttpClient + AuthRepository and hits
 * `/auth/mfa/send-otp` on mount — which has no meaning in the playground.
 */
import { useCallback, useState } from 'react'
import EmailOtpStep from '@features/auth/components/steps/EmailOtpStep'
import type { PuzzleProps } from '../puzzleRegistry'

export default function EmailOtpPuzzle({ onSuccess }: PuzzleProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = useCallback(() => {
        setLoading(true)
        window.setTimeout(() => {
            setLoading(false)
            onSuccess()
        }, 500)
    }, [onSuccess])

    const handleSendOtp = useCallback(() => {
        // No-op in puzzle mode.
    }, [])

    return (
        <EmailOtpStep
            onSubmit={handleSubmit}
            onSendOtp={handleSendOtp}
            loading={loading}
        />
    )
}
