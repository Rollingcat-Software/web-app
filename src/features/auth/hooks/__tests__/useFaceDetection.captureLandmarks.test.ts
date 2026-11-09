/**
 * useFaceDetection.captureLandmarks must hand the client aligner the 478-point mesh
 * in the frame of the crop `cropFace` returns (same box, padding and mirror), not
 * the camera-frame mesh. Returning the camera-frame mesh was the K9 defect
 * (LFW View 2 EER 8.92% against 3.27%).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { NormalizedLandmark } from '../../../../lib/biometric-engine/types'
import { mapLandmarksToFaceCrop } from '../../utils/faceCropGeometry'

const FRAME_W = 640
const FRAME_H = 480
const FACE_BOX_PX = { x: 240, y: 150, width: 160, height: 180 }

// A mesh with distinct points, so a missing mirror or offset changes the result.
const MESH: NormalizedLandmark[] = Array.from({ length: 478 }, (_, i) => ({
    x: 0.4 + (0.2 * i) / 477,
    y: 0.35 + (0.3 * ((i * 7) % 478)) / 477,
    z: 0,
}))

let detections: unknown[] = []

vi.mock('../../../../lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            isReady: () => true,
            initialize: async () => {},
            faceDetector: {
                isAvailable: () => true,
                detect: () => detections,
            },
            headPoseEstimator: { isAvailable: () => false },
            metricsCalculator: { calculateAll: () => ({ eyes: { avgEAR: 0.3 } }) },
        }),
    },
}))

vi.mock('../../../../lib/ml/useBlazeFace', () => ({
    useBlazeFace: () => ({ isReady: false, isLoading: false, error: null }),
}))

import { useFaceDetection } from '../useFaceDetection'

let rafCb: FrameRequestCallback | null = null

beforeEach(() => {
    rafCb = null
    detections = [{ boundingBox: FACE_BOX_PX, confidence: 0.99, landmarks478: MESH }]
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafCb = cb
        return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
})

function makeVideo(): HTMLVideoElement {
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: FRAME_W, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: FRAME_H, configurable: true })
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true })
    return video
}

async function runOneDetectionFrame() {
    const cb = rafCb
    rafCb = null
    expect(cb).not.toBeNull()
    await act(async () => {
        cb!(performance.now())
    })
}

describe('useFaceDetection.captureLandmarks', () => {
    it('captureLandmarks_WhenLandmarkerDetectsFace_ShouldReturnMeshInMirroredCropFrame', async () => {
        const videoRef = { current: makeVideo() }
        const { result } = renderHook(() => useFaceDetection(videoRef, true))
        await act(async () => {})
        await runOneDetectionFrame()

        const box = result.current.boundingBox
        expect(box).not.toBeNull()
        const captured = result.current.captureLandmarks()
        const expected = mapLandmarksToFaceCrop(MESH, FRAME_W, FRAME_H, box)

        expect(captured).not.toBeNull()
        expect(captured).toHaveLength(478)
        expect(captured).toEqual(expected)
        // Not the camera-frame mesh.
        expect(captured![0].x).not.toBeCloseTo(MESH[0].x, 3)
        // Mirrored: the leftmost frame point ends up rightmost in the crop.
        expect(captured![0].x).toBeGreaterThan(captured![477].x)
    })

    it('captureLandmarks_WhenNoFaceDetected_ShouldReturnNull', async () => {
        detections = []
        const videoRef = { current: makeVideo() }
        const { result } = renderHook(() => useFaceDetection(videoRef, true))
        await act(async () => {})
        await runOneDetectionFrame()

        expect(result.current.captureLandmarks()).toBeNull()
    })
})
