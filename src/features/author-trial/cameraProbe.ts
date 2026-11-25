/**
 * Best-effort device + camera probe for the author trial.
 *
 * The browser objects are injected ({@link MediaEnvironment}, devbench's
 * {@link BrowserEnv}) so the maths and failure paths are unit-testable with no
 * DOM and no camera. Every probe is best effort: a missing/throwing API yields
 * empty strings / nulls, never an exception. The camera stream is ALWAYS
 * stopped in `finally`, including on failure.
 *
 * What is measured (contract §3.2): camera label + resolution, frame rate over
 * the sample window, mean luma brightness 0..1, and the clipped-pixel fraction
 * (`exposureScore` 0..1). The frame itself is drawn to an offscreen canvas and
 * discarded; no image is retained or sent.
 */
import {
    browserEnv,
    probeDevice,
    browserInfo,
    guessType,
    platformName,
    type BrowserEnv,
} from '@features/devbench/deviceProbe'
import {
    CAMERA_SAMPLE_INTERVAL_MS,
    CAMERA_SAMPLE_MS,
    clampNumber,
    localTimeOfDay,
    round3,
    sanitizeDeviceSnapshot,
    sanitizeEnvSnapshot,
    sanitizeText,
    screenLabel,
    type AuthorTrialDeviceSnapshot,
    type AuthorTrialEnvSnapshot,
} from './protocol'

/** Minimal track surface; a real `MediaStreamTrack` satisfies it. */
export interface ProbeTrack {
    label?: string
    stop(): void
    getSettings?(): { width?: number; height?: number; deviceId?: string }
}

export interface ProbeStream {
    getTracks(): ProbeTrack[]
    getVideoTracks?(): ProbeTrack[]
}

export interface ProbeVideo {
    srcObject: unknown
    videoWidth: number
    videoHeight: number
    play(): Promise<void> | void
    pause?(): void
    getVideoPlaybackQuality?(): { totalVideoFrames?: number }
    requestVideoFrameCallback?(callback: (now: number) => void): number
    cancelVideoFrameCallback?(handle: number): void
}

export interface ProbeCanvasContext {
    drawImage(source: ProbeVideo, dx: number, dy: number, dw: number, dh: number): void
    getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> }
}

export interface ProbeCanvas {
    width: number
    height: number
    getContext(type: '2d'): ProbeCanvasContext | null
}

export interface ProbeDeviceInfo {
    kind?: string
    label?: string
    deviceId?: string
}

/**
 * The browser media surface the probe reads. Injecting it is what makes the
 * probe testable; `browserMediaEnvironment()` is the real implementation.
 */
export interface MediaEnvironment {
    getUserMedia?: (constraints: MediaStreamConstraints) => Promise<ProbeStream>
    enumerateDevices?: () => Promise<ProbeDeviceInfo[]>
    createVideo: () => ProbeVideo
    createCanvas: () => ProbeCanvas
    now: () => number
    sleep: (ms: number) => Promise<void>
}

export interface CameraProbe {
    cameraLabel: string
    /** `WxH`. */
    cameraResolution: string
    frameRate: number | null
    /** 0..1 mean luma. */
    brightness: number | null
    /** 0..1 fraction of pixels clipped at black/white. */
    exposureScore: number | null
}

export interface TrialProbeResult {
    device: AuthorTrialDeviceSnapshot
    env: AuthorTrialEnvSnapshot
    camera: CameraProbe
}

export interface TrialProbeOptions {
    browser?: BrowserEnv
    media?: MediaEnvironment
    /** Measurement window; defaults to {@link CAMERA_SAMPLE_MS}. */
    sampleMs?: number
    /** Clock used for `localTimeOfDay` (tests). */
    at?: Date
}

const EMPTY_CAMERA: CameraProbe = Object.freeze({
    cameraLabel: '',
    cameraResolution: '',
    frameRate: null,
    brightness: null,
    exposureScore: null,
})

const SAMPLE_WIDTH = 160
const SAMPLE_HEIGHT = 120
const CLIP_LOW = 0.02
const CLIP_HIGH = 0.98

/** The real browser media surface, read lazily at call time. */
export function browserMediaEnvironment(): MediaEnvironment {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    const mediaDevices = nav?.mediaDevices as MediaDevices | undefined
    return {
        getUserMedia: mediaDevices?.getUserMedia
            ? (constraints) => mediaDevices.getUserMedia(constraints) as unknown as Promise<ProbeStream>
            : undefined,
        enumerateDevices: mediaDevices?.enumerateDevices
            ? () => mediaDevices.enumerateDevices() as unknown as Promise<ProbeDeviceInfo[]>
            : undefined,
        createVideo: () => {
            const video = document.createElement('video')
            video.muted = true
            video.autoplay = true
            video.setAttribute('playsinline', '')
            return video as unknown as ProbeVideo
        },
        createCanvas: () => document.createElement('canvas') as unknown as ProbeCanvas,
        now: () => performance.now(),
        sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    }
}

function positiveInt(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function readTotalFrames(video: ProbeVideo): number | null {
    try {
        const frames = video.getVideoPlaybackQuality?.().totalVideoFrames
        return typeof frames === 'number' && Number.isFinite(frames) ? frames : null
    } catch {
        return null
    }
}

/** Mean luma + clipped fraction of one RGBA frame, or null when empty. */
export function lumaStats(data: ArrayLike<number>): { mean: number; clippedFraction: number } | null {
    const pixels = Math.floor(data.length / 4)
    if (pixels <= 0) return null
    let sum = 0
    let clipped = 0
    for (let i = 0; i < pixels; i++) {
        const o = i * 4
        const luma = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255
        sum += luma
        if (luma <= CLIP_LOW || luma >= CLIP_HIGH) clipped++
    }
    return { mean: sum / pixels, clippedFraction: clipped / pixels }
}

async function firstVideoDeviceLabel(media: MediaEnvironment): Promise<string> {
    try {
        const devices = await media.enumerateDevices?.()
        const camera = devices?.find((d) => d.kind === 'videoinput' && sanitizeText(d.label, 80).length > 0)
        return sanitizeText(camera?.label, 80)
    } catch {
        return ''
    }
}

interface VideoStats {
    frameRate: number | null
    brightness: number | null
    exposureScore: number | null
}

/** Samples luma + counts frames over the window; never throws. */
async function measureVideo(
    media: MediaEnvironment,
    video: ProbeVideo,
    sampleMs: number,
    intervalMs: number,
): Promise<VideoStats> {
    let context: ProbeCanvasContext | null = null
    try {
        const canvas = media.createCanvas()
        canvas.width = SAMPLE_WIDTH
        canvas.height = SAMPLE_HEIGHT
        context = canvas.getContext('2d')
    } catch {
        context = null
    }

    const framesStart = readTotalFrames(video)
    let callbackFrames = 0
    let callbackHandle: number | null = null
    if (video.requestVideoFrameCallback) {
        try {
            const onFrame = () => {
                callbackFrames++
                if (video.requestVideoFrameCallback) callbackHandle = video.requestVideoFrameCallback(onFrame)
            }
            callbackHandle = video.requestVideoFrameCallback(onFrame)
        } catch {
            callbackHandle = null
        }
    }

    const duration = Math.min(10_000, Math.max(100, sampleMs))
    const interval = Math.min(1_000, Math.max(10, intervalMs))
    const start = media.now()
    let samples = 0
    let lumaSum = 0
    let clippedSum = 0
    let frameSamples = 0

    try {
        while (media.now() - start < duration) {
            await media.sleep(interval)
            samples++
            if (!context) continue
            try {
                context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
                const stats = lumaStats(context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data)
                if (stats) {
                    lumaSum += stats.mean
                    clippedSum += stats.clippedFraction
                    frameSamples++
                }
            } catch {
                // A single bad frame (not ready, zero-sized) must not fail the probe.
            }
        }
    } finally {
        if (callbackHandle != null) {
            try {
                video.cancelVideoFrameCallback?.(callbackHandle)
            } catch {
                // ignore
            }
        }
    }

    const elapsedSeconds = Math.max(0.001, (media.now() - start) / 1000)
    const framesEnd = readTotalFrames(video)
    let frameRate: number | null = null
    if (framesStart != null && framesEnd != null && framesEnd >= framesStart) {
        frameRate = (framesEnd - framesStart) / elapsedSeconds
    } else if (callbackFrames > 0) {
        frameRate = callbackFrames / elapsedSeconds
    } else if (samples > 0) {
        // Fallback: sampled frames per second (a lower bound on the display rate).
        frameRate = samples / elapsedSeconds
    }
    if (frameRate == null || !Number.isFinite(frameRate) || frameRate <= 0) frameRate = null

    return {
        frameRate: frameRate == null ? null : clampNumber(frameRate, 0, 240, 1),
        brightness: frameSamples > 0 ? round3(lumaSum / frameSamples) : null,
        exposureScore: frameSamples > 0 ? round3(clippedSum / frameSamples) : null,
    }
}

/**
 * Opens the user-facing camera, measures it, and stops it again. Never throws:
 * an unavailable/denied camera returns empty metrics.
 */
export async function probeCamera(
    media: MediaEnvironment = browserMediaEnvironment(),
    options: { sampleMs?: number; intervalMs?: number } = {},
): Promise<CameraProbe> {
    let stream: ProbeStream | null = null
    let video: ProbeVideo | null = null
    try {
        if (!media.getUserMedia) {
            return { ...EMPTY_CAMERA, cameraLabel: await firstVideoDeviceLabel(media) }
        }
        stream = await media.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        })
        const tracks = stream.getVideoTracks ? stream.getVideoTracks() : stream.getTracks()
        const track = tracks[0]
        video = media.createVideo()
        video.srcObject = stream
        try {
            await video.play()
        } catch {
            // Some browsers reject the play() promise under autoplay policies while
            // still decoding the stream; dimension polling below decides.
        }

        const waitStart = media.now()
        while (
            (!positiveInt(video.videoWidth) || !positiveInt(video.videoHeight)) &&
            media.now() - waitStart < 1_500
        ) {
            await media.sleep(50)
        }

        const settings = track?.getSettings?.()
        const width = positiveInt(settings?.width) ?? positiveInt(video.videoWidth)
        const height = positiveInt(settings?.height) ?? positiveInt(video.videoHeight)
        const cameraResolution = width && height ? `${width}x${height}` : ''
        const cameraLabel =
            sanitizeText(track?.label, 80) || (await firstVideoDeviceLabel(media))

        const stats = await measureVideo(
            media,
            video,
            options.sampleMs ?? CAMERA_SAMPLE_MS,
            options.intervalMs ?? CAMERA_SAMPLE_INTERVAL_MS,
        )
        return { cameraLabel, cameraResolution, ...stats }
    } catch {
        return { ...EMPTY_CAMERA, cameraLabel: await firstVideoDeviceLabel(media) }
    } finally {
        try {
            for (const track of stream?.getTracks() ?? []) track.stop()
        } catch {
            // ignore
        }
        try {
            video?.pause?.()
        } catch {
            // ignore
        }
        if (video) {
            try {
                video.srcObject = null
            } catch {
                // ignore
            }
        }
    }
}

/**
 * Detects the device and probes the camera, returning the two wire snapshots
 * the trial session carries. Each half degrades independently.
 */
export async function probeTrialEnvironment(
    options: TrialProbeOptions = {},
): Promise<TrialProbeResult> {
    const browser = options.browser ?? browserEnv()
    const camera = await probeCamera(options.media ?? browserMediaEnvironment(), {
        sampleMs: options.sampleMs,
    })

    let device: AuthorTrialDeviceSnapshot
    try {
        const info = await probeDevice(browser)
        const browserText = [info.browser.name, info.browser.version].filter(Boolean).join(' ')
        device = sanitizeDeviceSnapshot({
            label: info.label,
            os: info.platform,
            browser: browserText,
            screen: screenLabel(info.screen.width, info.screen.height, info.screen.dpr),
            cameraLabel: camera.cameraLabel,
            cameraResolution: camera.cameraResolution,
            hardwareConcurrency: info.hardwareConcurrency,
            deviceMemoryGB: info.deviceMemoryGB,
            type: info.type,
        })
    } catch {
        // Even the device probe is best effort: keep the camera data, leave the
        // descriptive fields empty rather than failing the attempt setup.
        const info = browserInfo(browser)
        device = sanitizeDeviceSnapshot({
            os: platformName(browser),
            browser: [info.name, info.version].filter(Boolean).join(' '),
            screen: screenLabel(browser.screen?.width, browser.screen?.height, browser.devicePixelRatio),
            cameraLabel: camera.cameraLabel,
            cameraResolution: camera.cameraResolution,
            hardwareConcurrency: browser.hardwareConcurrency ?? null,
            deviceMemoryGB: browser.deviceMemory ?? null,
            type: guessType(browser),
        })
    }

    const at = options.at ?? new Date()
    const env = sanitizeEnvSnapshot(
        {
            localTimeOfDay: localTimeOfDay(at),
            brightness: camera.brightness,
            exposureScore: camera.exposureScore,
            frameRate: camera.frameRate,
        },
        at,
    )
    return { device, env, camera }
}