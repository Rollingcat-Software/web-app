import { describe, it, expect } from 'vitest'
import { probeDevice, readBattery, shortGpu, type BrowserEnv } from '../deviceProbe'

const ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

function env(over: Partial<BrowserEnv>): BrowserEnv {
    return {
        userAgent: ANDROID_UA,
        screen: { width: 720, height: 1600 },
        devicePixelRatio: 2,
        timezone: 'Europe/Istanbul',
        crossOriginIsolated: false,
        webgl: () => ({ renderer: 'Mali-G57 MC2', vendor: 'ARM' }),
        ...over,
    }
}

describe('deviceProbe', () => {
    it('probeDevice_WhenUaChModelPresent_ShouldUseIt', async () => {
        const d = await probeDevice(
            env({
                userAgentData: {
                    mobile: true,
                    platform: 'Android',
                    brands: [{ brand: 'Not?A_Brand', version: '99' }, { brand: 'Chromium', version: '130' }, { brand: 'Google Chrome', version: '130' }],
                    getHighEntropyValues: async () => ({ model: 'SM-A145F', platformVersion: '14.0.0', architecture: '' }),
                },
                hardwareConcurrency: 8,
                deviceMemory: 4,
            })
        )
        expect(d).toMatchObject({
            type: 'phone_tablet',
            model: 'SM-A145F',
            label: 'SM-A145F',
            browser: { name: 'Google Chrome', version: '130' },
            hardwareConcurrency: 8,
            deviceMemoryGB: 4,
            uaMobile: true,
            timezone: 'Europe/Istanbul',
        })
        expect(d.uaHighEntropy.platformVersion).toBe('14.0.0')
    })

    it('probeDevice_WhenIphoneSafari_ShouldFallBackToUa', async () => {
        const d = await probeDevice(env({ userAgent: IPHONE_UA, webgl: () => ({ renderer: 'Apple GPU', vendor: 'Apple Inc.' }) }))
        expect(d).toMatchObject({ type: 'phone_tablet', model: 'iPhone', platform: 'iOS', browser: { name: 'Safari', version: '17.5' } })
        expect(d.uaHighEntropy.model).toBeNull()
        expect(d.deviceMemoryGB).toBeNull()
    })

    it('probeDevice_WhenIpadReportsDesktop_ShouldDetectTablet', async () => {
        const d = await probeDevice(env({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 }))
        expect(d.type).toBe('phone_tablet')
        expect(d.model).toBe('iPad')
    })

    it('probeDevice_WhenComputerWithoutModel_ShouldLabelWithPlatformAndGpu', async () => {
        const d = await probeDevice(
            env({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                webgl: () => ({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x000025A2) Direct3D11 vs_5_0 ps_5_0, D3D11)', vendor: 'Google' }),
            })
        )
        expect(d.type).toBe('computer')
        expect(d.label).toBe('Windows (NVIDIA, NVIDIA GeForce RTX 3050)')
    })

    it('probeDevice_WhenProbesThrow_ShouldNotThrow', async () => {
        const d = await probeDevice(
            env({
                webgl: () => {
                    throw new Error('no gl')
                },
                userAgentData: { getHighEntropyValues: async () => Promise.reject(new Error('denied')) },
            })
        )
        expect(d.webgl).toEqual({ renderer: null, vendor: null })
        expect(d.uaHighEntropy.model).toBeNull()
    })

    it('readBattery_WhenApiMissingOrPresent', async () => {
        expect(await readBattery(env({}))).toBeNull()
        expect(await readBattery(env({ getBattery: async () => ({ level: 0.4567, charging: true }) }))).toEqual({ level: 0.46, charging: true })
    })

    it('shortGpu_ShouldTrimAngleNoise', () => {
        expect(shortGpu(null)).toBeNull()
        expect(shortGpu('Mali-G57 MC2')).toBe('Mali-G57 MC2')
    })
})
