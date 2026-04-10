/**
 * WebAuthn Utilities
 *
 * Shared helpers for WebAuthn enrollment and verification flows.
 * Eliminates duplication between FingerprintStep, HardwareKeyStep, and WebAuthnEnrollment.
 */

import type { TFunction } from 'i18next'
import { WebAuthnErrorName } from './constants'

// ─── Types ──────────────────────────────────────────────────────

export interface ChallengeResponse {
    challenge: string
    rpId?: string
    timeout?: string
    allowCredentials?: string[]
}

export interface WebAuthnAssertionResult {
    credentialId: string
    authenticatorData: string
    clientDataJSON: string
    signature: string
}

// ─── Base64 Utilities ───────────────────────────────────────────

/** Encode an ArrayBuffer to standard base64 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

/** Decode a base64url string (no padding, URL-safe) to Uint8Array */
export function base64urlToBytes(base64url: string): Uint8Array {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4 !== 0) {
        base64 += '='
    }
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

/** Encode an ArrayBuffer to base64url (no padding, URL-safe) */
export function bytesToBase64url(buffer: ArrayBuffer): string {
    return arrayBufferToBase64(buffer)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

// ─── WebAuthn Error Mapping ─────────────────────────────────────

/**
 * Maps DOMException errors from WebAuthn API to i18n-translated user messages.
 * Returns undefined for errors that should be silently handled (e.g., user cancellation).
 */
export function mapWebAuthnError(err: unknown, t: TFunction): string | undefined {
    if (!(err instanceof DOMException)) {
        return err instanceof Error ? err.message : t('webauthn.errors.unknown')
    }

    switch (err.name) {
        case WebAuthnErrorName.NOT_ALLOWED:
            return t('webauthn.errors.notAllowed')
        case WebAuthnErrorName.INVALID_STATE:
            return t('webauthn.errors.invalidState')
        case WebAuthnErrorName.SECURITY:
            return t('webauthn.errors.security')
        case WebAuthnErrorName.ABORT:
            return t('webauthn.errors.aborted')
        default:
            return t('webauthn.errors.generic', { detail: err.message })
    }
}

// ─── Challenge Helpers ──────────────────────────────────────────

/** Generate a cryptographically random challenge (fallback when server is unavailable) */
export function generateRandomChallenge(): Uint8Array {
    const arr = new Uint8Array(32)
    crypto.getRandomValues(arr)
    return arr
}

/** Decode a base64 challenge string to bytes */
export function decodeChallengeToBytes(challenge: string): Uint8Array {
    return Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0))
}

/**
 * Resolve challenge and rpId from server via onRequestChallenge callback.
 * Falls back to props or random challenge if server is unavailable.
 */
export async function resolveChallenge(
    onRequestChallenge: (() => Promise<ChallengeResponse | null>) | undefined,
    challengeProp?: string,
    rpIdProp?: string,
): Promise<{ challengeBytes: Uint8Array; rpId: string | undefined; allowCredentials: string[] | undefined }> {
    let challenge = challengeProp
    let rpId = rpIdProp
    let allowCredentials: string[] | undefined

    if (!challenge && onRequestChallenge) {
        try {
            const serverChallenge = await onRequestChallenge()
            if (serverChallenge?.challenge) {
                challenge = serverChallenge.challenge
                rpId = serverChallenge.rpId ?? rpId
                allowCredentials = serverChallenge.allowCredentials
            }
        } catch (e) {
            console.error('[WebAuthn] Server challenge request failed:', e)
        }
    }

    const challengeBytes = challenge
        ? decodeChallengeToBytes(challenge)
        : generateRandomChallenge()

    return { challengeBytes, rpId, allowCredentials }
}
