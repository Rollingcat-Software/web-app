import { describe, it, expect, vi } from 'vitest'
import type { BrowserEnv } from '@features/devbench/deviceProbe'
import {
    lumaStats,
    probeCamera,
    probeTrialEnvironment,
    type MediaEnvironment,
    type ProbeStream,
    type ProbeVideo,
} from '../cameraProbe'

const W = 160
const H = 120

function rgbaOf(luma: number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(W * H * 4)
    for (let i = 0; i < W * H; i++) {
        data[i * 4] = luma
        data[i * 4 + 1] = luma
        data[i * 4 + 2] = luma
        data[i * 4 + 3] = 255
    }
    return data
}

function halfClipped(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(W * H * 4)
    for (let i = 0; i < W * H; i++) {
        const value = i % 2 === 0 ? 0 : 255
        data[i * 4] = value
        data[i * 4 + 1] = value
        data[i * 4 + 2] = value
        data[i * 4 + 3] = 255
    }
    return data
}

interface FakeMediaOptions {
    data?: Uint8ClampedArray
    context?: boolean
    label?: string
    deny?: boolean
    noApi?: boolean
    framesPerSecond?: number
}

function fakeMedia(options: FakeMediaOptions = {}) {
    let t = 0
    const track = {
        label: options.label ?? 'Fake Camera',
        stop: vi.fn(),
        getSettings: () => ({ width: 640, height: 480 }),
    }
    const stream = { getTracks: () => [track] } as unknown as ProbeStream
    const video: ProbeVideo = {
        srcObject: null,
        videoWidth: 640,
        videoHeight: 480,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        getVideoPlaybackQuality: () => ({
            totalVideoFrames: Math.floor((t / 1000) * (options.framesPerSecond ?? 10)),
        }),
    }
    const data = options.data ?? rgbaOf(128)
    const media: MediaEnvironment = {
        getUserMedia: options.noApi
            ? undefined
            : async () => {
                  if (options.deny) throw new Error('NotAllowedError')
                  return stream
              },
        enumerateDevices: async () => [{ kind: 'videoinput', label: 'Fake Camera' }],
        createVideo: () => video,
        createCanvas: () => ({
            width: 0,
            height: 0,
            getContext: () =>
                options.context === false
                    ? null
                    : {
                          drawImage: vi.fn(),
                          getImageData: () => ({ data }),
                      },
        }),
        now: () => t,
        sleep: async (ms) => {
            t += ms
        },
    }
    return { media, track, video }
}

const WINDOWS_ENV: BrowserEnv = {
    userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    screen: { width: 1920, height: 1080 },
    devicePixelRatio: 2,
    timezone: 'Europe/Istanbul',
    crossOriginIsolated: false,
    webgl: () => ({ renderer: 'NVIDIA GeForce RTX 3050', vendor: 'NVIDIA' }),
    hardwareConcurrency: 8,
    deviceMemory: 16,
}

describe('lumaStats', () => {
    it('computes mean luma and clipped fraction', () => {
        const stats = lumaStats(halfClipped())
        expect(stats?.mean).toBeCloseTo(0.5, 6)
        expect(stats?.clippedFraction).toBe(1)
    })

    it('returns null for an empty frame', () => {
        expect(lumaStats(new Uint8ClampedArray(0))).toBeNull()
    })
})

describe('probeCamera', () => {
    it('measures label, resolution, fps, brightness and exposure, then stops the stream', async () => {
        const { media, track } = fakeMedia({ data: rgbaOf(128) })

        const result = await probeCamera(media, { sampleMs: 500, intervalMs: 100 })

        expect(result.cameraLabel).toBe('Fake Camera')
        expect(result.cameraResolution).toBe('640x480')
        // 5 frames over 0.5 s from getVideoPlaybackQuality.
        expect(result.frameRate).toBe(10)
        expect(result.brightness).toBeCloseTo(128 / 255, 3)
        expect(result.exposureScore).toBe(0)
        expect(track.stop).toHaveBeenCalledTimes(1)
    })

    it('computes the clipped-pixel exposure score', async () => {
        const { media } = fakeMedia({ data: halfClipped() })
        const result = await probeCamera(media, { sampleMs: 300, intervalMs: 100 })
        expect(result.brightness).toBeCloseTo(0.5, 3)
        expect(result.exposureScore).toBe(1)
    })

    it('returns nulls when camera access is denied, but still stops nothing and keeps the label', async () => {
        const { media, track } = fakeMedia({ deny: true })
        const result = await probeCamera(media)
        expect(result.cameraLabel).toBe('Fake Camera')
        expect(result.cameraResolution).toBe('')
        expect(result.frameRate).toBeNull()
        expect(result.brightness).toBeNull()
        expect(result.exposureScore).toBeNull()
        expect(track.stop).not.toHaveBeenCalled()
    })

    it('returns label-only when the API is unavailable', async () => {
        const { media } = fakeMedia({ noApi: true })
        const result = await probeCamera(media)
        expect(result).toEqual({
            cameraLabel: 'Fake Camera',
            cameraResolution: '',
            frameRate: null,
            brightness: null,
            exposureScore: null,
        })
    })

    it('still reports the frame rate when the 2d context is unavailable', async () => {
        const { media } = fakeMedia({ context: false })
        const result = await probeCamera(media, { sampleMs: 300, intervalMs: 100 })
        expect(result.brightness).toBeNull()
        expect(result.exposureScore).toBeNull()
        expect(result.frameRate).toBe(10)
    })
})

describe('probeTrialEnvironment', () => {
    it('composes the device and env snapshots from the injected browser and media', async () => {
        const { media } = fakeMedia({ data: rgbaOf(128) })
        const at = new Date(2026, 10, 25, 21, 14)

        const result = await probeTrialEnvironment({ browser: WINDOWS_ENV, media, sampleMs: 500, at })

        expect(result.device).toMatchObject({
            os: 'Windows',
            browser: 'Chrome 130.0.0.0',
            screen: '1920x1080@2',
            cameraLabel: 'Fake Camera',
            cameraResolution: '640x480',
            hardwareConcurrency: 8,
            deviceMemoryGB: 16,
            type: 'computer',
        })
        expect(result.device.label).toContain('Windows')
        expect(result.env).toEqual({
            localTimeOfDay: '21:14',
            brightness: expect.closeTo(128 / 255, 3),
            exposureScore: 0,
            frameRate: 10,
        })
    })

    it('never throws when the camera and device probes both fail', async () => {
        const broken: BrowserEnv = {
            ...WINDOWS_ENV,
            screen: undefined as unknown as BrowserEnv['screen'],
        }
        const media: MediaEnvironment = {
            getUserMedia: undefined,
            enumerateDevices: async () => [],
            createVideo: () => {
                throw new Error('no video')
            },
            createCanvas: () => {
                throw new Error('no canvas')
            },
            now: () => 0,
            sleep: async () => undefined,
        }

        const result = await probeTrialEnvironment({ browser: broken, media, at: new Date(2026, 10, 25, 8, 5) })

        expect(result.env.localTimeOfDay).toBe('08:05')
        expect(result.device.cameraLabel).toBe('')
        expect(result.device.type).toBe('computer')
    })
})