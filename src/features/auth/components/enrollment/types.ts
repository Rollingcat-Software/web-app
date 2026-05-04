/**
 * Shared types for the EnrollmentPage and its per-method sub-components.
 * Extracted from the monolithic EnrollmentPage.tsx during P1-Q7 decomposition
 * (QUALITY_REVIEW_2026-05-01 §T4.2). Pure types only — no runtime code.
 */
import type { AuthMethodType } from '@domain/models/AuthMethod'

/**
 * Device capability detection results.
 * `null` = not yet detected (loading), `boolean` = detected.
 */
export interface DeviceCapabilities {
    camera: boolean | null
    microphone: boolean | null
    webauthnPlatform: boolean | null
    webauthn: boolean | null
    nfc: boolean | null
}

/**
 * Method card configuration — drives both the catalog grid and capability gates.
 */
export interface MethodCardConfig {
    type: AuthMethodType
    label: string
    description: string
    icon: React.ReactNode
    capabilityKey: keyof DeviceCapabilities | null
    alwaysAvailable: boolean
    gradient: string
    bgColor: string
}

/**
 * NFC card data returned by GET /nfc/user/{userId}.
 */
export interface NfcCard {
    cardId: string
    cardSerial: string
    cardType: string
    label: string
    isActive: boolean
    enrolledAt: string
    lastUsedAt: string | null
}

export interface NfcCardsResponse {
    userId: string
    count: number
    activeCount: number
    cards: NfcCard[]
}

/**
 * Snackbar payload — shared between page and per-method flows.
 */
export interface SnackbarState {
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
}

export type ShowSnackbar = (
    message: string,
    severity: SnackbarState['severity']
) => void
