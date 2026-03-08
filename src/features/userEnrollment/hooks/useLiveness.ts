import { useState, useCallback, useRef } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IUserEnrollmentService } from '@domain/interfaces/IUserEnrollmentService'
import type { LivenessChallenge, LivenessResult } from '@domain/models/UserEnrollment'

interface UseLivenessReturn {
    challenge: LivenessChallenge | null
    result: LivenessResult | null
    loading: boolean
    capturing: boolean
    error: string | null
    requestChallenge: () => Promise<void>
    performLiveness: (captureFrame: () => Blob | null) => Promise<LivenessResult | null>
    reset: () => void
}

export function useLiveness(): UseLivenessReturn {
    const service = useService<IUserEnrollmentService>(TYPES.UserEnrollmentService)

    const [challenge, setChallenge] = useState<LivenessChallenge | null>(null)
    const [result, setResult] = useState<LivenessResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef(false)

    const requestChallenge = useCallback(async () => {
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const ch = await service.requestLivenessChallenge()
            setChallenge(ch)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to request liveness challenge')
        } finally {
            setLoading(false)
        }
    }, [service])

    const performLiveness = useCallback(
        async (captureFrame: () => Blob | null): Promise<LivenessResult | null> => {
            if (!challenge) {
                setError('No active challenge. Request a challenge first.')
                return null
            }

            setCapturing(true)
            setError(null)
            abortRef.current = false

            try {
                // Capture frames at ~200ms intervals for ~3 seconds
                const frames: Blob[] = []
                const captureCount = 15
                const interval = 200

                for (let i = 0; i < captureCount; i++) {
                    if (abortRef.current) return null
                    const frame = captureFrame()
                    if (frame) {
                        frames.push(frame)
                    }
                    if (i < captureCount - 1) {
                        await new Promise((resolve) => setTimeout(resolve, interval))
                    }
                }

                if (frames.length === 0) {
                    setError('No frames captured. Please ensure your camera is working.')
                    return null
                }

                setCapturing(false)
                setLoading(true)

                const livenessResult = await service.verifyLiveness(challenge.challengeId, frames)
                setResult(livenessResult)
                return livenessResult
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Liveness verification failed')
                return null
            } finally {
                setCapturing(false)
                setLoading(false)
            }
        },
        [challenge, service]
    )

    const reset = useCallback(() => {
        abortRef.current = true
        setChallenge(null)
        setResult(null)
        setLoading(false)
        setCapturing(false)
        setError(null)
    }, [])

    return {
        challenge,
        result,
        loading,
        capturing,
        error,
        requestChallenge,
        performLiveness,
        reset,
    }
}
