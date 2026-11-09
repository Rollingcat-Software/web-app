/**
 * cropFaceToDataURL must draw the same square `mapLandmarksToFaceCrop` maps the
 * landmarks into: same source region, one uniform scale, and the horizontal mirror.
 * jsdom has no 2D canvas, so the context is a recording stub; a frame point is
 * projected through the recorded transform and compared with the mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cropFaceToDataURL } from '../faceCropper'
import {
    FACE_CROP_OUTPUT_SIZE,
    computeFaceCropRect,
    mapLandmarksToFaceCrop,
    type NormalizedBox,
} from '../faceCropGeometry'

const FRAME_W = 640
const FRAME_H = 480

interface RecordingContext {
    fillStyle: string
    fillRect: ReturnType<typeof vi.fn>
    translate: ReturnType<typeof vi.fn>
    scale: ReturnType<typeof vi.fn>
    drawImage: ReturnType<typeof vi.fn>
}

let ctx: RecordingContext

function makeSource(): HTMLCanvasElement {
    const source = document.createElement('canvas')
    source.width = FRAME_W
    source.height = FRAME_H
    return source
}

beforeEach(() => {
    ctx = {
        fillStyle: '',
        fillRect: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        () => ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,TEST')
})

afterEach(() => {
    vi.restoreAllMocks()
})

/**
 * Where a frame pixel lands in the output, as a fraction of the output edge:
 * the drawImage source-to-destination map followed by the mirror
 * (translate(outputSize, 0), scale(-1, 1)).
 */
function projectThroughDraw(px: number, py: number): { x: number; y: number } {
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = ctx.drawImage.mock.calls[0] as number[]
    const destX = dx + ((px - sx) * dw) / sw
    const destY = dy + ((py - sy) * dh) / sh
    const [tx] = ctx.translate.mock.calls[0] as number[]
    const [kx, ky] = ctx.scale.mock.calls[0] as number[]
    return { x: (tx + kx * destX) / FACE_CROP_OUTPUT_SIZE, y: (ky * destY) / FACE_CROP_OUTPUT_SIZE }
}

function expectDrawMatchesMapping(bbox: NormalizedBox) {
    const points = [
        { x: (bbox.x + bbox.width * 0.3), y: (bbox.y + bbox.height * 0.4) },
        { x: (bbox.x + bbox.width * 0.7), y: (bbox.y + bbox.height * 0.4) },
        { x: (bbox.x + bbox.width * 0.5), y: (bbox.y + bbox.height * 0.8) },
    ]
    const mapped = mapLandmarksToFaceCrop(points, FRAME_W, FRAME_H, bbox)!
    points.forEach((p, i) => {
        const drawn = projectThroughDraw(p.x * FRAME_W, p.y * FRAME_H)
        expect(drawn.x).toBeCloseTo(mapped[i].x, 9)
        expect(drawn.y).toBeCloseTo(mapped[i].y, 9)
    })
}

describe('cropFaceToDataURL', () => {
    it('cropFaceToDataURL_WhenBoxInsideFrame_ShouldDrawMirroredSquareAtUniformScale', () => {
        const bbox = { x: 0.4, y: 0.3, width: 0.2, height: 0.3 }
        const rect = computeFaceCropRect(FRAME_W, FRAME_H, bbox)!

        const out = cropFaceToDataURL(makeSource(), bbox)

        expect(out).toBe('data:image/jpeg;base64,TEST')
        expect(ctx.translate).toHaveBeenCalledWith(FACE_CROP_OUTPUT_SIZE, 0)
        expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
        expect(ctx.drawImage).toHaveBeenCalledOnce()
        const [, sx, sy, sw, sh, dx, dy, dw, dh] = ctx.drawImage.mock.calls[0] as number[]
        expect(sx).toBeCloseTo(rect.x, 9)
        expect(sy).toBeCloseTo(rect.y, 9)
        expect(sw).toBeCloseTo(rect.size, 9)
        expect(sh).toBeCloseTo(rect.size, 9)
        expect(dx).toBeCloseTo(0, 9)
        expect(dy).toBeCloseTo(0, 9)
        expect(dw).toBeCloseTo(FACE_CROP_OUTPUT_SIZE, 9)
        expect(dh).toBeCloseTo(FACE_CROP_OUTPUT_SIZE, 9)
        expectDrawMatchesMapping(bbox)
    })

    it('cropFaceToDataURL_WhenSquareLeavesFrame_ShouldDrawVisiblePartAtSameScaleOverBlack', () => {
        // Box touching the left edge: the padded square starts left of the frame.
        const bbox = { x: 0, y: 0.3, width: 0.2, height: 0.3 }
        const rect = computeFaceCropRect(FRAME_W, FRAME_H, bbox)!
        expect(rect.x).toBeLessThan(0)

        cropFaceToDataURL(makeSource(), bbox)

        expect(ctx.fillStyle).toBe('#000')
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, FACE_CROP_OUTPUT_SIZE, FACE_CROP_OUTPUT_SIZE)
        const [, sx, , sw, sh, dx, , dw, dh] = ctx.drawImage.mock.calls[0] as number[]
        expect(sx).toBe(0)
        expect(dx).toBeGreaterThan(0)
        // One scale on both axes: no stretching of the visible part.
        expect(dw / sw).toBeCloseTo(dh / sh, 9)
        expect(dw / sw).toBeCloseTo(FACE_CROP_OUTPUT_SIZE / rect.size, 9)
        expectDrawMatchesMapping(bbox)
    })
})
