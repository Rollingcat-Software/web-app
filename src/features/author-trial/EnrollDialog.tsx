/**
 * One-time trial enrollment for a pseudonymous participant.
 *
 * Reuses the production FACE capture (`FaceEnrollmentFlow`) and computes the
 * Facenet512 embedding in the browser with `embedCapturedFace`; ONLY the
 * 512-number vector is posted to `/author-trial/enroll`. The raw face image
 * never leaves the device. Client-side embedding is mandatory for the trial:
 * with the build flag OFF the page shows a configuration error instead of
 * silently falling back to an image upload.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, CircularProgress, Dialog, DialogContent, Stack, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthorTrialRepository } from '@domain/interfaces/IAuthorTrialRepository'
import FaceEnrollmentFlow from '@features/auth/components/FaceEnrollmentFlow'
import { isClientSideEmbeddingEnabled } from '@features/biometrics/embedding/clientEmbeddingFlag'
import { embedCapturedFace } from '@features/biometrics/embedding/embedCapturedFace'
import type { NormalizedLandmark } from '@/lib/biometric-engine/types'
import { formatApiError } from '@utils/formatApiError'
import { webVersion } from './protocol'

export interface EnrollDialogProps {
    open: boolean
    accessCode: string
    participantCode: string
    onClose: () => void
    /** Called after the server accepted the enrollment (refresh the codes). */
    onEnrolled: () => void
}

/** identity's 409 for an image-based enrollment in ENFORCE mode. */
function isTrialImageRequired(error: unknown): boolean {
    const data = (error as { response?: { status?: number; data?: Record<string, unknown> } } | null)?.response
    if (!data || data.status !== 409) return false
    const body = data.data ?? {}
    return (
        body.code === 'TRIAL_ENROLL_IMAGE_REQUIRED' ||
        body.errorCode === 'TRIAL_ENROLL_IMAGE_REQUIRED' ||
        body.error_code === 'TRIAL_ENROLL_IMAGE_REQUIRED' ||
        body.code === 'FACE_IMAGE_REQUIRED'
    )
}

export default function EnrollDialog({
    open,
    accessCode,
    participantCode,
    onClose,
    onEnrolled,
}: EnrollDialogProps) {
    const { t } = useTranslation()
    const { enqueueSnackbar } = useSnackbar()
    const repository = useService<IAuthorTrialRepository>(TYPES.AuthorTrialRepository)
    const [busy, setBusy] = useState(false)

    const handleComplete = useCallback(
        async (
            images: string[],
            _clientEmbeddings?: (number[] | null)[],
            captureLandmarks?: (NormalizedLandmark[] | null)[],
        ) => {
            if (busy) return
            if (!isClientSideEmbeddingEnabled()) {
                enqueueSnackbar(t('authorTrial.enrollConfigError'), { variant: 'error' })
                return
            }
            const frontalImage = images[0]
            if (!frontalImage) return
            setBusy(true)
            try {
                const embedding = await embedCapturedFace(
                    frontalImage,
                    captureLandmarks?.[0] ?? undefined,
                )
                if (!embedding) {
                    enqueueSnackbar(t('authorTrial.enrollPrepFailed'), { variant: 'error' })
                    return
                }
                await repository.enroll(accessCode, {
                    participantCode,
                    embedding,
                    webVersion: webVersion(),
                })
                enqueueSnackbar(t('authorTrial.enrollSuccess', { code: participantCode }), {
                    variant: 'success',
                })
                onEnrolled()
                onClose()
            } catch (error) {
                enqueueSnackbar(
                    isTrialImageRequired(error)
                        ? t('authorTrial.enrollImageRequired')
                        : formatApiError(error, t),
                    { variant: 'error' },
                )
            } finally {
                setBusy(false)
            }
        },
        [accessCode, busy, enqueueSnackbar, onClose, onEnrolled, participantCode, repository, t],
    )

    if (!isClientSideEmbeddingEnabled()) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogContent>
                    <Stack spacing={2}>
                        <Alert severity="error">{t('authorTrial.enrollConfigError')}</Alert>
                        <Typography variant="body2" color="text.secondary">
                            {t('authorTrial.enrollConfigErrorHint')}
                        </Typography>
                        <Button variant="contained" onClick={onClose}>
                            {t('authorTrial.close')}
                        </Button>
                    </Stack>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <>
            <FaceEnrollmentFlow
                open={open}
                onClose={onClose}
                onComplete={(images, embeddings, landmarks) => {
                    void handleComplete(images, embeddings, landmarks)
                }}
            />
            {busy && (
                <Dialog open maxWidth="xs">
                    <DialogContent>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <CircularProgress size={22} />
                            <Typography>{t('authorTrial.enrollWorking')}</Typography>
                        </Stack>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}