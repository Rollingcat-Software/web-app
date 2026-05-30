/**
 * Passkey (discoverable / usernameless) login client
 *
 * Phase 1 of the passkey-hybrid login. Drives the two-call server handshake
 * plus the browser `navigator.credentials.get()` ceremony for a DISCOVERABLE
 * credential — i.e. the user never types an email. An empty `allowCredentials`
 * list makes the authenticator surface every resident passkey for the RP and,
 * on platforms that support it, the "use a passkey on another device" hybrid
 * (caBLE / QR-to-phone) flow.
 *
 * The two endpoints (see API contract, agent-api-auth):
 *   POST /webauthn/passkey/authenticate-options  (no email)
 *     → { sessionId, challenge, rpId, userVerification, allowCredentials: [] }
 *   POST /webauthn/passkey/authenticate
 *     { sessionId, credentialId, authenticatorData, clientDataJSON, signature, userHandle }
 *     → normal login success (AuthResponse-shaped)
 *
 * Byte fields (credentialId/authenticatorData/clientDataJSON/signature) are
 * STANDARD base64 (`btoa`, via {@link arrayBufferToBase64}); the backend's
 * `decodeBase64()` helper normalizes URL-safe input too. `userHandle` is
 * base64url with no padding.
 */

import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { WEBAUTHN } from './constants'
import {
    arrayBufferToBase64,
    bytesToBase64url,
    decodeChallengeToBytes,
    type PasskeyAssertionResult,
} from './webauthn-utils'

export const PASSKEY_API = {
    AUTHENTICATE_OPTIONS: '/webauthn/passkey/authenticate-options',
    AUTHENTICATE: '/webauthn/passkey/authenticate',
} as const

/** Server response for the discoverable-credential request options. */
export interface PasskeyAuthenticateOptions {
    sessionId: string
    challenge: string
    rpId?: string
    userVerification?: UserVerificationRequirement
    /** Always empty for discoverable login — kept for forward compatibility. */
    allowCredentials?: string[]
}

/** Whether WebAuthn (and therefore passkeys) can be attempted in this browser. */
export function isPasskeySupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        !!navigator.credentials &&
        typeof navigator.credentials.get === 'function'
    )
}

/** Fetch discoverable-credential request options from the server (no email). */
export async function fetchPasskeyOptions(
    httpClient: IHttpClient,
): Promise<PasskeyAuthenticateOptions> {
    const res = await httpClient.post<PasskeyAuthenticateOptions>(
        PASSKEY_API.AUTHENTICATE_OPTIONS,
        {},
    )
    return res.data
}

/**
 * Run the browser passkey ceremony for the given server options and return the
 * assertion fields the server expects. Throws on user cancellation / timeout
 * (a `DOMException` mappable via {@link mapWebAuthnError}); returns `null` only
 * when the browser yields no credential without throwing (rare).
 */
export async function getPasskeyAssertion(
    options: PasskeyAuthenticateOptions,
): Promise<PasskeyAssertionResult | null> {
    const challengeBytes = decodeChallengeToBytes(options.challenge)

    const credential = await navigator.credentials.get({
        publicKey: {
            challenge: challengeBytes.buffer as ArrayBuffer,
            rpId: options.rpId || window.location.hostname,
            timeout: WEBAUTHN.TIMEOUT_MS,
            userVerification: options.userVerification ?? WEBAUTHN.UV_REQUIRED,
            // Empty list => DISCOVERABLE. The authenticator offers all resident
            // passkeys for this RP and (where supported) the hybrid transport,
            // so the user can pick a passkey on a phone via QR.
            allowCredentials: [],
        },
    })

    if (!credential || !('response' in credential)) {
        return null
    }

    const assertion = credential.response as AuthenticatorAssertionResponse

    return {
        credentialId: credential.id,
        authenticatorData: arrayBufferToBase64(assertion.authenticatorData),
        clientDataJSON: arrayBufferToBase64(assertion.clientDataJSON),
        signature: arrayBufferToBase64(assertion.signature),
        // userHandle is present for resident keys and identifies the account.
        userHandle: assertion.userHandle
            ? bytesToBase64url(assertion.userHandle)
            : null,
    }
}

/**
 * Submit the passkey assertion to complete sign-in. `T` is the caller's login
 * response shape (e.g. AuthResponse). The full server JSON body is returned so
 * callers can route into either the dashboard token-store path or the hosted
 * OIDC code-exchange path.
 */
export async function submitPasskeyAssertion<T>(
    httpClient: IHttpClient,
    sessionId: string,
    assertion: PasskeyAssertionResult,
): Promise<T> {
    const res = await httpClient.post<T>(PASSKEY_API.AUTHENTICATE, {
        sessionId,
        credentialId: assertion.credentialId,
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        signature: assertion.signature,
        userHandle: assertion.userHandle,
    })
    return res.data
}
