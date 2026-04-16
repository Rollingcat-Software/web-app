/**
 * postMessageBridge tests
 *
 * Focus: the parent-origin handshake security contract.
 *   - Before config handshake arrives, sendToParent() MUST NOT broadcast
 *     to '*' — it must DROP the message.
 *   - After handshake, sendToParent() targets the learned origin.
 *   - Inbound messages from a different origin than the learned one are
 *     ignored (callback must not fire).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as bridge from '../postMessageBridge'

describe('postMessageBridge — parent origin handshake', () => {
    let postMessageSpy: ReturnType<typeof vi.fn>
    let warnSpy: ReturnType<typeof vi.spyOn>
    let originalParent: PropertyDescriptor | undefined

    beforeEach(() => {
        bridge._resetParentOriginForTests()

        postMessageSpy = vi.fn()
        originalParent = Object.getOwnPropertyDescriptor(window, 'parent')
        Object.defineProperty(window, 'parent', {
            configurable: true,
            get: () =>
                ({
                    postMessage: postMessageSpy,
                }) as unknown as Window,
        })

        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        if (originalParent) {
            Object.defineProperty(window, 'parent', originalParent)
        }
        warnSpy.mockRestore()
        bridge._resetParentOriginForTests()
    })

    it('drops outbound messages before the config handshake arrives (no postMessage call)', () => {
        bridge.sendReady()
        expect(postMessageSpy).not.toHaveBeenCalled()
    })

    it('does NOT fall back to "*" target when parent origin is unknown', () => {
        bridge.sendError('boom')
        bridge.sendStepChange(1, 'PASSWORD', 3)
        bridge.sendResize(400)
        expect(postMessageSpy).not.toHaveBeenCalled()
        // No invocation with '*' ever
        expect(
            postMessageSpy.mock.calls.some((args) => args[1] === '*')
        ).toBe(false)
    })

    it('sends to the learned origin after setParentOrigin is called', () => {
        bridge.setParentOrigin('https://tenant.example.com')

        bridge.sendReady()

        expect(postMessageSpy).toHaveBeenCalledTimes(1)
        const [msg, targetOrigin] = postMessageSpy.mock.calls[0]
        expect(targetOrigin).toBe('https://tenant.example.com')
        expect((msg as { type: string }).type).toBe('fivucsas:ready')
    })

    it('onParentMessage: ignores inbound messages before handshake is established', () => {
        const callback = vi.fn()
        const unsubscribe = bridge.onParentMessage(callback)

        // Simulate a non-config fivucsas: message arriving first. Since origin
        // is unknown, we must NOT invoke the callback.
        const event = new MessageEvent('message', {
            data: { type: 'fivucsas:step-change', payload: {} },
            origin: 'https://attacker.example',
        })
        window.dispatchEvent(event)

        expect(callback).not.toHaveBeenCalled()
        unsubscribe()
    })

    it('onParentMessage: learns origin from first config event, then accepts further messages from same origin', () => {
        const callback = vi.fn()
        const unsubscribe = bridge.onParentMessage(callback)

        const tenant = 'https://tenant.example.com'

        // 1) Config handshake from the tenant
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'fivucsas:config', payload: { locale: 'en' } },
                origin: tenant,
            })
        )
        expect(callback).toHaveBeenCalledTimes(1)

        // 2) Subsequent message from a different origin — must be ignored
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'fivucsas:config', payload: { locale: 'tr' } },
                origin: 'https://attacker.example',
            })
        )
        expect(callback).toHaveBeenCalledTimes(1)

        // 3) Another message from the legitimate origin is accepted
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'fivucsas:config', payload: { theme: 'dark' } },
                origin: tenant,
            })
        )
        expect(callback).toHaveBeenCalledTimes(2)

        unsubscribe()
    })
})
