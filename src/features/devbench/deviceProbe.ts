/**
 * Reads what the browser says about the device, with no prompt and no location.
 *
 * The browser objects are injected (a {@link BrowserEnv}) so the logic is testable and
 * the page never reaches for globals directly. Every probe is best effort: an API that
 * is missing or throws yields null, never an error.
 */
import { r2 } from './protocol'

export type DeviceType = 'phone_tablet' | 'computer'

interface UaBrand { brand: string; version: string }
interface UaData {
    brands?: UaBrand[]
    mobile?: boolean
    platform?: string
    getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
}
export interface BatteryLike { level: number; charging: boolean }

/** The browser surface the probe reads. Matches `window.navigator` + a few window fields. */
export interface BrowserEnv {
    userAgent: string
    userAgentData?: UaData
    maxTouchPoints?: number
    hardwareConcurrency?: number
    deviceMemory?: number
    language?: string
    connection?: { effectiveType?: string }
    getBattery?: () => Promise<BatteryLike>
    screen: { width: number; height: number }
    devicePixelRatio?: number
    timezone: string | null
    crossOriginIsolated: boolean
    webgl: () => { renderer: string | null; vendor: string | null }
}

export interface HighEntropy {
    model: string | null
    platform: string | null
    platformVersion: string | null
    architecture: string | null
    bitness: string | null
    fullVersionList: UaBrand[] | null
}

export interface DeviceInfo {
    type: DeviceType
    model: string | null
    platform: string
    browser: { name: string | null; version: string | null }
    webgl: { renderer: string | null; vendor: string | null }
    uaHighEntropy: HighEntropy
    hardwareConcurrency: number | null
    deviceMemoryGB: number | null
    screen: { width: number; height: number; dpr: number }
    connectionEffectiveType: string | null
    timezone: string | null
    language: string | null
    crossOriginIsolated: boolean
    userAgent: string
    uaPlatform: string | null
    uaMobile: boolean | null
    /** Short human label used as the device name (model, or platform + GPU). */
    label: string
}

const HIGH_ENTROPY_HINTS = ['model', 'platform', 'platformVersion', 'architecture', 'bitness', 'fullVersionList']

export function browserInfo(env: BrowserEnv): { name: string | null; version: string | null } {
    const brands = env.userAgentData?.brands
    if (brands) {
        const real = brands.filter((b) => !/not.?a.?brand/i.test(b.brand))
        const pick = real.find((b) => !/chromium/i.test(b.brand)) ?? real[0]
        if (pick) return { name: pick.brand, version: pick.version }
    }
    const m = env.userAgent.match(/(Edg|OPR|Firefox|SamsungBrowser|CriOS|FxiOS|Chrome|Version)\/([\d.]+)/)
    if (m) {
        const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari', CriOS: 'Chrome', FxiOS: 'Firefox' }
        return { name: names[m[1]] ?? m[1], version: m[2] }
    }
    return { name: null, version: null }
}

/** Two values only, as in the artifact: phone_tablet | computer. iPadOS reports as a Mac with touch. */
export function guessType(env: BrowserEnv): DeviceType {
    if (env.userAgentData?.mobile) return 'phone_tablet'
    if (/iPhone|iPad|Android|Mobile|Tablet/i.test(env.userAgent)) return 'phone_tablet'
    if (/Macintosh/i.test(env.userAgent) && (env.maxTouchPoints ?? 0) > 1) return 'phone_tablet'
    return 'computer'
}

/** Model from the classic UA string (Android builds and Apple families). */
export function uaModel(env: BrowserEnv): string | null {
    const ua = env.userAgent
    const m = ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\sBuild|[;)])/)
    if (m && !/^(K|Mobile|wv)$/i.test(m[1].trim())) return m[1].trim()
    if (/iPhone/.test(ua)) return 'iPhone'
    if (/iPad/.test(ua)) return 'iPad'
    if (/Macintosh/.test(ua)) return (env.maxTouchPoints ?? 0) > 1 ? 'iPad' : 'Mac'
    return null
}

export function platformName(env: BrowserEnv): string {
    if (env.userAgentData?.platform) return env.userAgentData.platform
    const ua = env.userAgent
    if (/Windows/.test(ua)) return 'Windows'
    if (/Android/.test(ua)) return 'Android'
    if (/iPhone|iPad/.test(ua)) return 'iOS'
    if (/Mac/.test(ua)) return 'macOS'
    if (/Linux|X11/.test(ua)) return 'Linux'
    return 'unknown'
}

export function shortGpu(renderer: string | null): string | null {
    if (!renderer) return null
    return renderer
        .replace(/^ANGLE \(|\)$/g, '')
        .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
        .replace(/Direct3D.*$/i, '')
        .replace(/,\s*$/, '')
        .slice(0, 60)
        .trim()
}

async function highEntropy(env: BrowserEnv): Promise<HighEntropy> {
    const empty: HighEntropy = { model: null, platform: null, platformVersion: null, architecture: null, bitness: null, fullVersionList: null }
    const fn = env.userAgentData?.getHighEntropyValues
    if (!fn) return empty
    try {
        const v = await fn.call(env.userAgentData, HIGH_ENTROPY_HINTS)
        const str = (x: unknown) => (typeof x === 'string' ? x : null)
        return {
            model: str(v.model),
            platform: str(v.platform),
            platformVersion: str(v.platformVersion),
            architecture: str(v.architecture),
            bitness: str(v.bitness),
            fullVersionList: Array.isArray(v.fullVersionList) ? (v.fullVersionList as UaBrand[]) : null,
        }
    } catch {
        return empty
    }
}

export async function probeDevice(env: BrowserEnv): Promise<DeviceInfo> {
    const type = guessType(env)
    const hi = await highEntropy(env)
    const webgl = (() => {
        try {
            return env.webgl()
        } catch {
            return { renderer: null, vendor: null }
        }
    })()
    const hiModel = hi.model?.trim()
    const model = (hiModel && hiModel.length > 1 ? hiModel : null) ?? uaModel(env)
    const platform = platformName(env)
    const gpu = shortGpu(webgl.renderer)
    const label = model ?? (gpu ? `${platform} (${gpu})` : platform)
    return {
        type,
        model,
        platform,
        browser: browserInfo(env),
        webgl,
        uaHighEntropy: hi,
        hardwareConcurrency: env.hardwareConcurrency ?? null,
        deviceMemoryGB: env.deviceMemory ?? null,
        screen: { width: env.screen.width, height: env.screen.height, dpr: env.devicePixelRatio || 1 },
        connectionEffectiveType: env.connection?.effectiveType ?? null,
        timezone: env.timezone,
        language: env.language ?? null,
        crossOriginIsolated: env.crossOriginIsolated,
        userAgent: env.userAgent,
        uaPlatform: env.userAgentData?.platform ?? null,
        uaMobile: env.userAgentData?.mobile ?? null,
        label,
    }
}

/** Battery level (0..1, two decimals) and charging state, or null when the API is absent. */
export async function readBattery(env: BrowserEnv): Promise<BatteryLike | null> {
    try {
        if (!env.getBattery) return null
        const b = await env.getBattery()
        return { level: r2(b.level) ?? 0, charging: b.charging }
    } catch {
        return null
    }
}

/** The real browser, read once. */
export function browserEnv(): BrowserEnv {
    const nav = navigator as Navigator & {
        userAgentData?: UaData
        deviceMemory?: number
        connection?: { effectiveType?: string }
        getBattery?: () => Promise<BatteryLike>
    }
    return {
        userAgent: nav.userAgent,
        userAgentData: nav.userAgentData,
        maxTouchPoints: nav.maxTouchPoints,
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
        language: nav.language,
        connection: nav.connection,
        getBattery: nav.getBattery ? () => nav.getBattery!() : undefined,
        screen: { width: window.screen.width, height: window.screen.height },
        devicePixelRatio: window.devicePixelRatio,
        timezone: (() => {
            try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone
            } catch {
                return null
            }
        })(),
        crossOriginIsolated: self.crossOriginIsolated === true,
        webgl: () => {
            const c = document.createElement('canvas')
            const gl = (c.getContext('webgl') ?? c.getContext('experimental-webgl')) as WebGLRenderingContext | null
            if (!gl) return { renderer: null, vendor: null }
            const e = gl.getExtension('WEBGL_debug_renderer_info')
            return e
                ? { renderer: String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)), vendor: String(gl.getParameter(e.UNMASKED_VENDOR_WEBGL)) }
                : { renderer: null, vendor: null }
        },
    }
}
