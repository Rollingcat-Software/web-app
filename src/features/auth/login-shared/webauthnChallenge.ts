/**
 * Shared WebAuthn challenge helper for the login MFA flows.
 *
 * Both the dashboard (TwoFactorDispatcher) and verify.fivucsas (LoginMfaFlow)
 * request a WebAuthn assertion challenge the same way — POST /auth/mfa/step
 * with `{ action: 'challenge' }` — for FINGERPRINT / HARDWARE_KEY steps. Kept
 * here (not in the renderer component file) so it stays a plain module export
 * and the two surfaces can never drift.
 */

import { MfaStepAction, type AuthMethodType } from '../constants'
import type { ChallengeResponse } from '../webauthn-utils'
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository'

/** Build the WebAuthn-challenge helper both surfaces use. */
export function makeRequestWebAuthnChallenge(
    authRepository: IAuthRepository,
    mfaSessionToken: string,
): (method: AuthMethodType) => Promise<ChallengeResponse | null> {
    return async (method: AuthMethodType): Promise<ChallengeResponse | null> => {
        const res = await authRepository.verifyMfaStep(
            mfaSessionToken,
            method,
            { action: MfaStepAction.CHALLENGE },
        )
        if (res.data && typeof res.data.challenge === 'string') {
            return {
                challenge: res.data.challenge,
                rpId: typeof res.data.rpId === 'string' ? res.data.rpId : undefined,
                timeout: typeof res.data.timeout === 'string' ? res.data.timeout : undefined,
                allowCredentials: Array.isArray(res.data.allowCredentials)
                    ? (res.data.allowCredentials as string[])
                    : undefined,
            }
        }
        return null
    }
}
