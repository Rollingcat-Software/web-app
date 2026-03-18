import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { getBiometricService } from '@core/services/BiometricService'

export type VerificationStatus = 'idle' | 'verified' | 'checking' | 'failed' | 'disabled'

interface ContinuousVerificationOptions {
    /** Interval between checks in seconds (default: 45) */
    intervalSeconds?: number
    /** Number of consecutive failures before warning (default: 3) */
    warningThreshold?: number
    /** Number of consecutive failures before auto-logout (default: 5) */
    logoutThreshold?: number
}

interface ContinuousVerificationReturn {
    /** Current verification status */
    status: VerificationStatus
    /** Whether continuous verification is enabled */
    enabled: boolean
    /** Toggle continuous verification on/off */
    setEnabled: (enabled: boolean) => void
    /** Number of consecutive failures */
    failureCount: number
    /** Whether the warning threshold has been reached */
    showWarning: boolean
    /** Reference to attach to a video element for camera preview */
    videoRef: React.RefObject<HTMLVideoElement | null>
    /** Last verification confidence score */
    lastConfidence: number
    /** Manually trigger a verification check */
    verifyNow: () => Promise<void>
}

const STORAGE_KEY = 'fivucsas-continuous-verification'

/**
 * Hook for optional continuous face verification during sessions.
 *
 * Opens camera in background, periodically captures a frame and sends it
 * to the biometric verify endpoint. Tracks consecutive failures and can
 * auto-logout the user after too many.
 *
 * Usage:
 *   const { status, enabled, setEnabled, videoRef, showWarning } = useContinuousVerification()
 *   // Render a <video ref={videoRef} /> somewhere for the camera preview
 */
export function useContinuousVerification(
    options: ContinuousVerificationOptions = {}
): ContinuousVerificationReturn {
    const {
        intervalSeconds = 45,
        warningThreshold = 3,
        logoutThreshold = 5,
    } = options

    const { user, logout } = useAuth()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const mountedRef = useRef(true)

    const [enabled, setEnabledState] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true'
        } catch {
            return false
        }
    })
    const [status, setStatus] = useState<VerificationStatus>(enabled ? 'idle' : 'disabled')
    const [failureCount, setFailureCount] = useState(0)
    const [lastConfidence, setLastConfidence] = useState(0)

    const setEnabled = useCallback((value: boolean) => {
        setEnabledState(value)
        try {
            localStorage.setItem(STORAGE_KEY, String(value))
        } catch {
            // localStorage might be unavailable
        }
        if (!value) {
            setStatus('disabled')
            setFailureCount(0)
        }
    }, [])

    // Capture a frame from the video element as base64
    const captureFrame = useCallback((): string | null => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return null

        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas')
        }
        const canvas = canvasRef.current
        canvas.width = 320
        canvas.height = 240
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, 320, 240)
        return canvas.toDataURL('image/jpeg', 0.8)
    }, [])

    // Perform a single verification check
    const verifyNow = useCallback(async () => {
        if (!user?.id || !enabled) return

        const frame = captureFrame()
        if (!frame) return

        setStatus('checking')
        try {
            const biometric = getBiometricService()
            const result = await biometric.verifyFace(user.id, frame)

            if (!mountedRef.current) return

            if (result.verified) {
                setStatus('verified')
                setFailureCount(0)
                setLastConfidence(result.confidence)
            } else {
                setStatus('failed')
                setFailureCount(prev => {
                    const next = prev + 1
                    if (next >= logoutThreshold) {
                        // Auto-logout after too many failures
                        logout()
                    }
                    return next
                })
                setLastConfidence(result.confidence)
            }
        } catch {
            if (!mountedRef.current) return
            setStatus('failed')
            setFailureCount(prev => prev + 1)
        }
    }, [user?.id, enabled, captureFrame, logoutThreshold, logout])

    // Start/stop camera stream
    useEffect(() => {
        if (!enabled || !user?.id) {
            // Stop stream if disabled
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }
            return
        }

        let cancelled = false

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, facingMode: 'user' },
                    audio: false,
                })
                if (cancelled) {
                    stream.getTracks().forEach(track => track.stop())
                    return
                }
                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.play().catch(() => {})
                }
                setStatus('idle')
            } catch {
                // Camera access denied or unavailable
                setStatus('failed')
            }
        }

        startCamera()

        return () => {
            cancelled = true
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }
        }
    }, [enabled, user?.id])

    // Set up periodic verification
    useEffect(() => {
        if (!enabled || !user?.id) return

        // Wait a bit before first check to let camera initialize
        const timeout = setTimeout(() => {
            verifyNow()
        }, 5000)

        intervalRef.current = setInterval(() => {
            verifyNow()
        }, intervalSeconds * 1000)

        return () => {
            clearTimeout(timeout)
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [enabled, user?.id, intervalSeconds, verifyNow])

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [])

    return {
        status,
        enabled,
        setEnabled,
        failureCount,
        showWarning: failureCount >= warningThreshold && failureCount < logoutThreshold,
        videoRef,
        lastConfidence,
        verifyNow,
    }
}
