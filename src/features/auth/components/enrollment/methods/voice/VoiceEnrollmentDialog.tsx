/**
 * VOICE enrollment dialog wrapper.
 *
 * Inner dialog calls `onSuccess(action)` where action is 'enroll' | 'verify' | 'search'.
 * Only 'enroll' triggers the user_enrollments bookkeeping; the others are tests.
 *
 * Behavior copied verbatim from the inlined handler in EnrollmentPage.tsx (P1-Q7).
 */
import { useTranslation } from 'react-i18next'
import VoiceEnrollmentFlow from '../../../VoiceEnrollmentFlow'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { formatApiError } from '@utils/formatApiError'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ShowSnackbar } from '../../types'

interface Props {
    open: boolean
    userId: string
    tenantId: string
    apiBaseUrl: string
    token: string | null
    onClose: () => void
    onEnrolled: () => void
    showSnackbar: ShowSnackbar
    createEnrollment: (input: { tenantId: string; methodType: AuthMethodType }) => Promise<unknown>
    /**
     * When true, this capture is a "re-enroll & optimize" — submitted with
     * optimize=true so the new sample is FUSED into the existing voice template
     * (centroid update) instead of replacing it. Default false (first enroll).
     */
    optimize?: boolean
}

export default function VoiceEnrollmentDialog({
    open,
    userId,
    tenantId,
    apiBaseUrl,
    token,
    onClose,
    onEnrolled,
    showSnackbar,
    createEnrollment,
    optimize = false,
}: Props) {
    const { t } = useTranslation()

    return (
        <VoiceEnrollmentFlow
            open={open}
            userId={userId}
            apiBaseUrl={apiBaseUrl}
            token={token}
            optimize={optimize}
            onClose={onClose}
            onSuccess={async (action) => {
                if (action === 'enroll') {
                    try {
                        await createEnrollment({
                            tenantId: tenantId ?? 'system',
                            methodType: AuthMethodType.VOICE,
                        })
                        const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                        await httpClient.put(`/users/${userId}/enrollments/VOICE/complete`, {})
                        onEnrolled()
                        showSnackbar(
                            t(optimize ? 'enrollmentPage.voiceReEnrolled' : 'enrollmentPage.voiceEnrolled'),
                            'success',
                        )
                    } catch (err) {
                        // The voice biometric was captured successfully, but persisting
                        // the enrollment record failed. Refresh so the (possibly created)
                        // record is reflected, then surface the failure — never swallow it.
                        onEnrolled()
                        showSnackbar(
                            t('enrollmentPage.voiceEnrollRecordFailed', {
                                reason: formatApiError(err, t),
                            }),
                            'error',
                        )
                    }
                }
            }}
        />
    )
}
