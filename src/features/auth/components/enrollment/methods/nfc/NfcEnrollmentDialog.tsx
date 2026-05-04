/**
 * NFC_DOCUMENT enrollment dialog wrapper.
 *
 * The backend NfcController.enrollCard() now auto-creates the enrollment
 * record (NFC_DOCUMENT is in AUTO_COMPLETE_TYPES), but we also call
 * createEnrollment as a safety net in case the backend auto-create failed.
 *
 * Behavior copied verbatim from the inlined handler in EnrollmentPage.tsx (P1-Q7).
 */
import { useTranslation } from 'react-i18next'
import NfcEnrollment from '../../../NfcEnrollment'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { ShowSnackbar } from '../../types'

interface Props {
    open: boolean
    userId: string
    tenantId: string
    onClose: () => void
    onEnrolled: () => void
    showSnackbar: ShowSnackbar
    createEnrollment: (input: { tenantId: string; methodType: AuthMethodType }) => Promise<unknown>
}

export default function NfcEnrollmentDialog({
    open,
    userId,
    tenantId,
    onClose,
    onEnrolled,
    showSnackbar,
    createEnrollment,
}: Props) {
    const { t } = useTranslation()

    return (
        <NfcEnrollment
            open={open}
            userId={userId}
            onClose={onClose}
            onSuccess={async () => {
                // The backend auto-creates the enrollment record; this is a safety net.
                try {
                    await createEnrollment({
                        tenantId: tenantId ?? 'system',
                        methodType: AuthMethodType.NFC_DOCUMENT,
                    })
                } catch {
                    /* ignore — backend already created it */
                }
                onClose()
                onEnrolled()
                showSnackbar(
                    t('enrollmentPage.enrolledSuccess', {
                        method: t('enrollmentPage.methods.NFC_DOCUMENT.label'),
                    }),
                    'success',
                )
            }}
        />
    )
}
