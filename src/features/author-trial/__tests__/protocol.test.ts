import { describe, it, expect } from 'vitest'
import {
    ATTEMPT_TIMEOUT_MS,
    MAX_ATTEMPT_TIMEOUT_MS,
    MIN_ATTEMPT_TIMEOUT_MS,
    EMPTY_DEVICE_SNAPSHOT,
    INSTRUMENT_PRESETS,
    classifyStepResponse,
    composeDeviceSummary,
    challengeEmoji,
    lightingBucket,
    loadDeviceProfiles,
    localTimeOfDay,
    mergeDeviceSnapshots,
    normalizeInstrumentPreset,
    normalizePuzzleConfig,
    readIdentityScore,
    resolveAttemptTimeoutMs,
    roundPositionLabel,
    sanitizeDeviceSnapshot,
    sanitizeEnvSnapshot,
    sanitizeInstrument,
    sanitizeText,
    saveDeviceProfile,
    screenLabel,
} from '../protocol'

class MemoryStorage implements Storage {
    private map = new Map<string, string>()
    get length(): number {
        return this.map.size
    }
    clear(): void {
        this.map.clear()
    }
    getItem(key: string): string | null {
        return this.map.get(key) ?? null
    }
    key(index: number): string | null {
        return Array.from(this.map.keys())[index] ?? null
    }
    removeItem(key: string): void {
        this.map.delete(key)
    }
    setItem(key: string, value: string): void {
        this.map.set(key, value)
    }
}

describe('author-trial protocol helpers', () => {
    it('lightingBucket_WhenBoundaries_ShouldMatchTheContract', () => {
        expect(lightingBucket(0.65)).toBe('bright')
        expect(lightingBucket(0.64)).toBe('moderate')
        expect(lightingBucket(0.4)).toBe('moderate')
        expect(lightingBucket(0.39)).toBe('dim')
        expect(lightingBucket(0.2)).toBe('dim')
        expect(lightingBucket(0.19)).toBe('dark')
        expect(lightingBucket(null)).toBe('unknown')
        expect(lightingBucket(Number.NaN)).toBe('unknown')
    })

    it('localTimeOfDay_ShouldUseTheLocalClock', () => {
        expect(localTimeOfDay(new Date(2026, 10, 25, 21, 4))).toBe('21:04')
        expect(localTimeOfDay(new Date(2026, 10, 25, 0, 0))).toBe('00:00')
    })

    it('composeDeviceSummary_ShouldFollowTheDeviceBrowserColumn', () => {
        expect(
            composeDeviceSummary({
                label: 'MacBook',
                os: 'macOS',
                browser: 'Chrome 130',
                cameraLabel: 'FaceTime HD',
            }),
        ).toBe('MacBook / macOS / Chrome 130 / FaceTime HD')
        expect(composeDeviceSummary({ label: '', os: '', browser: '', cameraLabel: '' })).toBe('')
        expect(composeDeviceSummary(null)).toBe('')
    })

    it('screenLabel_ShouldFormatWidthHeightDpr', () => {
        expect(screenLabel(1920, 1080, 2)).toBe('1920x1080@2')
        expect(screenLabel(1440, 900, 1.25)).toBe('1440x900@1.25')
        expect(screenLabel(0, 900, 1)).toBe('')
    })

    it('roundPositionLabel_ShouldBeStableForTheRing', () => {
        expect(roundPositionLabel(2, 3, 4)).toBe('R2 · 3/4')
        expect(roundPositionLabel(2, 3, null)).toBe('R2 · 3')
        expect(roundPositionLabel(null, 3, 4)).toBe('3/4')
        expect(roundPositionLabel(null, null, null)).toBe('')
    })

    it('instrument presets_ShouldMapKnownValuesAndFreeTextToOther', () => {
        expect(INSTRUMENT_PRESETS.map((p) => p.value)).toEqual([
            'live_face_swap',
            'deepfake_replay',
            'virtual_camera',
            'other',
        ])
        expect(INSTRUMENT_PRESETS.every((p) => p.labelKey.startsWith('authorTrial.instrument.'))).toBe(true)
        expect(normalizeInstrumentPreset('deepfake_replay')).toBe('deepfake_replay')
        expect(normalizeInstrumentPreset('DeepFaceLive 2.0')).toBe('other')
        expect(normalizeInstrumentPreset('')).toBeUndefined()
    })

    it('sanitizeText_ShouldStripControlsAndCap', () => {
        expect(sanitizeText('  a\u0000b\tc  ', 10)).toBe('a b c')
        expect(sanitizeText('abcdef', 3)).toBe('abc')
        expect(sanitizeText(null, 10)).toBe('')
        expect(sanitizeText(12345, 10)).toBe('12345')
    })

    it('sanitizeInstrument_ShouldTrimAndCapAt120', () => {
        expect(sanitizeInstrument('   ')).toBeUndefined()
        expect(sanitizeInstrument(' DeepFaceLive ')).toBe('DeepFaceLive')
        expect(sanitizeInstrument('x'.repeat(200))).toHaveLength(120)
    })

    it('sanitizeDeviceSnapshot_ShouldBoundEveryField', () => {
        const d = sanitizeDeviceSnapshot({
            label: 'x'.repeat(200),
            os: 'y'.repeat(200),
            browser: 'z'.repeat(200),
            screen: 's'.repeat(200),
            cameraLabel: 'c'.repeat(200),
            cameraResolution: 'r'.repeat(200),
            hardwareConcurrency: 12.9,
            deviceMemoryGB: 8,
            type: 'phone_tablet',
        })
        expect(d.label).toHaveLength(80)
        expect(d.os).toHaveLength(60)
        expect(d.browser).toHaveLength(60)
        expect(d.screen).toHaveLength(24)
        expect(d.cameraLabel).toHaveLength(80)
        expect(d.cameraResolution).toHaveLength(16)
        expect(d.hardwareConcurrency).toBe(12)
        expect(d.deviceMemoryGB).toBe(8)
        expect(d.type).toBe('phone_tablet')
        expect(sanitizeDeviceSnapshot(null)).toEqual(EMPTY_DEVICE_SNAPSHOT)
    })

    it('sanitizeEnvSnapshot_ShouldClampAndFallBackToTheLocalClock', () => {
        const now = new Date(2026, 10, 25, 9, 7)
        expect(
            sanitizeEnvSnapshot(
                { localTimeOfDay: '25:99', brightness: 2, exposureScore: -1, frameRate: 999 },
                now,
            ),
        ).toEqual({ localTimeOfDay: '09:07', brightness: 1, exposureScore: 0, frameRate: 240 })
        expect(sanitizeEnvSnapshot({ localTimeOfDay: '21:14', brightness: 0.4267 }, now)).toEqual({
            localTimeOfDay: '21:14',
            brightness: 0.427,
            exposureScore: null,
            frameRate: null,
        })
    })

    it('mergeDeviceSnapshots_ShouldPreferOperatorFields', () => {
        const merged = mergeDeviceSnapshots(
            { label: 'Detected', os: 'Windows', browser: 'Chrome', screen: '1920x1080@1', cameraLabel: 'Cam A', type: 'computer' },
            { label: 'My rig', os: '', browser: '', screen: '', cameraLabel: '', cameraResolution: '1280x720' },
        )
        expect(merged.label).toBe('My rig')
        expect(merged.os).toBe('Windows')
        expect(merged.cameraLabel).toBe('Cam A')
        expect(merged.cameraResolution).toBe('1280x720')
    })

    it('classifyStepResponse_ShouldNeverTreatStepCompletedAsAccept', () => {
        expect(classifyStepResponse({ status: 'AUTHENTICATED' })).toEqual({ outcome: 'accepted' })
        expect(classifyStepResponse({ status: 'STEP_COMPLETED' })).toEqual({
            outcome: 'rejected',
            reason: 'step_completed',
        })
        expect(classifyStepResponse({ status: 'FAILED' })).toEqual({ outcome: 'rejected', reason: 'step_failed' })
        expect(classifyStepResponse({ status: 'ERROR' })).toEqual({ outcome: 'rejected', reason: 'step_error' })
        expect(classifyStepResponse({ status: 'FACE_IMAGE_REQUIRED' })).toEqual({
            outcome: 'rejected',
            reason: 'face_image_required',
        })
        expect(classifyStepResponse({ status: 'CHALLENGE' })).toEqual({
            outcome: 'rejected',
            reason: 'challenge_unexpected',
        })
        expect(classifyStepResponse(null)).toEqual({ outcome: 'error', reason: 'empty_response' })
    })

    it('readIdentityScore_ShouldReadDirectAndNestedValues', () => {
        expect(readIdentityScore({ status: 'AUTHENTICATED', identity_score: 0.87 })).toBe(0.87)
        expect(readIdentityScore({ status: 'AUTHENTICATED', data: { identity_score: '0.75' } })).toBe(0.75)
        expect(readIdentityScore({ status: 'FAILED' })).toBeNull()
        expect(readIdentityScore(null)).toBeNull()
    })

    it('resolveAttemptTimeoutMs_ShouldHonourOptionQueryAndBounds', () => {
        expect(resolveAttemptTimeoutMs(undefined, null)).toBe(ATTEMPT_TIMEOUT_MS)
        expect(resolveAttemptTimeoutMs(3000, null)).toBe(3000)
        expect(resolveAttemptTimeoutMs(undefined, '?attemptTimeoutMs=5000')).toBe(5000)
        expect(resolveAttemptTimeoutMs(5000, '?attemptTimeoutMs=3000')).toBe(5000)
        expect(resolveAttemptTimeoutMs(1, null)).toBe(MIN_ATTEMPT_TIMEOUT_MS)
        expect(resolveAttemptTimeoutMs(999_999_999, null)).toBe(MAX_ATTEMPT_TIMEOUT_MS)
        expect(resolveAttemptTimeoutMs(undefined, '?attemptTimeoutMs=nope')).toBe(ATTEMPT_TIMEOUT_MS)
    })

    it('normalizePuzzleConfig_ShouldBeTolerantButNeverLoosenBinding', () => {
        expect(
            normalizePuzzleConfig({
                allowedChallengeTypes: ['blink'],
                count: 1,
                difficulty: 'easy',
                alsoMatchFaceIdentity: true,
            }),
        ).toEqual({
            allowedChallengeTypes: ['blink'],
            count: 1,
            difficulty: 'easy',
            alsoMatchFaceIdentity: true,
        })
        expect(normalizePuzzleConfig(null, { count: 2, alsoMatchFaceIdentity: true })).toEqual({
            allowedChallengeTypes: [],
            count: 2,
            difficulty: 'easy',
            alsoMatchFaceIdentity: true,
        })
    })

    it('challengeEmoji_ShouldFallBackToPuzzle', () => {
        expect(challengeEmoji('blink')).toBe('👁️')
        expect(challengeEmoji('finger_count')).toBe('✋')
        expect(challengeEmoji('unknown_action')).toBe('🧩')
        expect(challengeEmoji(null)).toBe('🧩')
    })

    it('device profiles_ShouldRoundTripAndCapThroughLocalStorage', () => {
        const storage = new MemoryStorage()
        expect(loadDeviceProfiles(storage)).toEqual([])
        const first = saveDeviceProfile(
            {
                name: 'Desk',
                device: {
                    label: 'Desk PC',
                    os: 'Windows',
                    browser: 'Chrome 130',
                    screen: '1920x1080@1',
                    cameraLabel: 'Cam',
                    cameraResolution: '1280x720',
                },
            },
            storage,
        )
        expect(first).toHaveLength(1)
        expect(loadDeviceProfiles(storage)[0]).toMatchObject({
            name: 'Desk',
            device: { label: 'Desk PC', cameraResolution: '1280x720' },
        })
        saveDeviceProfile(
            {
                name: 'Desk',
                device: {
                    label: 'Desk PC v2',
                    os: 'Windows',
                    browser: 'Chrome 131',
                    screen: '1920x1080@1',
                    cameraLabel: 'Cam',
                    cameraResolution: '1280x720',
                },
            },
            storage,
        )
        const after = loadDeviceProfiles(storage)
        expect(after).toHaveLength(1)
        expect(after[0].device.label).toBe('Desk PC v2')
        expect(loadDeviceProfiles({ getItem: () => '{bad json', setItem: () => undefined, removeItem: () => undefined } as unknown as Storage)).toEqual([])
    })
})