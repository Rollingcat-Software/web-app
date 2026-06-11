/**
 * WebAuthn enrollment dialog wrapper. Used for FINGERPRINT (platform
 * authenticator), HARDWARE_KEY (roaming authenticator), and PASSKEY
 * (discoverable / resident credential — usernameless sign-in) — `mode` selects
 * which one we're enrolling.
 *
 * Behavior copied verbatim from the inlined handler in EnrollmentPage.tsx (P1-Q7),
 * extended with the `passkey` mode (2026-06-02): the registration ceremony itself
 * lives in WebAuthnEnrollment; here we only map `mode` → the AuthMethodType whose
 * enrollment row we mark ENROLLED on success.
 */
import { useTranslation } from 'react-i18next'
import WebAuthnEnrollment from '../../../WebAuthnEnrollment'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ShowSnackbar } from '../../types'

type WebAuthnDialogMode = 'platform' | 'hardware-key' | 'passkey'

interface Props {
    open: boolean
    userId: string
    tenantId: string
    mode: WebAuthnDialogMode
    onClose: () => void
    onEnrolled: () => void
    showSnackbar: ShowSnackbar
    createEnrollment: (input: { tenantId: string; methodType: AuthMethodType }) => Promise<unknown>
}

/** Map the WebAuthn registration `mode` to the AuthMethodType it enrolls. */
function methodTypeForMode(mode: WebAuthnDialogMode): AuthMethodType {
    switch (mode) {
        case 'platform':
            return AuthMethodType.FINGERPRINT
        case 'passkey':
            return AuthMethodType.PASSKEY
        case 'hardware-key':
        default:
            return AuthMethodType.HARDWARE_KEY
    }
}

/** i18n key for the method label used in the success snackbar. */
function methodLabelKeyForMode(mode: WebAuthnDialogMode): string {
    switch (mode) {
        case 'platform':
            return 'enrollmentPage.methods.FINGERPRINT.label'
        case 'passkey':
            return 'enrollmentPage.methods.PASSKEY.label'
        case 'hardware-key':
        default:
            return 'enrollmentPage.methods.HARDWARE_KEY.label'
    }
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
                const methodType = methodTypeForMode(mode)
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
                        method: t(methodLabelKeyForMode(mode)),
                    }),
                    'success',
                )
            }}
        />
    )
}
