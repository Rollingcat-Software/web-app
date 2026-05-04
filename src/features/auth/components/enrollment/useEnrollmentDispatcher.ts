/**
 * useEnrollmentDispatcher
 *
 * State machine for which enrollment dialog/phase is currently open and the
 * three top-level user actions: Enroll, Test, Revoke. Pulled out of
 * EnrollmentPage.tsx during P1-Q7 decomposition.
 *
 * Behavior is unchanged from the inlined version — only the file boundary moved.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'
import type { ShowSnackbar } from './types'

export type WebAuthnMode = 'platform' | 'hardware-key'
export type SmsPhase = 'phone' | 'otp' | null

interface CreateEnrollmentInput {
    tenantId: string
    methodType: AuthMethodType
}

interface Args {
    userId: string
    tenantId: string
    hasPhoneNumber: boolean
    refetchEnrollments: () => void
    revokeEnrollment: (type: AuthMethodType) => Promise<unknown>
    createEnrollment: (input: CreateEnrollmentInput) => Promise<unknown>
    showSnackbar: ShowSnackbar
}

export function useEnrollmentDispatcher({
    userId,
    tenantId,
    hasPhoneNumber,
    refetchEnrollments,
    revokeEnrollment,
    createEnrollment,
    showSnackbar,
}: Args) {
    const { t } = useTranslation()

    // Open-dialog flags
    const [faceEnrollOpen, setFaceEnrollOpen] = useState(false)
    const [totpEnrollOpen, setTotpEnrollOpen] = useState(false)
    const [webauthnEnrollOpen, setWebauthnEnrollOpen] = useState(false)
    const [webauthnMode, setWebauthnMode] = useState<WebAuthnMode>('hardware-key')
    const [voiceEnrollOpen, setVoiceEnrollOpen] = useState(false)
    const [nfcEnrollOpen, setNfcEnrollOpen] = useState(false)
    const [smsPhase, setSmsPhase] = useState<SmsPhase>(null)
    // Copilot review on PR #69: actionLoading is only ever assigned an
    // AuthMethodType value or null — narrow the type to keep the contract
    // consistent with consumers and prevent accidental string mismatches.
    const [actionLoading, setActionLoading] = useState<AuthMethodType | null>(null)

    const handleEnroll = useCallback(
        async (type: AuthMethodType) => {
            switch (type) {
                case AuthMethodType.FACE:
                    setFaceEnrollOpen(true)
                    break
                case AuthMethodType.FINGERPRINT:
                    setWebauthnMode('platform')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.HARDWARE_KEY:
                    setWebauthnMode('hardware-key')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.TOTP:
                    setTotpEnrollOpen(true)
                    break
                case AuthMethodType.VOICE:
                    setVoiceEnrollOpen(true)
                    break
                case AuthMethodType.SMS_OTP: {
                    if (!hasPhoneNumber) {
                        setSmsPhase('phone')
                        return
                    }
                    // Real verify-before-enroll: ask the API to send an OTP, then open
                    // the verification dialog. Only after /otp/sms/verify succeeds do
                    // we mark the enrollment complete. Backend no longer auto-completes
                    // SMS_OTP on startEnrollment (was the source of the silent-success bug).
                    setActionLoading(type)
                    try {
                        await createEnrollment({ tenantId, methodType: type })
                        const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                        await httpClient.post(`/otp/sms/send/${userId}`, {})
                        setSmsPhase('otp')
                    } catch (err) {
                        showSnackbar(formatApiError(err, t), 'error')
                    } finally {
                        setActionLoading(null)
                    }
                    break
                }
                case AuthMethodType.EMAIL_OTP:
                    // EMAIL_OTP is auto-bound at registration; the API auto-creates
                    // an ENROLLED row in getUserEnrollments. Just refetch.
                    refetchEnrollments()
                    showSnackbar(
                        t('enrollmentPage.enrolledSuccess', {
                            method: t('enrollmentPage.methods.EMAIL_OTP.label'),
                        }),
                        'success',
                    )
                    break
                case AuthMethodType.QR_CODE:
                    // QR_CODE is also auto-bound (no per-user secret). Refetch only.
                    refetchEnrollments()
                    showSnackbar(
                        t('enrollmentPage.enrolledSuccess', {
                            method: t('enrollmentPage.methods.QR_CODE.label'),
                        }),
                        'success',
                    )
                    break
                case AuthMethodType.NFC_DOCUMENT:
                    if ('NDEFReader' in window) {
                        setNfcEnrollOpen(true)
                    } else {
                        showSnackbar(t('mfa.nfc.notSupported'), 'warning')
                    }
                    break
                default:
                    showSnackbar(
                        t('enrollmentPage.notSupported', { method: t(`enrollmentPage.methods.${type}.label`) }),
                        'info',
                    )
            }
        },
        [createEnrollment, tenantId, hasPhoneNumber, userId, t, refetchEnrollments, showSnackbar]
    )

    const handleTest = useCallback(
        (type: AuthMethodType) => {
            switch (type) {
                case AuthMethodType.FACE:
                    setFaceEnrollOpen(true)
                    break
                case AuthMethodType.FINGERPRINT:
                    setWebauthnMode('platform')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.HARDWARE_KEY:
                    setWebauthnMode('hardware-key')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.TOTP:
                    setTotpEnrollOpen(true)
                    break
                case AuthMethodType.VOICE:
                    setVoiceEnrollOpen(true)
                    break
                case AuthMethodType.NFC_DOCUMENT:
                    if ('NDEFReader' in window) {
                        setNfcEnrollOpen(true)
                    } else {
                        showSnackbar(t('mfa.nfc.notSupported'), 'warning')
                    }
                    break
                case AuthMethodType.EMAIL_OTP:
                case AuthMethodType.SMS_OTP:
                case AuthMethodType.QR_CODE:
                    showSnackbar(
                        t('enrollmentPage.testHint', { method: t(`enrollmentPage.methods.${type}.label`) }),
                        'info',
                    )
                    break
            }
        },
        [t, showSnackbar]
    )

    const handleRevoke = useCallback(
        async (type: AuthMethodType) => {
            setActionLoading(type)
            try {
                await revokeEnrollment(type)
                showSnackbar(
                    t('enrollmentPage.revokeSuccess', { method: t(`enrollmentPage.methods.${type}.label`) }),
                    'success',
                )
            } catch (err) {
                showSnackbar(formatApiError(err, t), 'error')
            } finally {
                setActionLoading(null)
            }
        },
        [revokeEnrollment, t, showSnackbar]
    )

    return {
        // dialog flags
        faceEnrollOpen,
        setFaceEnrollOpen,
        totpEnrollOpen,
        setTotpEnrollOpen,
        webauthnEnrollOpen,
        setWebauthnEnrollOpen,
        webauthnMode,
        voiceEnrollOpen,
        setVoiceEnrollOpen,
        nfcEnrollOpen,
        setNfcEnrollOpen,
        smsPhase,
        setSmsPhase,
        actionLoading,
        setActionLoading,
        // actions
        handleEnroll,
        handleTest,
        handleRevoke,
    }
}
