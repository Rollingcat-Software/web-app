/**
 * SMS_OTP enrollment flow.
 *
 * Two-stage dialog:
 *  1. (optional) phone-number capture if user has no phone on file
 *  2. 6-digit OTP verification — until /otp/sms/verify succeeds the
 *     user_enrollments row stays PENDING. The auth-methods page only
 *     flips to "ENROLLED" once we PUT /enrollments/SMS_OTP/complete.
 *
 * Extracted from EnrollmentPage.tsx during P1-Q7 decomposition.
 * Behavior unchanged from the inlined version (phone normalize at submit
 * is intentional defense-in-depth against paste-overrides — see V54 / api PR #48).
 */
import { useCallback, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ISettingsService } from '@domain/interfaces/ISettingsService'
import { formatApiError } from '@utils/formatApiError'
import { isValidE164, normalizePhoneInputE164 } from '@utils/phoneNumber'
import type { ShowSnackbar } from '../../types'

interface UserShape {
    firstName?: string
    lastName?: string
    phoneNumber?: string | null
    tenantId?: string
}

interface CreateEnrollmentInput {
    tenantId: string
    methodType: AuthMethodType
}

interface Props {
    /** Phase: 'phone' opens the phone dialog first; 'otp' jumps straight to OTP entry. */
    phase: 'phone' | 'otp' | null
    userId: string
    user: UserShape
    onClose: () => void
    /** Fired after the phone dialog successfully saves + sends OTP — parent flips phase 'phone'->'otp'. */
    onPhoneSaved: () => void
    /** Fired after the OTP is verified and the enrollment is marked complete. */
    onEnrolled: () => void
    showSnackbar: ShowSnackbar
    createEnrollment: (input: CreateEnrollmentInput) => Promise<unknown>
}

export default function SmsOtpEnrollmentFlow({
    phase,
    userId,
    user,
    onClose,
    onPhoneSaved,
    onEnrolled,
    showSnackbar,
    createEnrollment,
}: Props) {
    const { t } = useTranslation()

    // Phone-capture dialog
    const [phoneInput, setPhoneInput] = useState('')
    const [phoneSaving, setPhoneSaving] = useState(false)

    // OTP-verify dialog
    const [smsOtpCode, setSmsOtpCode] = useState('')
    const [smsOtpSending, setSmsOtpSending] = useState(false)
    const [smsOtpVerifying, setSmsOtpVerifying] = useState(false)
    const [smsOtpError, setSmsOtpError] = useState<string | null>(null)

    const phoneOpen = phase === 'phone'
    const otpOpen = phase === 'otp'

    const closePhone = useCallback(() => {
        setPhoneInput('')
        onClose()
    }, [onClose])

    const closeOtp = useCallback(() => {
        if (smsOtpVerifying) return
        setSmsOtpCode('')
        setSmsOtpError(null)
        onClose()
    }, [smsOtpVerifying, onClose])

    const handlePhoneSubmit = useCallback(async () => {
        setPhoneSaving(true)
        try {
            // Save phone number to profile
            const settingsService = container.get<ISettingsService>(TYPES.SettingsService)
            await settingsService.updateProfile({
                firstName: user.firstName ?? '',
                lastName: user.lastName ?? '',
                // Defense-in-depth: re-normalize at submit so a paste override
                // cannot bypass the E.164 contract enforced by V54 / api PR #48.
                phoneNumber: normalizePhoneInputE164(phoneInput),
            })
            // Phone is saved — now start the real SMS OTP enrollment flow:
            // create the PENDING row, request an OTP, and open the verification
            // dialog. The row stays PENDING until the user enters a valid code.
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            await createEnrollment({
                tenantId: user.tenantId ?? 'system',
                methodType: AuthMethodType.SMS_OTP,
            })
            setSmsOtpError(null)
            setSmsOtpCode('')
            setSmsOtpSending(true)
            await httpClient.post(`/otp/sms/send/${userId}`, {})
            setPhoneInput('')
            // Phone dialog closes and parent flips to OTP phase.
            onPhoneSaved()
        } catch (err) {
            showSnackbar(formatApiError(err, t), 'error')
        } finally {
            setPhoneSaving(false)
            setSmsOtpSending(false)
        }
    }, [phoneInput, user, userId, t, showSnackbar, createEnrollment, onPhoneSaved])

    const handleResendOtp = useCallback(async () => {
        setSmsOtpError(null)
        setSmsOtpSending(true)
        try {
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            await httpClient.post(`/otp/sms/send/${userId}`, {})
            showSnackbar(t('enrollmentPage.smsOtpDialog.resentSuccess'), 'info')
        } catch (err) {
            setSmsOtpError(formatApiError(err, t))
        } finally {
            setSmsOtpSending(false)
        }
    }, [userId, t, showSnackbar])

    const handleVerifyOtp = useCallback(async () => {
        setSmsOtpVerifying(true)
        setSmsOtpError(null)
        try {
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            const verifyResp = await httpClient.post<{ success: boolean; message?: string }>(
                `/otp/sms/verify/${userId}`,
                { code: smsOtpCode },
            )
            if (!verifyResp.data?.success) {
                setSmsOtpError(verifyResp.data?.message || t('enrollmentPage.smsOtpDialog.invalidCode'))
                return
            }
            // Code verified — flip the user_enrollments row to ENROLLED
            await httpClient.put(`/users/${userId}/enrollments/SMS_OTP/complete`, {})
            setSmsOtpCode('')
            showSnackbar(
                t('enrollmentPage.enrolledSuccess', {
                    method: t('enrollmentPage.methods.SMS_OTP.label'),
                }),
                'success',
            )
            onEnrolled()
        } catch (err) {
            setSmsOtpError(formatApiError(err, t))
        } finally {
            setSmsOtpVerifying(false)
        }
    }, [userId, smsOtpCode, t, onEnrolled, showSnackbar])

    return (
        <>
            {/* Phone Number Dialog for SMS OTP */}
            <Dialog
                open={phoneOpen}
                onClose={closePhone}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{t('enrollmentPage.phoneDialog.title')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('enrollmentPage.phoneDialog.description')}
                    </Typography>
                    <TextField
                        fullWidth
                        label={t('enrollmentPage.phoneDialog.label')}
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(normalizePhoneInputE164(e.target.value))}
                        placeholder="+90 5XX XXX XX XX"
                        error={phoneInput.length > 0 && !isValidE164(phoneInput)}
                        helperText={
                            phoneInput.length > 0 && !isValidE164(phoneInput)
                                ? t('phoneNumber.e164Required')
                                : t('enrollmentPage.phoneDialog.helper')
                        }
                        disabled={phoneSaving}
                        autoFocus
                        inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={closePhone}
                        disabled={phoneSaving}
                    >
                        {t('enrollmentPage.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={phoneSaving || !isValidE164(phoneInput)}
                        startIcon={phoneSaving ? <CircularProgress size={16} /> : null}
                        onClick={handlePhoneSubmit}
                    >
                        {phoneSaving ? t('enrollmentPage.phoneDialog.saving') : t('enrollmentPage.phoneDialog.saveAndEnroll')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* SMS OTP verification dialog */}
            <Dialog
                open={otpOpen}
                onClose={closeOtp}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{t('enrollmentPage.smsOtpDialog.title')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('enrollmentPage.smsOtpDialog.description', { phone: user.phoneNumber ?? '' })}
                    </Typography>
                    {smsOtpError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {smsOtpError}
                        </Alert>
                    )}
                    <TextField
                        fullWidth
                        autoFocus
                        label={t('enrollmentPage.smsOtpDialog.codeLabel')}
                        value={smsOtpCode}
                        onChange={(e) => setSmsOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        disabled={smsOtpVerifying}
                        inputProps={{
                            maxLength: 6,
                            inputMode: 'numeric',
                            style: {
                                textAlign: 'center',
                                fontSize: '1.4rem',
                                letterSpacing: '0.4em',
                                fontWeight: 700,
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleResendOtp}
                        disabled={smsOtpVerifying || smsOtpSending}
                    >
                        {smsOtpSending ? <CircularProgress size={16} /> : t('enrollmentPage.smsOtpDialog.resend')}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                        onClick={closeOtp}
                        disabled={smsOtpVerifying}
                    >
                        {t('enrollmentPage.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={smsOtpVerifying || smsOtpCode.length !== 6}
                        startIcon={smsOtpVerifying ? <CircularProgress size={16} /> : null}
                        onClick={handleVerifyOtp}
                    >
                        {t('enrollmentPage.smsOtpDialog.verify')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
