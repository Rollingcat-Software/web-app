import { useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'

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
    detectCard: (imageBlob: Blob) => Promise<CardDetectionResult | null>
    reset: () => void
}

/**
 * Hook for server-side card detection using YOLO API.
 *
 * Sends a captured image to the identity-core-api card-detect endpoint
 * which proxies to the biometric-processor YOLO model.
 */
export function useCardDetection(): UseCardDetectionReturn {
    const tokenService = useService<ITokenService>(TYPES.TokenService)
    const [detecting, setDetecting] = useState(false)
    const [result, setResult] = useState<CardDetectionResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    const detectCard = useCallback(async (imageBlob: Blob): Promise<CardDetectionResult | null> => {
        setDetecting(true)
        setError(null)

        // Abort any in-flight request
        if (abortRef.current) {
            abortRef.current.abort()
        }
        abortRef.current = new AbortController()

        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.fivucsas.com/api/v1'
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
        } catch (err) {
            if (axios.isCancel(err)) return null
            const msg = err instanceof Error ? err.message : 'Card detection failed'
            setError(msg)
            return null
        } finally {
            setDetecting(false)
        }
    }, [])

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
