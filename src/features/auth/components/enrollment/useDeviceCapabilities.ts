/**
 * Detect available device capabilities (camera, mic, WebAuthn platform/roaming, NFC)
 * once on mount and expose them plus a loading flag.
 *
 * Extracted from EnrollmentPage.tsx during P1-Q7 decomposition. Behavior is
 * unchanged: the same try/catch fall-through rules apply (Brave throws on
 * isUserVerifyingPlatformAuthenticatorAvailable() — we treat as available).
 */
import { useEffect, useState } from 'react'
import type { DeviceCapabilities } from './types'

async function detectCapabilities(): Promise<DeviceCapabilities> {
    const caps: DeviceCapabilities = {
        camera: null,
        microphone: null,
        webauthnPlatform: null,
        webauthn: null,
        nfc: null,
    }

    // Camera check
    try {
        if (navigator.mediaDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices()
            caps.camera = devices.some((d) => d.kind === 'videoinput')
        } else {
            caps.camera = false
        }
    } catch {
        caps.camera = false
    }

    // Microphone check
    try {
        if (navigator.mediaDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices()
            caps.microphone = devices.some((d) => d.kind === 'audioinput')
        } else {
            caps.microphone = false
        }
    } catch {
        caps.microphone = false
    }

    // WebAuthn check
    caps.webauthn = !!window.PublicKeyCredential

    // WebAuthn platform authenticator check
    // Brave throws on isUserVerifyingPlatformAuthenticatorAvailable() — treat as available
    // so users can still attempt enrollment (WebAuthn will prompt for permission)
    try {
        if (window.PublicKeyCredential) {
            caps.webauthnPlatform =
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        } else {
            caps.webauthnPlatform = false
        }
    } catch {
        caps.webauthnPlatform = !!window.PublicKeyCredential
    }

    // NFC check
    caps.nfc = 'NDEFReader' in window

    return caps
}

export function useDeviceCapabilities() {
    const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
        camera: null,
        microphone: null,
        webauthnPlatform: null,
        webauthn: null,
        nfc: null,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        detectCapabilities().then((caps) => {
            setCapabilities(caps)
            setLoading(false)
        })
    }, [])

    return { capabilities, loading }
}
