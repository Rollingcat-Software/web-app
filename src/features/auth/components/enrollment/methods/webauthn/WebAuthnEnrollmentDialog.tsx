/**
 * WebAuthn enrollment dialog wrapper. Used for both FINGERPRINT (platform
 * authenticator) and HARDWARE_KEY (roaming authenticator) — `mode` selects
 * which one we're enrolling.
 *
 * Behavior copied verbatim from the inlined handler in EnrollmentPage.tsx (P1-Q7).
 */
import { useTranslation } from 'react-i18next'
import WebAuthnEnrollment from '../../../WebAuthnEnrollment'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ShowSnackbar } from '../../types'

interface Props {
    open: boolean
    userId: string
    tenantId: string
    mode: 'platform' | 'hardware-key'
    onClose: () => void
    onEnrolled: () => void
    showSnackbar: ShowSnackbar
    createEnrollment: (input: { tenantId: string; methodType: AuthMethodType }) => Promise<unknown>
}

export default function WebAuthnEnrollmentDialog({
    open,
    userId,
    tenantId,
    mode,
    onClose,
    onEnrolled,
    showSnackbar,
    createEnrollment,
}: Props) {
    const { t } = useTranslation()

    return (
        <WebAuthnEnrollment
            open={open}
            userId={userId}
            mode={mode}
            onClose={onClose}
            onSuccess={async () => {
                const methodType = mode === 'platform' ? AuthMethodType.FINGERPRINT : AuthMethodType.HARDWARE_KEY
                onClose()
                try {
                    await createEnrollment({
                        tenantId: tenantId ?? 'system',
                        methodType,
                    })
                    // Mark enrollment as ENROLLED (wait before refetch)
                    const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                    await httpClient.put(`/users/${userId}/enrollments/${methodType}/complete`, {})
                } catch {
                    // ignore — credential is saved in WebAuthn store regardless
                }
                onEnrolled()
                showSnackbar(
                    t('enrollmentPage.enrolledSuccess', {
                        method:
                            methodType === AuthMethodType.FINGERPRINT
                                ? t('enrollmentPage.methods.FINGERPRINT.label')
                                : t('enrollmentPage.methods.HARDWARE_KEY.label'),
                    }),
                    'success',
                )
            }}
        />
    )
}
