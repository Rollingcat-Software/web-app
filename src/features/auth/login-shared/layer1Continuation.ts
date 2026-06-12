/**
 * Layer1Continuation — the next-step handoff a usernameless / cross-device
 * Layer-1 method returns when the tenant flow needs MORE steps after the first
 * factor is satisfied.
 *
 * The QR / approve-login / passkey first-factor entry points each complete
 * Layer 1 WITHOUT minting final tokens when the tenant requires additional
 * factors. The server (`UsernamelessLoginFlowService.continueAfterLayer1` /
 * `DeviceController`) returns an `mfaSessionToken` (and, where available, the
 * next step's `availableMethods`) so the browser can continue into the EXISTING
 * MethodPicker / MfaStepRenderer continuation — instead of dead-ending on an
 * info alert + "go back" button (the F1 = F3 bug).
 *
 * `availableMethods` may be absent/empty (e.g. the passkey-success path where
 * `DeviceController` returns no methods); the host falls back to its standard
 * single-method routing in that case, anchored by the `mfaSessionToken`.
 */
import type { AvailableMfaMethod } from '@domain/interfaces/IAuthRepository'

export interface Layer1Continuation {
    /** Session token for the in-progress MFA flow (continue via /auth/mfa/step). */
    mfaSessionToken: string
    /** Methods offered for the NEXT step, when the server reported them. */
    availableMethods?: AvailableMfaMethod[]
    /** Factors already satisfied (Layer 1) so the picker can mark them used. */
    completedMethods?: string[]
    /** Backend-authoritative step counters, when reported. */
    currentStep?: number
    totalSteps?: number
}
