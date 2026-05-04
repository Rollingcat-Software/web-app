/**
 * TOTP enrollment dialog wrapper.
 *
 * On the inner TotpEnrollment dialog's onSuccess: create the user_enrollments
 * row and explicitly mark it ENROLLED (TOTP is NOT in AUTO_COMPLETE_TYPES on
 * the server, so startEnrollment returns PENDING). The dialog has already
 * verified the code and persisted the encrypted secret on /totp/verify-setup.
 *
 * Behavior copied verbatim from the inlined handler in EnrollmentPage.tsx (P1-Q7).
 */
import { useTranslation } from 'react-i18next'
import TotpEnrollment from '../../../TotpEnrollment'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
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

export default function TotpEnrollmentDialog({
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
        <TotpEnrollment
            open={open}
            userId={userId}
            onClose={onClose}
            onSuccess={async () => {
                onClose()
                // TOTP is NOT in AUTO_COMPLETE_TYPES on the server, so startEnrollment
                // returns PENDING. The dialog has already verified the code and
                // persisted the encrypted secret on /totp/verify-setup, so we
                // must explicitly mark the user_enrollments row ENROLLED here —
                // otherwise the page keeps showing "not enrolled" even though
                // the secret is good and EnrollmentHealthService.hasTotpSecret
                // would return true.
                try {
                    await createEnrollment({
                        tenantId: tenantId ?? 'system',
                        methodType: AuthMethodType.TOTP,
                    })
                    const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                    await httpClient.put(`/users/${userId}/enrollments/TOTP/complete`, {})
                } catch {
                    // secret is already persisted server-side; bookkeeping retry will fix it
                }
                onEnrolled()
                showSnackbar(
                    t('enrollmentPage.enrolledSuccess', { method: t('enrollmentPage.methods.TOTP.label') }),
                    'success',
                )
            }}
        />
    )
}
