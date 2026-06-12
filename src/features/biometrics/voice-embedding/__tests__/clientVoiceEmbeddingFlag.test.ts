import { describe, it, expect, afterEach, vi } from 'vitest'
import { isClientSideVoiceEmbeddingEnabled } from '../clientVoiceEmbeddingFlag'

describe('isClientSideVoiceEmbeddingEnabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("is OFF by default (env unset)", () => {
        vi.stubEnv('VITE_CLIENT_SIDE_VOICE_EMBEDDING', '')
        expect(isClientSideVoiceEmbeddingEnabled()).toBe(false)
    })

    it("is ON only for the exact string 'true'", () => {
        vi.stubEnv('VITE_CLIENT_SIDE_VOICE_EMBEDDING', 'true')
        expect(isClientSideVoiceEmbeddingEnabled()).toBe(true)
    })

    it("is OFF for any non-'true' value", () => {
        vi.stubEnv('VITE_CLIENT_SIDE_VOICE_EMBEDDING', '1')
        expect(isClientSideVoiceEmbeddingEnabled()).toBe(false)
        vi.stubEnv('VITE_CLIENT_SIDE_VOICE_EMBEDDING', 'TRUE')
        expect(isClientSideVoiceEmbeddingEnabled()).toBe(false)
    })
})
