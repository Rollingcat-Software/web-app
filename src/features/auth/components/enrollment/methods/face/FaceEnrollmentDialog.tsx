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
import { isClientSideEmbeddingEnabled } from '@features/biometrics/embedding/clientEmbeddingFlag'
import { embedCapturedFace } from '@features/biometrics/embedding/embedCapturedFace'
import type { NormalizedLandmark } from '@/lib/biometric-engine/types'
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
    /**
     * When true, this capture is a "re-enroll & optimize" — submitted to the
     * backend with optimize=true so the new sample is FUSED into the existing
     * face template (centroid update) instead of replacing it. Default false
     * (first-time enroll). See useEnrollmentDispatcher.reEnrollMode.
     */
    optimize?: boolean
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
    optimize = false,
}: Props) {
    const { t } = useTranslation()

    const handleComplete = useCallback(
        async (images: string[], clientEmbeddings?: (number[] | null)[], captureLandmarks?: (NormalizedLandmark[] | null)[]) => {
            if (!userId || images.length === 0) return
            setActionLoading(AuthMethodType.FACE)
            try {
                const biometric = getBiometricService()
                if (isClientSideEmbeddingEnabled()) {
                    // Client-side-embedding ON: compute the Facenet512 embedding for the best
                    // frontal capture (index 0 = the centered 'position' frame) entirely in the
                    // browser and submit ONLY the vector — the raw image never leaves the device.
                    // The captured 478-pt mesh is threaded so the embedder ALIGNS the face (eyes →
                    // canonical) first, the same as the verify probe → enroll and verify share one
                    // aligned space (audit H2). GPU-LESS ENFORCEMENT: the CPU-only server 400s the
                    // image path when its flag is on, so a null embedding must NOT fall back to an
                    // image upload — surface a retryable error instead (mirrors MfaStepRenderer).
                    // NOTE: optimize/template-fusion is not yet supported on the embedding enroll
                    // route; a re-enroll replaces the template.
                    const frontalImage = images[0]
                    const frontalLandmarks = captureLandmarks?.[0] ?? undefined
                    const embedding = await embedCapturedFace(frontalImage, frontalLandmarks ?? undefined)
                    if (!embedding) {
                        // On-device prep failed — retryable, never upload the image while the flag is on.
                        onClose()
                        showSnackbar(t('enrollmentPage.faceClientPrepFailed'), 'error')
                        return
                    }
                    await biometric.enrollFaceEmbedding(userId, embedding, tenantId)
                } else {
                    // Flag OFF: legacy image upload, byte-identical to before.
                    // Send all captured images — enrollFace will use /enroll/multi
                    // for 2+ images (quality-weighted template fusion).
                    // clientEmbeddings are 512-dim landmark-geometry vectors computed in-browser
                    // via EmbeddingComputer (MediaPipe, log-only per D2). Server stores them for
                    // offline analysis only — never used for auth decisions.
                    await biometric.enrollFace(userId, images, tenantId, clientEmbeddings, optimize)
                }

                // Create enrollment record and explicitly complete it (FACE is ASYNC_ENROLLMENT_TYPE)
                await createEnrollment({
                    tenantId: tenantId ?? 'system',
                    methodType: AuthMethodType.FACE,
                })
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                await httpClient.put(`/users/${userId}/enrollments/FACE/complete`, {})

                onClose()
                onEnrolled()
                showSnackbar(
                    t(optimize ? 'enrollmentPage.faceReEnrolled' : 'enrollmentPage.faceEnrolled'),
                    'success',
                )
            } catch (err) {
                onClose()
                showSnackbar(formatApiError(err, t), 'error')
            } finally {
                setActionLoading(null)
            }
        },
        [userId, tenantId, createEnrollment, onClose, onEnrolled, showSnackbar, setActionLoading, t, optimize]
    )

    return (
        <FaceEnrollmentFlow
            open={open}
            onClose={onClose}
            onComplete={handleComplete}
        />
    )
}
