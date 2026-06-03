/**
 * LoginMfaFlow — Widget-specific login + N-step MFA flow
 *
 * Used when the widget is opened in "login" mode (no session_id, has client_id).
 * Shows PasswordStep first, then handles MFA steps if required.
 *
 * Communicates completion via onComplete callback (which sends postMessage to parent).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material'
import { Close, ArrowBack, EmailOutlined } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthRepository, AvailableMfaMethod, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { AuthMethodType, MfaStepStatus, EASE_OUT } from '@features/auth/constants'
import PasswordStep from '@features/auth/components/steps/PasswordStep'
import MethodPickerStep from '@features/auth/components/steps/MethodPickerStep'
import MfaStepRenderer from '@features/auth/login-shared/MfaStepRenderer'
import { makeRequestWebAuthnChallenge } from '@features/auth/login-shared/webauthnChallenge'
import StepProgress from './StepProgress'
import { hasPasswordLayer1, needsIdentifier, type LoginConfig } from '@domain/models/LoginConfig'

/**
 * The discrete screens of the login flow. Named constants (not bare string
 * literals) so call sites read intentionally and a typo is a compile error.
 */
const FlowPhase = {
    /** Legacy single screen: email + password together (engine OFF). */
    Password: 'password',
    /** Identifier-first screen 1: collect email only (engine ON). */
    Identifier: 'identifier',
    /** Choose which configured factor to use for the current step. */
    MethodPicker: 'method-picker',
    /** Verify the selected MFA factor. */
    MfaStep: 'mfa-step',
    /** Flow finished. */
    Complete: 'complete',
} as const
type FlowPhase = (typeof FlowPhase)[keyof typeof FlowPhase]

interface LoginMfaFlowProps {
    clientId: string
    onComplete: (result: { accessToken: string; refreshToken?: string; userId: string; email?: string; completedMethods?: string[]; mfaSessionToken?: string; timestamp?: number }) => void
    onCancel: () => void
    onStepChange?: (stepIndex: number, methodType: string, totalSteps: number) => void
    /**
     * Fires whenever the flow enters / leaves its OPENING identity-entry screen
     * (the legacy combined email+password screen, or the identifier-first email
     * screen — before any identifier is committed / MFA session opened). The
     * hosted shell uses this to show the usernameless shortcuts (passkey /
     * approve) ONLY on that initial screen, mirroring the dashboard's
     * `onInitialIdentityEntry` gate, instead of leaving them visible under every
     * MFA step.
     */
    onInitialPhaseChange?: (isInitialIdentityEntry: boolean) => void
    /**
     * Tenant Layer-1 config (D). When present, the first phase is rendered
     * STRICTLY from it: the password field appears ONLY if PASSWORD is a
     * Layer-1 method; otherwise an identifier-first entry is shown that starts
     * the flow with the configured non-password methods. `null`/undefined ⇒
     * legacy behaviour (always start on the password step).
     */
    loginConfig?: LoginConfig | null
    /**
     * Identifier-first preflight propagation. The hosted page's INITIAL config
     * is resolved by OAuth `clientId`, which maps to the client's bound tenant
     * (the dashboard/mobile client is on the `system` sentinel tenant) — so the
     * page previews the SYSTEM flow until the user enters an email. When the user
     * submits their identifier we call `/auth/login/preflight`, which returns the
     * USER's ACTUAL tenant login-config; this callback hands that resolved config
     * up to the shell (HostedLoginApp) so the displayed flow (step list / methods
     * / branding) switches to the user's real tenant from that point on.
     *
     * Only fired with a non-null resolved config (an older API returning only
     * `{eligible}`, or any failure, yields null → the displayed config is left
     * unchanged, preserving the fallback). The backend keeps unknown emails
     * enumeration-safe by returning a platform-default-looking config.
     */
    onPreflightResolved?: (loginConfig: LoginConfig) => void
    /**
     * Multi-step bridge (Contract A). A usernameless Layer-1 factor approved on
     * another device (APPROVE_LOGIN / QR_CODE) for a MULTI-STEP tenant flow hands
     * back an MFA session — NOT tokens — because remaining steps follow. The shell
     * passes that handoff here so this flow RESUMES into the MFA leg (the method
     * picker for the next step) instead of the user dead-ending at "extra step
     * needed, continue here". `null`/undefined ⇒ no resume (unchanged behaviour).
     * Seeded into MFA state exactly once, and only while no MFA session is already
     * open, so it can never yank a user out of an in-progress flow.
     */
    resumeSession?: {
        mfaSessionToken: string
        currentStep?: number
        totalSteps?: number
        availableMethods?: string[]
    } | null
}

export default function LoginMfaFlow({ clientId, onComplete, onCancel, onStepChange, onInitialPhaseChange, loginConfig, onPreflightResolved, resumeSession }: LoginMfaFlowProps) {
    const { t } = useTranslation()
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    // Layer-1 rendering decision (D). With a config that omits PASSWORD we never
    // show the password field; if an identifier is still required we collect it
    // first, otherwise we go straight to picking a Layer-1 method.
    const passwordIsLayer1 = !loginConfig || hasPasswordLayer1(loginConfig)
    const identifierRequired = loginConfig ? needsIdentifier(loginConfig) : true
    // CHOICE Layer-1 (>1 configured method) → after the identifier step we show a
    // method picker so the user can satisfy Layer-1 with ANY of them (incl.
    // password), instead of forcing the password screen. A lone PASSWORD Layer-1
    // keeps the classic email→password experience.
    const layer1IsChoice = (loginConfig?.layer1.methods.length ?? 0) > 1
    // IDENTIFIER-FIRST (engine ON): screen 1 collects only identity (email /
    // passkey); EVERY factor — including password — comes afterwards. So even a
    // password-Layer-1 flow starts on the 'identifier' phase. When the engine is
    // OFF we keep the legacy single-screen email+password ('password' phase), so
    // the whole redesign reverts with the engine flag and no web redeploy.
    const engineActive = Boolean(loginConfig?.engineActive)

    /** Which screen the flow opens on, given the tenant config + engine flag. */
    function pickInitialPhase(): FlowPhase {
        // Identifier-first (engine ON): screen 1 collects identity only; password
        // and every other factor are presented afterwards.
        if (engineActive && identifierRequired) return FlowPhase.Identifier
        // Legacy (engine OFF): the single email+password screen.
        if (passwordIsLayer1) return FlowPhase.Password
        // Non-password Layer-1 that still needs an identifier (e.g. OTP-first).
        if (identifierRequired) return FlowPhase.Identifier
        // All-usernameless Layer-1 (passkey / QR) — go straight to method choice.
        return FlowPhase.MethodPicker
    }
    const initialPhase: FlowPhase = pickInitialPhase()

    const [phase, setPhase] = useState<FlowPhase>(initialPhase)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [mfaSessionToken, setMfaSessionToken] = useState<string>('')
    const [availableMethods, setAvailableMethods] = useState<AvailableMfaMethod[]>([])
    const [selectedMethod, setSelectedMethod] = useState<string>('')
    const [currentStep, setCurrentStep] = useState(1)
    const [totalSteps, setTotalSteps] = useState(1)
    const [usedMethods, setUsedMethods] = useState<string[]>([])
    // Identifier-first entry (config without PASSWORD): the typed email.
    const [identifier, setIdentifier] = useState('')

    // Perf (USER-BUG-7 → audit CC-3): warm MediaPipe FaceLandmarker ONLY when
    // FACE is actually a possible step — never on the bare identifier/password
    // screen. The heavy WASM/WebGL FaceLandmarker graph used to initialize on
    // every hosted-login mount, before any factor was chosen, contributing to
    // a near-blank first paint and wasting CPU/battery for password-only users
    // (VISUAL_AUDIT_ALLSITES_2026-06-01 CC-3). FACE is "possible" if the tenant
    // login-config declares it on Layer 1, or once it appears in the resolved
    // availableMethods after the first factor. Removing the warm-up entirely
    // would also be correct (useFaceDetection calls initialize() single-flight
    // on its own mount) — this just keeps the head-start for genuine face flows.
    const faceIsPossible =
        availableMethods.some((m) => m.methodType === AuthMethodType.FACE) ||
        (loginConfig?.layer1.methods ?? []).some((m) => m.type === AuthMethodType.FACE)
    useEffect(() => {
        if (!faceIsPossible) return
        let cancelled = false
        const win = window as Window & { requestIdleCallback?: (cb: () => void) => void }
        const idle = win.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1))
        idle(() => {
            if (cancelled) return
            import('@/lib/biometric-engine/core/BiometricEngine')
                .then(({ BiometricEngine }) => {
                    if (cancelled) return
                    return BiometricEngine.getInstance().initialize()
                })
                .catch(() => {
                    // Non-fatal — useFaceDetection retries on demand
                })
        })
        return () => {
            cancelled = true
        }
    }, [faceIsPossible])

    // Notify parent bridge when the login/MFA phase changes
    useEffect(() => {
        if (!onStepChange) return
        // Map login flow phases to step indices for the postMessage bridge
        // password=0, method-picker=1, mfa-step=1 (step 2 of 2 when MFA is active)
        if (phase === FlowPhase.Password || phase === FlowPhase.Identifier) {
            onStepChange(0, phase === FlowPhase.Password ? 'PASSWORD' : 'IDENTIFIER', totalSteps > 1 ? totalSteps : 1)
        } else if (phase === FlowPhase.MethodPicker || phase === FlowPhase.MfaStep) {
            const stepIdx = currentStep - 1
            onStepChange(stepIdx, selectedMethod || 'MFA', totalSteps)
        }
    }, [phase, selectedMethod, currentStep, totalSteps, onStepChange])

    // Tell the hosted shell whether we're on the OPENING identity-entry screen,
    // so it can gate the usernameless shortcuts (passkey / approve) to that
    // screen only. "Initial" = the identifier-first email screen, OR the legacy
    // (engine-OFF) combined email+password screen, with NO identifier committed
    // and NO MFA session yet. Once the user reveals the password (engine-ON,
    // identifier-first) or opens an MFA session, the shortcuts are redundant.
    useEffect(() => {
        if (!onInitialPhaseChange) return
        const isInitial =
            !mfaSessionToken &&
            (phase === FlowPhase.Identifier ||
                (phase === FlowPhase.Password && !engineActive))
        onInitialPhaseChange(isInitial)
    }, [phase, engineActive, mfaSessionToken, onInitialPhaseChange])

    // loginConfig is fetched ASYNCHRONOUSLY by the parent (HostedLoginApp /
    // LoginPage), so on first mount it is null and the `useState` initializer
    // derived the legacy 'password' opening screen. Once the real config lands,
    // re-derive the opening phase ONCE — but only while the user is still on that
    // opening password screen and hasn't submitted anything, so we never pull
    // someone out of a flow they already started. This is what actually opens
    // engine-ON (engineActive) tenants identifier-first: without it the page
    // stays on the null-config legacy screen even though the config says
    // otherwise.
    const openingPhaseSyncedRef = useRef(false)
    useEffect(() => {
        if (openingPhaseSyncedRef.current || !loginConfig) return
        openingPhaseSyncedRef.current = true
        const intended = pickInitialPhase()
        setPhase((current) =>
            current === FlowPhase.Password && !mfaSessionToken && !identifier.trim()
                ? intended
                : current,
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loginConfig])

    // ─── Multi-step bridge resume (Contract A) ──────────────────
    //
    // When a usernameless Layer-1 factor (APPROVE_LOGIN / QR_CODE) is approved on
    // another device for a MULTI-STEP tenant, the shell hands us the resulting MFA
    // session via `resumeSession`. Seed the MFA state from it and jump straight to
    // the method picker for the next step — mirroring how `handleMfaResult` seeds
    // the same state on STEP_COMPLETED. This is what turns "approved on phone but
    // web dead-ends at 'extra step needed'" into a continuing flow.
    //
    // Guards: seed ONCE (ref latch) and ONLY when no MFA session is already open,
    // so a resume can never pull a user out of an in-progress flow.
    const resumeSyncedRef = useRef(false)
    useEffect(() => {
        if (resumeSyncedRef.current) return
        if (!resumeSession || !resumeSession.mfaSessionToken) return
        if (mfaSessionToken) return // already in an MFA flow — never interrupt it
        resumeSyncedRef.current = true

        setMfaSessionToken(resumeSession.mfaSessionToken)
        const methods: AvailableMfaMethod[] = (resumeSession.availableMethods ?? []).map(
            (m) => ({
                methodType: m,
                name: m,
                category: '',
                enrolled: true,
                preferred: false,
                requiresEnrollment: false,
            }),
        )
        setAvailableMethods(methods)
        if (resumeSession.currentStep) setCurrentStep(resumeSession.currentStep)
        if (resumeSession.totalSteps) setTotalSteps((prev) => Math.max(prev, resumeSession.totalSteps!))
        setPhase(FlowPhase.MethodPicker)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resumeSession])

    // ─── Password Submit ────────────────────────────────────────

    const handlePasswordSubmit = useCallback(async (data: { email: string; password: string }) => {
        setLoading(true)
        setError(undefined)

        try {
            // T-TENANT-GATE 2026-05-07: forward clientId so the backend can
            // reject wrong-tenant users at the password step (HTTP 403 +
            // TENANT_MISMATCH). Without this, a gmail user submitting the
            // Marmara hosted-login form passes password + MFA only to fail at
            // /oauth2/authorize/complete with no enrollment in the foreign
            // tenant — the bug user reported on demo.fivucsas.com.
            const result = await authRepository.login({
                email: data.email,
                password: data.password,
                clientId: clientId || undefined,
            })

            if (result.twoFactorRequired) {
                // MFA required
                const token = result.mfaSessionToken ?? ''
                setMfaSessionToken(token)
                // Backend-authoritative step counts: PASSWORD satisfied step 1, so
                // the flow resumes at step 2 of N ("2/N").
                if (result.totalSteps) setTotalSteps(result.totalSteps)
                setCurrentStep(result.currentStep ?? 2)

                const methods = result.availableMethods ?? []
                const enrolledMethods = methods.filter((m) => m.enrolled)
                setAvailableMethods(methods)
                if (result.completedMethods?.length) {
                    setUsedMethods((prev) =>
                        Array.from(new Set([...prev, ...result.completedMethods!])),
                    )
                }

                if (enrolledMethods.length > 1) {
                    // Multiple enrolled methods: show picker
                    setPhase(FlowPhase.MethodPicker)
                } else {
                    // Single method: go directly to step
                    const method = result.twoFactorMethod || enrolledMethods[0]?.methodType || 'EMAIL_OTP'
                    setSelectedMethod(method)
                    setPhase(FlowPhase.MfaStep)
                }
            } else {
                // No MFA — single-factor login complete
                onComplete({
                    accessToken: result.accessToken ?? '',
                    refreshToken: result.refreshToken ?? undefined,
                    userId: result.user?.id ?? '',
                    email: result.user?.email ?? undefined,
                    completedMethods: ['PASSWORD'],
                    timestamp: Date.now(),
                })
            }
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [authRepository, clientId, onComplete, t])

    // ─── Identifier-first Submit (config without PASSWORD) ──────

    // Seed the method picker from the tenant's Layer-1 config when there is no
    // password factor. Non-usernameless Layer-1 methods (EMAIL_OTP, SMS_OTP, …)
    // are surfaced here; usernameless ones are handled by the shortcut buttons.
    const configLayer1Methods: AvailableMfaMethod[] = (loginConfig?.layer1.methods ?? [])
        .filter((m) => m.type !== AuthMethodType.PASSWORD && !m.usernameless)
        .map((m) => ({
            methodType: m.type,
            name: m.type,
            category: '',
            enrolled: true,
            preferred: false,
            requiresEnrollment: m.requiresEnrollment,
        }))

    const handleIdentifierSubmit = useCallback(async () => {
        if (!identifier.trim()) {
            setError(t('auth.validation.emailRequired'))
            return
        }
        // Identifier-first WITH a password factor: we now know who the user is,
        // so reveal the password screen. The /auth/login call happens at the
        // password step (with this email), then any MFA steps follow. No
        // beginIdentifierLogin here — password is authenticated via /auth/login.
        // BUT first run a password-less tenant pre-flight so a wrong-tenant email
        // (e.g. a gmail account on the Marmara hosted surface) is rejected HERE,
        // on the identity step, instead of one step later at the password step
        // (the user reported the "not a {tenant} member" error surfacing too late).
        if (engineActive && passwordIsLayer1 && !layer1IsChoice) {
            // Lone PASSWORD Layer-1: preflight, then reveal the password screen.
            setLoading(true)
            setError(undefined)
            try {
                // The hosted page's INITIAL config was resolved by OAuth clientId
                // → the client's bound tenant (typically the `system` sentinel),
                // so the previewed flow may be the SYSTEM flow, not the user's.
                // The preflight resolves the USER's ACTUAL tenant login-config;
                // hand it up so the displayed flow switches to the user's tenant.
                // A null result (older API / failure) leaves the displayed config
                // unchanged — fallback preserved.
                const resolved = await authRepository.checkLoginEligibility(
                    identifier.trim(),
                    clientId || undefined,
                )
                if (resolved && onPreflightResolved) onPreflightResolved(resolved)
                setPhase(FlowPhase.Password)
            } catch (err) {
                // TENANT_MISMATCH (or any pre-flight error) is shown inline on the
                // email step via formatApiError; the user never reaches the password
                // screen for a wrong-tenant account.
                setError(formatApiError(err, t))
            } finally {
                setLoading(false)
            }
            return
        }
        setLoading(true)
        setError(undefined)
        try {
            const result = await authRepository.beginIdentifierLogin(
                identifier.trim(),
                clientId || undefined,
            )
            const token = result.mfaSessionToken ?? ''
            setMfaSessionToken(token)
            // Backend-authoritative step counts: begin opens at step 1 of N, so the
            // picker/first factor reads "1/N" (the chosen factor IS step 1 here).
            if (result.totalSteps) setTotalSteps(result.totalSteps)
            setCurrentStep(result.currentStep ?? 1)
            const methods = result.availableMethods ?? configLayer1Methods
            setAvailableMethods(methods)
            if (result.completedMethods?.length) {
                setUsedMethods((prev) => Array.from(new Set([...prev, ...result.completedMethods!])))
            }
            const enrolled = methods.filter((m) => m.enrolled)
            if (enrolled.length > 1) {
                setPhase(FlowPhase.MethodPicker)
            } else if (enrolled.length === 1) {
                setSelectedMethod(enrolled[0].methodType)
                setPhase(FlowPhase.MfaStep)
            } else {
                setPhase(FlowPhase.MethodPicker)
            }
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [authRepository, identifier, clientId, configLayer1Methods, engineActive, passwordIsLayer1, layer1IsChoice, onPreflightResolved, t])

    // ─── Method Selection ───────────────────────────────────────

    const handleMethodSelected = useCallback((methodType: string) => {
        setError(undefined)
        if (methodType === AuthMethodType.PASSWORD && usedMethods.length === 0) {
            // PASSWORD as the FIRST factor → dedicated lockout-protected /auth/login
            // password screen (email + password).
            setSelectedMethod('')
            setPhase(FlowPhase.Password)
            return
        }
        // Later factor (incl. password at layer 2+) → complete the current step of
        // the existing MFA session via /auth/mfa/step (renderMfaStep handles PASSWORD).
        setSelectedMethod(methodType)
        setPhase(FlowPhase.MfaStep)
    }, [usedMethods])

    const handleBackToMethodSelection = useCallback(() => {
        setError(undefined)
        setPhase(FlowPhase.MethodPicker)
    }, [])

    const handleBackToPassword = useCallback(() => {
        setError(undefined)
        setMfaSessionToken('')
        setAvailableMethods([])
        setSelectedMethod('')
        setUsedMethods([])
        // Return to whichever entry phase this flow started on (password vs
        // identifier-first), not unconditionally to password.
        setPhase(initialPhase)
    }, [initialPhase])

    // "Not you? Start over" — the SHELL-level reset shown in the card header once
    // an identifier is committed (replaces the per-step "Change email" link so the
    // affordance is uniform across ALL factor steps). Fully restarts the
    // identifier flow: clears the MFA session AND the typed identifier, then
    // returns to the opening identity-entry screen.
    const handleStartOver = useCallback(() => {
        setIdentifier('')
        setCurrentStep(1)
        handleBackToPassword()
    }, [handleBackToPassword])

    // ─── MFA Step Verification ──────────────────────────────────

    const verifyStep = useCallback(async (method: string, data: Record<string, unknown>) => {
        setLoading(true)
        setError(undefined)

        try {
            const res = await authRepository.verifyMfaStep(mfaSessionToken, method, data)
            handleMfaResult(res)
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [authRepository, mfaSessionToken, t]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleMfaResult = useCallback((res: MfaStepResponse) => {
        if (res.status === MfaStepStatus.AUTHENTICATED && res.accessToken) {
            // All steps complete — include PASSWORD (always first) + any MFA methods used + current
            const finalMethods = Array.from(new Set<string>([
                'PASSWORD',
                ...usedMethods,
                ...(selectedMethod ? [selectedMethod] : []),
            ]))
            onComplete({
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
                userId: res.user?.id ? String(res.user.id) : '',
                email: res.user?.email ? String(res.user.email) : undefined,
                completedMethods: finalMethods,
                mfaSessionToken: mfaSessionToken || undefined,
                timestamp: Date.now(),
            })
        } else if (res.status === MfaStepStatus.STEP_COMPLETED) {
            // More steps remain — merge backend-authoritative completed list with local + current.
            // Compute the merged set synchronously so the picker decision below cannot
            // re-route the user back through an already-completed method (the bug:
            // "Fingerprint succeeded — and then the SAME fingerprint step ran again").
            // Using only `selectedMethod` for the filter was insufficient because a
            // server-side legit-repeat could leave the just-cleared method in
            // availableMethods AND the local closure had not yet seen the updated state.
            const mergedUsed = new Set<string>(usedMethods)
            if (res.completedMethods?.length) res.completedMethods.forEach((m) => mergedUsed.add(m))
            if (selectedMethod) mergedUsed.add(selectedMethod)
            setUsedMethods(Array.from(mergedUsed))

            if (res.mfaSessionToken) setMfaSessionToken(res.mfaSessionToken)
            if (res.currentStep) setCurrentStep(res.currentStep)
            if (res.totalSteps) setTotalSteps((prev) => Math.max(prev, res.totalSteps!))

            const methods = res.availableMethods ?? availableMethods
            setAvailableMethods(methods)

            // Clear the active selection; we are between steps. A new method will be
            // chosen below (auto-pick or via the picker) and the FingerprintStep /
            // FaceStep / etc. component will remount because `selectedMethod` changed.
            setSelectedMethod('')

            const enrolled = methods.filter((m) => m.enrolled && !mergedUsed.has(m.methodType))
            if (enrolled.length > 1) {
                setPhase(FlowPhase.MethodPicker)
            } else if (enrolled.length === 1) {
                setSelectedMethod(enrolled[0].methodType)
                setPhase(FlowPhase.MfaStep)
            } else {
                setPhase(FlowPhase.MethodPicker)
            }
        } else {
            setError(t('widget.verificationFailed'))
        }
    }, [onComplete, availableMethods, mfaSessionToken, usedMethods, selectedMethod, t])

    // ─── WebAuthn Challenge Helper ────────────────────────────────

    const requestWebAuthnChallenge = useCallback(
        (method: AuthMethodType) =>
            makeRequestWebAuthnChallenge(authRepository, mfaSessionToken)(method),
        [authRepository, mfaSessionToken],
    )

    // ─── Render Step Component ──────────────────────────────────
    // The per-method step body is rendered by the SHARED MfaStepRenderer (kept
    // identical with the dashboard's TwoFactorDispatcher). This flow only owns
    // its hosted-card SHELL, the identifier/password entry phases, and the
    // method picker.

    const renderMfaStep = () => (
        <MfaStepRenderer
            method={selectedMethod}
            mfaSessionToken={mfaSessionToken}
            verifyStep={verifyStep}
            requestWebAuthnChallenge={requestWebAuthnChallenge}
            httpClient={httpClient}
            onAuthenticated={handleMfaResult}
            onBack={handleBackToMethodSelection}
            loading={loading}
            error={error}
            onError={setError}
            presetEmail={identifier || undefined}
        />
    )

    // ─── Render ─────────────────────────────────────────────────

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
        >
            <Card
                sx={(th) => {
                    // Softer, mode-aware elevation. The default MuiCard hover lift
                    // is overridden because MFA flow cards should feel grounded,
                    // not interactive-on-hover — so the same shadow is used on
                    // base and :hover. Defined once here to prevent drift.
                    const groundedShadow = th.palette.mode === 'dark'
                        ? '0 8px 24px -8px rgba(0,0,0,0.5)'
                        : '0 8px 24px -8px rgba(15,23,42,0.12), 0 2px 6px -2px rgba(15,23,42,0.06)'
                    return {
                        maxWidth: 520,
                        width: '100%',
                        mx: 'auto',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: 'divider',
                        overflow: 'visible',
                        boxShadow: groundedShadow,
                        '&:hover': {
                            boxShadow: groundedShadow,
                            transform: 'none',
                        },
                    }
                }}
            >
                {/* Top-of-flow progress indicator — shown on every MFA step, not just the last.
                    Earlier behavior hid the counter until the backend reported `totalSteps > 1`
                    on STEP_COMPLETED, which only happens AFTER the user finishes a step — so
                    the counter only appeared on the last step (user-reported bug:
                    "Adım N/3 only renders on step 3 of 3"). We now show a counter as soon as
                    the user is on the MFA leg of the flow, inferring a safe total when the
                    backend hasn't reported one yet. */}
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    {(() => {
                        // The IDENTIFIER screen is NOT a verification step — it only
                        // collects who you are — so it is UNNUMBERED. Counting it
                        // double-counted the flow (identifier "1/N" AND the first
                        // real factor "1/N"); rendering nothing here makes the first
                        // factor 1/N and each subsequent one 2/N…N/N.
                        if (phase === FlowPhase.Identifier) return null

                        // Single backend-authoritative denominator shared by the
                        // password screen (the first factor, step 1) and every MFA
                        // step. Prefer the config's `totalSteps`; fall back to the
                        // live `totalSteps` / `currentStep` so the bar can never read
                        // fewer steps than the user has already taken. No `Math.max(…,2,…)`
                        // floor — that mismatched the password screen's
                        // `loginConfig.totalSteps` and over-reported short flows.
                        const flowTotal = Math.max(
                            loginConfig?.totalSteps ?? 0,
                            totalSteps,
                            currentStep,
                        )
                        if (phase === FlowPhase.Password) {
                            // Password IS the first factor → 1/N.
                            return <StepProgress current={1} total={flowTotal} />
                        }
                        // MFA leg: trust the backend-authoritative `currentStep`
                        // (a password-first flow resumes at step 2; an arbitrary-
                        // first-factor flow starts at step 1). StepProgress clamps
                        // current ≤ total and hides itself when total <= 1.
                        return (
                            <StepProgress
                                current={Math.min(currentStep, flowTotal)}
                                total={flowTotal}
                            />
                        )
                    })()}

                    {/* "Not you? Start over" — SHELL-level reset shown once an
                        identifier is committed (i.e. NOT on the opening identity-
                        entry screen). Uniform across ALL factor steps (password +
                        every MFA step), replacing the per-step "Change email" link
                        that PasswordStep used to carry, so every factor reads the
                        same. Fully restarts the identifier flow. */}
                    {(() => {
                        const onInitialIdentityEntry =
                            !mfaSessionToken &&
                            (phase === FlowPhase.Identifier ||
                                (phase === FlowPhase.Password && !engineActive))
                        if (onInitialIdentityEntry) return null
                        return (
                            <Box sx={{ mb: 1.5 }}>
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={handleStartOver}
                                    disabled={loading}
                                    sx={{ color: 'text.secondary', textTransform: 'none', minWidth: 0, px: 0.5 }}
                                >
                                    {t('auth.notYouStartOver')}
                                </Button>
                            </Box>
                        )
                    })()}

                    {/* Header */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            mb: 3,
                        }}
                    >
                        <Typography
                            variant="h5"
                            sx={{
                                fontFamily: '"Poppins", "Inter", sans-serif',
                                fontWeight: 700,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.2,
                                flexGrow: 1,
                                minWidth: 0,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {phase === FlowPhase.Password || phase === FlowPhase.Identifier
                                ? t('widget.loginTitle')
                                : t('widget.verifyIdentity')}
                        </Typography>
                        <Button
                            variant="text"
                            size="small"
                            onClick={onCancel}
                            disabled={loading}
                            startIcon={<Close fontSize="small" />}
                            sx={{
                                color: 'text.secondary',
                                flexShrink: 0,
                                minWidth: 'auto',
                                fontWeight: 500,
                                px: 1.25,
                            }}
                        >
                            {t('widget.cancel')}
                        </Button>
                    </Box>

                    {/* Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={phase + selectedMethod}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3, ease: EASE_OUT }}
                        >
                            {phase === FlowPhase.Password && (
                                <PasswordStep
                                    onSubmit={handlePasswordSubmit}
                                    loading={loading}
                                    error={error}
                                    presetEmail={
                                        engineActive && passwordIsLayer1 && identifier.trim()
                                            ? identifier.trim()
                                            : undefined
                                    }
                                    // The "change identity" affordance is now the
                                    // SHELL-level "Not you? Start over" link in the
                                    // card header (uniform across every factor step),
                                    // so PasswordStep no longer carries its own
                                    // per-step change link — see Fix 1.
                                />
                            )}

                            {phase === FlowPhase.Identifier && (
                                <Box>
                                    {error && (
                                        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                                            {error}
                                        </Alert>
                                    )}
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {t('login.identifierFirstSubtitle')}
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        type="email"
                                        label={t('auth.emailLabel')}
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !loading) {
                                                e.preventDefault()
                                                void handleIdentifierSubmit()
                                            }
                                        }}
                                        autoFocus
                                        disabled={loading}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailOutlined sx={{ color: 'text.secondary' }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            mb: 2,
                                            '& .MuiOutlinedInput-root': { borderRadius: '12px' },
                                        }}
                                    />
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={() => void handleIdentifierSubmit()}
                                        disabled={loading || !identifier.trim()}
                                        sx={{ py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                                    >
                                        {t('auth.continue')}
                                    </Button>
                                </Box>
                            )}

                            {phase === FlowPhase.MethodPicker && (
                                <Box>
                                    <MethodPickerStep
                                        availableMethods={availableMethods}
                                        onMethodSelected={handleMethodSelected}
                                        usedMethods={usedMethods}
                                    />
                                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                                        <Button
                                            variant="text"
                                            size="small"
                                            startIcon={<ArrowBack />}
                                            onClick={handleBackToPassword}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            {t('auth.backToLogin')}
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {phase === FlowPhase.MfaStep && (
                                <Box>
                                    {/* Back to method selection — rendered ABOVE the step so it
                                        stays visible even when step content (e.g. Face camera)
                                        is tall enough to push trailing UI off-screen. */}
                                    {availableMethods.filter((m) => m.enrolled).length > 1 &&
                                        selectedMethod !== 'EMAIL_OTP' && (
                                            <Box sx={{ mb: 1 }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    startIcon={<ArrowBack />}
                                                    onClick={handleBackToMethodSelection}
                                                    sx={{ color: 'text.secondary' }}
                                                >
                                                    {t('mfa.backToMethodSelection')}
                                                </Button>
                                            </Box>
                                        )}
                                    {renderMfaStep()}
                                </Box>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Bottom step counter removed — StepProgress at the top is the
                        single authoritative indicator per Fix 4 (2026-04-18c). */}
                </CardContent>
            </Card>
        </motion.div>
    )
}
