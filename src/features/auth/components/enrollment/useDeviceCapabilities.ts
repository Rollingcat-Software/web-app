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

    // Camera + microphone — enumerate once and derive both. Copilot review on
    // PR #69: previously enumerateDevices() ran twice on mount, doubling the
    // permission-prompt cost on browsers that gate device labels behind grant.
    try {
        if (navigator.mediaDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices()
            caps.camera = devices.some((d) => d.kind === 'videoinput')
            caps.microphone = devices.some((d) => d.kind === 'audioinput')
        } else {
            caps.camera = false
            caps.microphone = false
        }
    } catch {
        caps.camera = false
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
        // Copilot review on PR #70: detectCapabilities() resolves
        // asynchronously after mount; without a mounted-flag guard, a fast
        // unmount can produce React 'setState on unmounted component'
        // warnings.
        let mounted = true
        detectCapabilities().then((caps) => {
            if (!mounted) return
            setCapabilities(caps)
            setLoading(false)
        })
        return () => {
            mounted = false
        }
    }, [])

    return { capabilities, loading }
}
