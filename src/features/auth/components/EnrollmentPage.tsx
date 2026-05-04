/**
 * EnrollmentPage — biometric and MFA enrollment management.
 *
 * Decomposed during P1-Q7 (QUALITY_REVIEW_2026-05-01 §T4.2). The page is now a
 * thin router/dispatcher that:
 *   1. detects device capabilities (`useDeviceCapabilities`)
 *   2. fetches the user's enrollments + access token
 *   3. delegates the open-dialog state machine to `useEnrollmentDispatcher`
 *   4. renders the catalog grid + NFC cards section + per-method dialogs
 *
 * Per-method enrollment pipelines live under `./enrollment/methods/{...}/`.
 * Behavior is unchanged from the previous monolithic file.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, CircularProgress, Snackbar } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useUserEnrollments } from '@features/enrollments/hooks/useEnrollments'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { EnrollmentStatus } from '@domain/models/Enrollment'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { config as envConfig } from '@config/env'

import type { MethodCardConfig, SnackbarState } from './enrollment/types'
import { METHOD_CONFIGS } from './enrollment/methodConfigs'
import { useDeviceCapabilities } from './enrollment/useDeviceCapabilities'
import { useEnrollmentDispatcher } from './enrollment/useEnrollmentDispatcher'
import EnrollmentPageHeader from './enrollment/sections/EnrollmentPageHeader'
import MethodCardsGrid from './enrollment/sections/MethodCardsGrid'
import NfcCardsList from './enrollment/sections/NfcCardsList'
import FaceEnrollmentDialog from './enrollment/methods/face/FaceEnrollmentDialog'
import TotpEnrollmentDialog from './enrollment/methods/totp/TotpEnrollmentDialog'
import WebAuthnEnrollmentDialog from './enrollment/methods/webauthn/WebAuthnEnrollmentDialog'
import VoiceEnrollmentDialog from './enrollment/methods/voice/VoiceEnrollmentDialog'
import NfcEnrollmentDialog from './enrollment/methods/nfc/NfcEnrollmentDialog'
import SmsOtpEnrollmentFlow from './enrollment/methods/sms/SmsOtpEnrollmentFlow'

export default function EnrollmentPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const userId = user?.id ?? ''
    const tenantId = user?.tenantId ?? 'system'

    const {
        enrollments,
        loading: enrollmentsLoading,
        refetch: refetchEnrollments,
        createEnrollment,
        revokeEnrollment,
    } = useUserEnrollments(userId)

    const { capabilities, loading: capsLoading } = useDeviceCapabilities()

    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'info' })

    const showSnackbar = useCallback(
        (message: string, severity: SnackbarState['severity']) =>
            setSnackbar({ open: true, message, severity }),
        []
    )

    // Fetch access token for voice endpoints
    useEffect(() => {
        const tokenService = container.get<ITokenService>(TYPES.TokenService)
        tokenService.getAccessToken().then(setAccessToken).catch((e) => {
            // Voice endpoints will fall back to unauthenticated mode; log so we can diagnose later.
            console.error('EnrollmentPage: failed to fetch access token for voice endpoints', e)
        })
    }, [])

    // Build enrollment status map
    const enrollmentMap = useMemo(() => {
        const map = new Map<string, { status: EnrollmentStatus; id: string }>()
        for (const enrollment of enrollments) {
            if (enrollment.authMethodType) {
                map.set(enrollment.authMethodType, {
                    status: enrollment.status,
                    id: enrollment.id,
                })
            }
        }
        return map
    }, [enrollments])

    const isMethodEnrolled = useCallback(
        (type: AuthMethodType) => {
            const entry = enrollmentMap.get(type)
            return entry?.status === EnrollmentStatus.ENROLLED || entry?.status === EnrollmentStatus.SUCCESS
        },
        [enrollmentMap]
    )

    const isMethodAvailable = useCallback(
        (config: MethodCardConfig) => {
            if (config.alwaysAvailable) return true
            if (config.capabilityKey === null) return true
            return capabilities[config.capabilityKey] === true
        },
        [capabilities]
    )

    const dispatcher = useEnrollmentDispatcher({
        userId,
        tenantId,
        hasPhoneNumber: !!user?.phoneNumber,
        refetchEnrollments,
        revokeEnrollment,
        createEnrollment,
        showSnackbar,
    })

    const loading = enrollmentsLoading || capsLoading

    if (!user) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">{t('enrollmentPage.loginRequired')}</Alert>
            </Box>
        )
    }

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 } }}>
            <EnrollmentPageHeader
                enrolledCount={enrollments.filter((e) => e.isSuccessful()).length}
                unavailableCount={METHOD_CONFIGS.filter((c) => !isMethodAvailable(c)).length}
                loading={loading}
                onRefresh={refetchEnrollments}
            />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <MethodCardsGrid
                    isMethodEnrolled={isMethodEnrolled}
                    isMethodAvailable={isMethodAvailable}
                    actionLoading={dispatcher.actionLoading}
                    onEnroll={dispatcher.handleEnroll}
                    onTest={dispatcher.handleTest}
                    onRevoke={dispatcher.handleRevoke}
                />
            )}

            {isMethodEnrolled(AuthMethodType.NFC_DOCUMENT) && userId && (
                <NfcCardsList
                    userId={userId}
                    refreshKey={enrollmentMap}
                    showSnackbar={showSnackbar}
                />
            )}

            {/* Per-method enrollment dialogs */}
            <FaceEnrollmentDialog
                open={dispatcher.faceEnrollOpen}
                userId={userId}
                tenantId={tenantId}
                onClose={() => dispatcher.setFaceEnrollOpen(false)}
                onEnrolled={refetchEnrollments}
                showSnackbar={showSnackbar}
                setActionLoading={dispatcher.setActionLoading}
                createEnrollment={createEnrollment}
            />
            <TotpEnrollmentDialog
                open={dispatcher.totpEnrollOpen}
                userId={userId}
                tenantId={tenantId}
                onClose={() => dispatcher.setTotpEnrollOpen(false)}
                onEnrolled={refetchEnrollments}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />
            <WebAuthnEnrollmentDialog
                open={dispatcher.webauthnEnrollOpen}
                userId={userId}
                tenantId={tenantId}
                mode={dispatcher.webauthnMode}
                onClose={() => dispatcher.setWebauthnEnrollOpen(false)}
                onEnrolled={refetchEnrollments}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />
            <VoiceEnrollmentDialog
                open={dispatcher.voiceEnrollOpen}
                userId={userId}
                tenantId={tenantId}
                apiBaseUrl={envConfig.apiBaseUrl}
                token={accessToken}
                onClose={() => dispatcher.setVoiceEnrollOpen(false)}
                onEnrolled={refetchEnrollments}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />
            <NfcEnrollmentDialog
                open={dispatcher.nfcEnrollOpen}
                userId={userId}
                tenantId={tenantId}
                onClose={() => dispatcher.setNfcEnrollOpen(false)}
                onEnrolled={refetchEnrollments}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />
            <SmsOtpEnrollmentFlow
                phase={dispatcher.smsPhase}
                userId={userId}
                user={{
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber ?? null,
                    tenantId,
                }}
                onClose={() => dispatcher.setSmsPhase(null)}
                onPhoneSaved={() => dispatcher.setSmsPhase('otp')}
                onEnrolled={() => {
                    dispatcher.setSmsPhase(null)
                    refetchEnrollments()
                }}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%', borderRadius: '12px' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}
