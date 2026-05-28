import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { config as envConfig } from '@config/env'
import { CardDetector } from '../lib/biometric-engine/core/CardDetector'

export interface CardDetectionResult {
    detected: boolean
    cardType: string | null
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number } | null
    message: string
}

interface UseCardDetectionReturn {
    detecting: boolean
    result: CardDetectionResult | null
    error: string | null
    detectCard: (imageBlob: Blob, video?: HTMLVideoElement | null) => Promise<CardDetectionResult | null>
    reset: () => void
}

/**
 * Process-wide singleton CardDetector. The ONNX model is large (~50 MB) and
 * loading it per-hook-instance would re-download + re-compile the WASM session
 * on every mount. One shared instance, lazily initialized once, is reused by
 * every consumer. `getDetector()` resolves to a CardDetector whose
 * `isAvailable()` tells callers whether the client model actually loaded.
 */
let sharedDetector: CardDetector | null = null
let detectorInit: Promise<CardDetector> | null = null
function getDetector(): Promise<CardDetector> {
    if (sharedDetector) return Promise.resolve(sharedDetector)
    if (!detectorInit) {
        const d = new CardDetector()
        // initialize() never rejects — on failure it leaves isAvailable()=false,
        // so the hook transparently falls back to the server path.
        detectorInit = d.initialize().then(() => {
            sharedDetector = d
            return d
        })
    }
    return detectorInit
}

/**
 * Hook for ID card-type detection — client-first.
 *
 * Prefers the in-browser ONNX YOLO model (`CardDetector`, onnxruntime-web):
 * zero server round-trip, no GPU, runs entirely on the client. Falls back to
 * the identity-core-api `/biometric/card-detect` endpoint (which proxies the
 * biometric-processor YOLO) only when the client model cannot be loaded
 * (offline, OOM, or model fetch failure).
 *
 * The client detector is video-based + single-shot here (`useSmoothing=false`)
 * to match the page's capture-then-detect UX; its result is mapped onto the
 * existing `CardDetectionResult` shape (`cardClass`→`cardType`) so callers and
 * the i18n `cardDetection.classLabels.<slug>` keys are unchanged.
 */
export function useCardDetection(): UseCardDetectionReturn {
    const tokenService = useService<ITokenService>(TYPES.TokenService)
    const [detecting, setDetecting] = useState(false)
    const [result, setResult] = useState<CardDetectionResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    // Warm the client model as soon as the page mounts so the first capture
    // doesn't pay the full model-load latency. Fire-and-forget; failures are
    // swallowed (server fallback covers them).
    useEffect(() => {
        void getDetector()
    }, [])

    const detectViaServer = useCallback(async (imageBlob: Blob): Promise<CardDetectionResult | null> => {
        // Abort any in-flight request
        if (abortRef.current) {
            abortRef.current.abort()
        }
        abortRef.current = new AbortController()

        const apiUrl = envConfig.apiBaseUrl
        const formData = new FormData()
        formData.append('file', imageBlob, 'capture.jpg')

        // Get token from TokenService (consolidated storage)
        const token = (await tokenService.getAccessToken()) || ''

        const response = await axios.post(`${apiUrl}/biometric/card-detect`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            timeout: 30000,
            signal: abortRef.current.signal,
        })

        const data = response.data
        const detectionResult: CardDetectionResult = {
            detected: data.detected ?? data.success ?? false,
            cardType: data.class_name ?? data.card_type ?? data.cardType ?? null,
            confidence: data.confidence ?? 0,
            boundingBox: data.bounding_box ?? data.boundingBox ?? null,
            message: data.message ?? (data.detected ? 'Card detected' : 'No card detected'),
        }
        setResult(detectionResult)
        return detectionResult
    }, [tokenService])

    const detectCard = useCallback(async (imageBlob: Blob, video?: HTMLVideoElement | null): Promise<CardDetectionResult | null> => {
        setDetecting(true)
        setError(null)

        try {
            // --- Client-first: in-browser ONNX inference, no server round-trip ---
            if (video && video.videoWidth > 0) {
                const detector = await getDetector()
                if (detector.isAvailable()) {
                    const c = await detector.detect(video, false)
                    const mapped: CardDetectionResult = {
                        detected: c.detected,
                        cardType: c.cardClass,
                        confidence: c.confidence,
                        boundingBox: c.boundingBox,
                        message: c.cardLabel ?? (c.detected ? 'Card detected' : 'No card detected'),
                    }
                    setResult(mapped)
                    return mapped
                }
            }

            // --- Fallback: server YOLO (model unavailable / no video element) ---
            return await detectViaServer(imageBlob)
        } catch (err) {
            if (axios.isCancel(err)) return null
            // eslint-disable-next-line no-restricted-syntax -- hook surface; caller wraps with formatApiError + i18n where displayed
            const msg = err instanceof Error ? err.message : 'Card detection failed'
            setError(msg)
            return null
        } finally {
            setDetecting(false)
        }
    }, [detectViaServer])

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
        if (abortRef.current) {
            abortRef.current.abort()
            abortRef.current = null
        }
    }, [])

    return { detecting, result, error, detectCard, reset }
}
