/**
 * The landmark-to-crop transform: the FaceLandmarker mesh is normalized to the
 * camera frame, while the client embedder aligns the mirrored square crop that
 * `cropFaceToDataURL` produces. A landmark must land on the crop pixel that shows
 * the same image point, or the aligner warps the wrong region of the face.
 */
import { describe, it, expect } from 'vitest'
import {
    FACE_CROP_PADDING,
    computeFaceCropRect,
    mapLandmarksToFaceCrop,
} from '../faceCropGeometry'

// 640x480 frame, face box at (256,144) 128x144 px. With 20% padding the square
// side is max(128*1.4, 144*1.4) = 201.6 px, centred on (320,216): origin (219.2,115.2).
const FRAME_W = 640
const FRAME_H = 480
const BBOX = { x: 0.4, y: 0.3, width: 0.2, height: 0.3 }

describe('computeFaceCropRect', () => {
    it('computeFaceCropRect_WhenBoxInsideFrame_ShouldReturnPaddedSquareAroundBoxCentre', () => {
        const rect = computeFaceCropRect(FRAME_W, FRAME_H, BBOX, FACE_CROP_PADDING)
        expect(rect).not.toBeNull()
        expect(rect!.x).toBeCloseTo(219.2, 6)
        expect(rect!.y).toBeCloseTo(115.2, 6)
        expect(rect!.size).toBeCloseTo(201.6, 6)
    })

    it('computeFaceCropRect_WhenBoxOutsideFrame_ShouldReturnNull', () => {
        expect(computeFaceCropRect(FRAME_W, FRAME_H, { x: 2, y: 2, width: 0.1, height: 0.1 })).toBeNull()
        expect(computeFaceCropRect(0, FRAME_H, BBOX)).toBeNull()
    })
})

describe('mapLandmarksToFaceCrop', () => {
    it('mapLandmarksToFaceCrop_WhenFrameLandmarksGiven_ShouldReturnMirroredCropCoordinates', () => {
        const frameLandmarks = [
            // Crop origin -> crop (0,0) -> mirrored (1,0).
            { x: 219.2 / FRAME_W, y: 115.2 / FRAME_H, z: 0 },
            // Box centre -> crop centre, unchanged by the mirror.
            { x: 320 / FRAME_W, y: 216 / FRAME_H, z: 0 },
            // 10% into the crop on both axes -> mirrored (0.9, 0.1).
            { x: (219.2 + 20.16) / FRAME_W, y: (115.2 + 20.16) / FRAME_H, z: 0 },
        ]
        const mapped = mapLandmarksToFaceCrop(frameLandmarks, FRAME_W, FRAME_H, BBOX)
        expect(mapped).not.toBeNull()
        const expected = [
            { x: 1, y: 0 },
            { x: 0.5, y: 0.5 },
            { x: 0.9, y: 0.1 },
        ]
        expected.forEach((e, i) => {
            expect(mapped![i].x).toBeCloseTo(e.x, 6)
            expect(mapped![i].y).toBeCloseTo(e.y, 6)
        })
    })

    it('mapLandmarksToFaceCrop_WhenCropIsClippedByFrameEdge_ShouldKeepUniformScale', () => {
        // Box touching the left edge: the padded square starts left of the frame.
        // The crop keeps one scale on both axes (the clipped part is black), so a
        // landmark maps by the same factor in x and y.
        const bbox = { x: 0, y: 0.3, width: 0.2, height: 0.3 }
        const rect = computeFaceCropRect(FRAME_W, FRAME_H, bbox)!
        expect(rect.x).toBeLessThan(0)
        const p = { x: 64 / FRAME_W, y: 216 / FRAME_H }
        const [m] = mapLandmarksToFaceCrop([p], FRAME_W, FRAME_H, bbox)!
        expect(m.x).toBeCloseTo(1 - (64 - rect.x) / rect.size, 6)
        expect(m.y).toBeCloseTo((216 - rect.y) / rect.size, 6)
        expect(m.y).toBeCloseTo(0.5, 6)
    })

    it('mapLandmarksToFaceCrop_WhenLandmarksMissing_ShouldReturnNull', () => {
        expect(mapLandmarksToFaceCrop(null, FRAME_W, FRAME_H, BBOX)).toBeNull()
        expect(mapLandmarksToFaceCrop([], FRAME_W, FRAME_H, BBOX)).toBeNull()
        expect(mapLandmarksToFaceCrop([{ x: 0.5, y: 0.5 }], FRAME_W, FRAME_H, null)).toBeNull()
    })
})
