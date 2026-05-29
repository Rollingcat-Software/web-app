import { useState, useCallback, useEffect } from 'react'
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
 * Process-wide singleton CardDetector. The ONNX model (~12 MB YOLOv8n) is
 * fetched + WASM-compiled once and reused by every consumer; `isAvailable()`
 * reports whether the client model loaded.
 */
let sharedDetector: CardDetector | null = null
let detectorInit: Promise<CardDetector> | null = null
function getDetector(): Promise<CardDetector> {
    if (sharedDetector) return Promise.resolve(sharedDetector)
    if (!detectorInit) {
        const d = new CardDetector()
        // initialize() never rejects — on failure it leaves isAvailable()=false.
        detectorInit = d.initialize().then(() => {
            sharedDetector = d
            return d
        })
    }
    return detectorInit
}

/**
 * Hook for ID card-type detection — CLIENT-ONLY.
 *
 * Runs the in-browser ONNX YOLOv8n model (`CardDetector`, onnxruntime-web):
 * zero server round-trip, no GPU, no backend dependency. There is intentionally
 * NO server fallback — card detection is a fully client-side feature (the
 * identity-core-api `/biometric/card-detect` proxy call was removed 2026-05-29).
 * If the model can't load, the hook surfaces an error rather than calling the
 * backend.
 *
 * Detection is video-based (`detector.detect(video)`); the `imageBlob` argument
 * is retained for call-site compatibility but is no longer sent anywhere.
 * Results map onto `CardDetectionResult` (`cardClass`→`cardType`) so callers and
 * the i18n `cardDetection.classLabels.<slug>` keys are unchanged.
 */
export function useCardDetection(): UseCardDetectionReturn {
    const [detecting, setDetecting] = useState(false)
    const [result, setResult] = useState<CardDetectionResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Warm the client model on mount so the first capture doesn't pay the full
    // model-load latency. Fire-and-forget.
    useEffect(() => {
        void getDetector()
    }, [])

    const detectCard = useCallback(
        async (_imageBlob: Blob, video?: HTMLVideoElement | null): Promise<CardDetectionResult | null> => {
            setDetecting(true)
            setError(null)

            try {
                const detector = await getDetector()

                if (!detector.isAvailable()) {
                    // No server fallback by design — report unavailable.
                    const msg = 'Card detector unavailable on this device'
                    setError(msg)
                    const r: CardDetectionResult = {
                        detected: false, cardType: null, confidence: 0, boundingBox: null, message: msg,
                    }
                    setResult(r)
                    return r
                }

                if (!video || video.videoWidth === 0) {
                    // Client inference needs a live video frame.
                    const r: CardDetectionResult = {
                        detected: false, cardType: null, confidence: 0, boundingBox: null,
                        message: 'No camera frame available',
                    }
                    setResult(r)
                    return r
                }

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
            } catch (err) {
                // eslint-disable-next-line no-restricted-syntax -- hook surface; caller wraps with formatApiError + i18n where displayed
                const msg = err instanceof Error ? err.message : 'Card detection failed'
                setError(msg)
                return null
            } finally {
                setDetecting(false)
            }
        },
        [],
    )

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
    }, [])

    return { detecting, result, error, detectCard, reset }
}
