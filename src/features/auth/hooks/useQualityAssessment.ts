import { useState, useCallback, useRef } from 'react'

interface Landmark {
    x: number
    y: number
    z?: number
}

export interface QualityResult {
    blur: number           // 0-100 sharpness score
    blurVariance: number   // raw Laplacian variance
    lighting: number       // 0-100 lighting score
    brightness: number     // mean brightness 0-255
    faceSize: number       // face size in pixels (min dimension)
    faceSizeScore: number  // 0-100 face size score
    overall: number        // 0-100 weighted overall score
    acceptable: boolean    // overall >= 40
}

const INITIAL_QUALITY: QualityResult = {
    blur: 0,
    blurVariance: 0,
    lighting: 0,
    brightness: 0,
    faceSize: 0,
    faceSizeScore: 0,
    overall: 0,
    acceptable: false,
}

/**
 * Compute quality assessment from video frame + optional face landmarks.
 * Mirrors auth-test's assessQuality() — Laplacian blur, mean brightness, face size.
 */
function assessQuality(video: HTMLVideoElement, landmarks?: Landmark[]): QualityResult {
    const w = video.videoWidth
    const h = video.videoHeight
    if (w === 0 || h === 0) return INITIAL_QUALITY

    const offCanvas = document.createElement('canvas')
    offCanvas.width = w
    offCanvas.height = h
    const offCtx = offCanvas.getContext('2d')
    if (!offCtx) return INITIAL_QUALITY

    offCtx.drawImage(video, 0, 0, w, h)
    const imageData = offCtx.getImageData(0, 0, w, h)
    const pixels = imageData.data
    const totalPixels = w * h

    // 1. Convert to grayscale
    const gray = new Float32Array(totalPixels)
    for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4
        gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]
    }

    // 2. Lighting — mean brightness
    let brightnessSum = 0
    for (let i = 0; i < totalPixels; i++) {
        brightnessSum += gray[i]
    }
    const meanBrightness = brightnessSum / totalPixels

    let lightingScore: number
    if (meanBrightness >= 80 && meanBrightness <= 180) {
        lightingScore = 100
    } else if (meanBrightness < 80) {
        lightingScore = Math.max(0, (meanBrightness / 80) * 100)
    } else {
        lightingScore = Math.max(0, ((255 - meanBrightness) / 75) * 100)
    }

    // 3. Blur detection — Laplacian variance (sampled every 4th pixel)
    let lapSum = 0
    let lapSumSq = 0
    let lapCount = 0
    const step = 4
    for (let y = 1; y < h - 1; y += step) {
        for (let x = 1; x < w - 1; x += step) {
            const center = gray[y * w + x]
            const lap = -4 * center
                + gray[(y - 1) * w + x]
                + gray[(y + 1) * w + x]
                + gray[y * w + (x - 1)]
                + gray[y * w + (x + 1)]
            lapSum += lap
            lapSumSq += lap * lap
            lapCount++
        }
    }
    const lapMean = lapSum / lapCount
    const lapVariance = (lapSumSq / lapCount) - (lapMean * lapMean)

    // Phone front cameras typically produce Laplacian variance in the 80–250
    // range due to JPEG compression and small sensors, well below the 500
    // threshold that desktop webcams can reach. Calibrate to mobile reality
    // so users don't see the quality chip stuck at 70 / "orta" forever.
    const BLUR_LOW = 15.0
    const BLUR_HIGH = 220.0
    let blurScore: number
    if (lapVariance <= BLUR_LOW) {
        blurScore = 0
    } else if (lapVariance >= BLUR_HIGH) {
        blurScore = 100
    } else {
        blurScore = ((lapVariance - BLUR_LOW) / (BLUR_HIGH - BLUR_LOW)) * 100
    }

    // 4. Face size
    let faceSizePx = 0
    let faceSizeScore = 0
    if (landmarks && landmarks.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const lm of landmarks) {
            const lx = lm.x * w
            const ly = lm.y * h
            if (lx < minX) minX = lx
            if (ly < minY) minY = ly
            if (lx > maxX) maxX = lx
            if (ly > maxY) maxY = ly
        }
        faceSizePx = Math.min(maxX - minX, maxY - minY)
        if (faceSizePx <= 80) {
            faceSizeScore = 0
        } else if (faceSizePx >= 250) {
            faceSizeScore = 100
        } else {
            faceSizeScore = ((faceSizePx - 80) / (250 - 80)) * 100
        }
    }

    // 5. Overall: weighted average
    const overall = blurScore * 0.4 + lightingScore * 0.3 + faceSizeScore * 0.3

    return {
        blur: Math.round(blurScore),
        blurVariance: Math.round(lapVariance),
        lighting: Math.round(lightingScore),
        brightness: Math.round(meanBrightness),
        faceSize: Math.round(faceSizePx),
        faceSizeScore: Math.round(faceSizeScore),
        overall: Math.round(overall),
        acceptable: overall >= 40,
    }
}

/**
 * useQualityAssessment — Real-time blur/lighting/size feedback from video
 *
 * Throttled to every 500ms for performance (full-frame pixel analysis).
 * Pass face landmarks from FaceLandmarker for face size scoring.
 */
export function useQualityAssessment() {
    const [quality, setQuality] = useState<QualityResult>(INITIAL_QUALITY)
    const lastUpdateRef = useRef(0)
    const THROTTLE_MS = 500

    /**
     * Call this from the detection/render loop.
     * It throttles internally so safe to call every frame.
     */
    const updateQuality = useCallback((
        video: HTMLVideoElement,
        landmarks?: Landmark[],
    ) => {
        const now = performance.now()
        if (now - lastUpdateRef.current < THROTTLE_MS) return

        lastUpdateRef.current = now
        const result = assessQuality(video, landmarks)
        setQuality(result)
    }, [])

    const resetQuality = useCallback(() => {
        setQuality(INITIAL_QUALITY)
        lastUpdateRef.current = 0
    }, [])

    /**
     * Get color for a score value
     */
    const getScoreColor = useCallback((score: number): 'success' | 'warning' | 'error' => {
        if (score >= 65) return 'success'
        if (score >= 40) return 'warning'
        return 'error'
    }, [])

    /**
     * Get i18n key suffix for overall quality. Callers translate via
     * `t('mfa.face.qualityLabel.<key>')` so Turkish users see Turkish labels
     * on the face-login quality chip instead of hardcoded English.
     */
    const getQualityLabel = useCallback((score: number): 'good' | 'fair' | 'poor' => {
        if (score >= 65) return 'good'
        if (score >= 40) return 'fair'
        return 'poor'
    }, [])

    return { quality, updateQuality, resetQuality, getScoreColor, getQualityLabel }
}
