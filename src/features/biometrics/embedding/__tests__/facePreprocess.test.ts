/**
 * facePreprocess: the channel order and the pipeline id are pinned here.
 *
 * Facenet512 (Inception ResNet v1, davidsandberg/facenet 2018 weights, converted
 * to Keras by DeepFace) was trained on images decoded with
 * `tf.image.decode_image(contents, 3)`, which yields RGB. The tensor must
 * therefore carry R, G, B in that order. Before FACE_EMBEDDING_PIPELINE
 * `client-facenet512-align2-rgb` the browser packed BGR to copy DeepFace's
 * runtime flip; on LFW View 2 that cost 0.7 EER points (fivucsas-papers
 * bench/lfw-browser-aligned).
 */
import { describe, it, expect } from 'vitest'
import {
    preprocessFace,
    FACENET_CHANNEL_ORDER,
    FACENET_INPUT_SIZE,
    type RgbaImage,
} from '../facePreprocess'
import { FACE_EMBEDDING_PIPELINE } from '../embeddingPipeline'
import { FACE_ALIGNMENT_VERSION } from '../alignFace'

function solidImage(width: number, height: number, rgb: [number, number, number]): RgbaImage {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < data.length; i += 4) {
        data[i] = rgb[0]
        data[i + 1] = rgb[1]
        data[i + 2] = rgb[2]
        data[i + 3] = 255
    }
    return { width, height, data }
}

function centrePixel(tensor: Float32Array): [number, number, number] {
    const c = Math.floor(FACENET_INPUT_SIZE / 2)
    const i = (c * FACENET_INPUT_SIZE + c) * 3
    return [tensor[i], tensor[i + 1], tensor[i + 2]]
}

describe('preprocessFace channel order', () => {
    it('preprocessFace_WhenPixelIsPureRed_ShouldPutRedInTheFirstChannel', () => {
        const tensor = preprocessFace(solidImage(160, 160, [255, 0, 0]))

        expect(centrePixel(tensor)).toEqual([1, 0, 0])
    })

    it('preprocessFace_WhenChannelsDiffer_ShouldKeepRgbOrderScaledToUnitRange', () => {
        const tensor = preprocessFace(solidImage(160, 160, [51, 102, 204]))

        const [r, g, b] = centrePixel(tensor)
        expect(r).toBeCloseTo(51 / 255, 6)
        expect(g).toBeCloseTo(102 / 255, 6)
        expect(b).toBeCloseTo(204 / 255, 6)
    })

    it('FACENET_CHANNEL_ORDER_WhenRead_ShouldBeRgb', () => {
        expect(FACENET_CHANNEL_ORDER).toBe('RGB')
    })
})

describe('FACE_EMBEDDING_PIPELINE', () => {
    it('FACE_EMBEDDING_PIPELINE_WhenDerived_ShouldNameAlignmentVersionAndChannelOrder', () => {
        expect(FACE_EMBEDDING_PIPELINE).toBe(
            `client-facenet512-align${FACE_ALIGNMENT_VERSION}-${FACENET_CHANNEL_ORDER.toLowerCase()}`,
        )
        expect(FACE_EMBEDDING_PIPELINE).toBe('client-facenet512-align2-rgb')
    })
})
