/**
 * VoicePuzzle — wraps the production `VoiceStep` and runs it against the REAL
 * `/biometric/voice/verify/{userId}` endpoint with the signed-in admin's JWT.
 *
 * The first attempt for an un-enrolled user auto-routes to
 * `/biometric/voice/enroll/{userId}` (Resemblyzer GE2E in production), and the
 * UI surfaces an info notice asking the user to retry — there is NO silent
 * "stub success" path.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import VoiceStep from '@features/auth/components/steps/VoiceStep'
import type { AuthMethodProps } from '../authMethodRegistry'
import { useAuthMethodPuzzleApi } from './useAuthMethodPuzzleApi'

export default function VoicePuzzle({ onSuccess, onError }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useAuthMethodPuzzleApi()
    const [loading, setLoading] = useState(false)
    const [stepError, setStepError] = useState<string | undefined>(undefined)

    const handleSubmit = useCallback(
        async (voiceData: string) => {
            setLoading(true)
            setStepError(undefined)
            const result = await api.submitVoice(voiceData, t)
            setLoading(false)
            if (result.kind === 'success') {
                onSuccess()
            } else if (result.kind === 'info') {
                // First-time enroll captured — the user must record again to verify
                // against the live template. Treat as a non-fatal error so the
                // modal's retry button reappears with the auto-enrolled message.
                setStepError(result.message)
                onError(result.message)
            } else {
                setStepError(result.message)
                onError(result.message)
            }
        },
        [api, t, onSuccess, onError],
    )

    return <VoiceStep onSubmit={handleSubmit} loading={loading} error={stepError} />
}
