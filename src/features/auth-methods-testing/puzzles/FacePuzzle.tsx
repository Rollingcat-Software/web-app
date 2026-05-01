/**
 * FacePuzzle — wraps the production `FaceCaptureStep` and runs it against the
 * REAL `/biometric/verify/{userId}` endpoint with the signed-in admin's JWT.
 *
 * USER-BUG-1 detection-gate is preserved: `FaceCaptureStep` blocks `captureImage`
 * unless `useFaceDetection` reports `detected=true` AND a bounding box.
 *
 * USER-BUG-5 (this fix): the previous wrapper called a 500 ms `setTimeout(onSuccess)`
 * with no server round-trip. It is replaced by a real verify call; `onSuccess` is
 * only invoked when the backend confirms `verified=true`. Cancellation or a
 * server-rejected verdict surfaces as an `onError`.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FaceCaptureStep from '@features/auth/components/steps/FaceCaptureStep'
import type { AuthMethodProps } from '../authMethodRegistry'
import { useAuthMethodPuzzleApi } from './useAuthMethodPuzzleApi'

export default function FacePuzzle({ onSuccess, onError }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useAuthMethodPuzzleApi()
    const [loading, setLoading] = useState(false)
    const [stepError, setStepError] = useState<string | undefined>(undefined)

    const handleSubmit = useCallback(
        async (image: string) => {
            setLoading(true)
            setStepError(undefined)
            const result = await api.submitFace(image, t)
            setLoading(false)
            if (result.kind === 'success') {
                onSuccess()
            } else {
                // Surface the message inline AND bubble to the modal so the
                // outer "Try again" button works whether the user dismissed
                // or the server rejected.
                setStepError(result.message)
                onError(result.message)
            }
        },
        [api, t, onSuccess, onError],
    )

    return <FaceCaptureStep onSubmit={handleSubmit} loading={loading} error={stepError} />
}
