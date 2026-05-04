/**
 * FACE enrollment dialog wrapper.
 *
 * Owns the post-capture pipeline: enrollFace -> createEnrollment ->
 * PUT /enrollments/FACE/complete -> snackbar. Behavior copied verbatim
 * from the inlined handler in EnrollmentPage.tsx (P1-Q7 decomposition).
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import FaceEnrollmentFlow from '../../../FaceEnrollmentFlow'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { getBiometricService } from '@core/services/BiometricService'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'
import type { ShowSnackbar } from '../../types'

interface Props {
    open: boolean
    userId: string
    tenantId: string
    onClose: () => void
    onEnrolled: () => void
    showSnackbar: ShowSnackbar
    setActionLoading: (val: AuthMethodType | null) => void
    createEnrollment: (input: { tenantId: string; methodType: AuthMethodType }) => Promise<unknown>
}

export default function FaceEnrollmentDialog({
    open,
    userId,
    tenantId,
    onClose,
    onEnrolled,
    showSnackbar,
    setActionLoading,
    createEnrollment,
}: Props) {
    const { t } = useTranslation()

    const handleComplete = useCallback(
        async (images: string[], clientEmbeddings?: (number[] | null)[]) => {
            if (!userId || images.length === 0) return
            setActionLoading(AuthMethodType.FACE)
            try {
                const biometric = getBiometricService()
                // Send all captured images — enrollFace will use /enroll/multi
                // for 2+ images (quality-weighted template fusion).
                // clientEmbeddings are 512-dim landmark-geometry vectors computed in-browser
                // via EmbeddingComputer (MediaPipe, log-only per D2). Server stores them for
                // offline analysis only — never used for auth decisions.
                await biometric.enrollFace(userId, images, tenantId, clientEmbeddings)

                // Create enrollment record and explicitly complete it (FACE is ASYNC_ENROLLMENT_TYPE)
                await createEnrollment({
                    tenantId: tenantId ?? 'system',
                    methodType: AuthMethodType.FACE,
                })
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                await httpClient.put(`/users/${userId}/enrollments/FACE/complete`, {})

                onClose()
                onEnrolled()
                showSnackbar(t('enrollmentPage.faceEnrolled'), 'success')
            } catch (err) {
                onClose()
                showSnackbar(formatApiError(err, t), 'error')
            } finally {
                setActionLoading(null)
            }
        },
        [userId, tenantId, createEnrollment, onClose, onEnrolled, showSnackbar, setActionLoading, t]
    )

    return (
        <FaceEnrollmentFlow
            open={open}
            onClose={onClose}
            onComplete={handleComplete}
        />
    )
}
