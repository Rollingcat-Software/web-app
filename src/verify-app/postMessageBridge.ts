/**
 * postMessage Bridge for FIVUCSAS Verify App
 *
 * Enables communication between the embedded verify iframe/WebView
 * and the parent window. All message types are prefixed with 'fivucsas:'
 * to avoid conflicts with other postMessage consumers.
 *
 * @see docs/EMBEDDABLE_AUTH_WIDGET_ARCHITECTURE.md
 */

// ─── Message Types ───────────────────────────────────────────────

export interface VerifyMessage {
    type:
        | 'fivucsas:ready'
        | 'fivucsas:step-change'
        | 'fivucsas:complete'
        | 'fivucsas:error'
        | 'fivucsas:resize'
        | 'fivucsas:cancel'
    payload: Record<string, unknown>
}

export interface ParentConfigMessage {
    type: 'fivucsas:config'
    payload: {
        theme?: 'light' | 'dark'
        locale?: 'en' | 'tr'
        apiBaseUrl?: string
        allowedOrigin?: string
    }
}

export type InboundMessage = ParentConfigMessage

// ─── Send to Parent ──────────────────────────────────────────────

/**
 * Stores the allowed origin received from the parent's config message.
 *
 * SECURITY: Stays `null` until the first `fivucsas:config` message arrives
 * from a known parent origin. While null, outbound messages are DROPPED
 * rather than broadcast to `'*'` — a wildcard target would leak early
 * ready/step-change/resize payloads (potentially containing tenant-scoped
 * metadata) to any window that happens to embed us before the parent
 * completes its handshake.
 */
let parentOrigin: string | null = null

export function setParentOrigin(origin: string): void {
    parentOrigin = origin
}

/** Test-only: reset the handshake state between unit tests. */
export function _resetParentOriginForTests(): void {
    parentOrigin = null
}

/**
 * Send a message to the parent window (if we are embedded).
 * In standalone mode (window.parent === window), this is a no-op.
 *
 * If the parent origin has not yet been established (no config handshake
 * received), the message is DROPPED to avoid broadcasting to `'*'`. A
 * dev-mode warning is logged so the handshake gap is visible during
 * integration work.
 */
export function sendToParent(msg: VerifyMessage): void {
    if (window.parent === window) {
        return
    }
    if (parentOrigin === null) {
        if (import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.warn(
                '[fivucsas] Dropping postMessage — parent origin not yet established via fivucsas:config handshake',
                msg.type
            )
        }
        return
    }
    window.parent.postMessage(msg, parentOrigin)
}

// ─── Convenience Senders ─────────────────────────────────────────

export function sendReady(): void {
    sendToParent({
        type: 'fivucsas:ready',
        payload: { version: '1.0.0', timestamp: Date.now() },
    })
}

export function sendStepChange(
    stepIndex: number,
    methodType: string,
    totalSteps: number
): void {
    sendToParent({
        type: 'fivucsas:step-change',
        payload: { stepIndex, methodType, totalSteps },
    })
}

export function sendComplete(result: {
    accessToken: string
    refreshToken?: string
    userId: string
    sessionId?: string
    email?: string
    completedMethods?: string[]
    timestamp?: number
}): void {
    sendToParent({
        type: 'fivucsas:complete',
        payload: {
            ...result,
            completedMethods: result.completedMethods ?? [],
            timestamp: result.timestamp ?? Date.now(),
        },
    })
}

export function sendError(error: string, code?: string): void {
    sendToParent({
        type: 'fivucsas:error',
        payload: { error, code, timestamp: Date.now() },
    })
}

export function sendCancel(sessionId: string): void {
    sendToParent({
        type: 'fivucsas:cancel',
        payload: { sessionId, timestamp: Date.now() },
    })
}

export function sendResize(height: number): void {
    sendToParent({
        type: 'fivucsas:resize',
        payload: { height },
    })
}

// ─── Listen for Parent Messages ──────────────────────────────────

type MessageCallback = (msg: InboundMessage) => void

/**
 * Register a listener for configuration messages from the parent window.
 * Validates that inbound messages come from the expected parent origin.
 * Returns a cleanup function to remove the listener.
 */
export function onParentMessage(callback: MessageCallback): () => void {
    const handler = (event: MessageEvent) => {
        const data = event.data
        if (
            data &&
            typeof data === 'object' &&
            typeof data.type === 'string' &&
            data.type.startsWith('fivucsas:')
        ) {
            // Accept the first config message to learn the parent origin,
            // then restrict subsequent messages to that origin only
            if (data.type === 'fivucsas:config' && event.origin && event.origin !== 'null') {
                if (parentOrigin === null) {
                    setParentOrigin(event.origin)
                }
            }
            // Validate origin: once parentOrigin is set, reject messages from other origins.
            // If still null (no handshake yet), drop the inbound message — we won't leak
            // callback state to an unverified origin.
            if (parentOrigin === null || event.origin !== parentOrigin) {
                return
            }
            callback(data as InboundMessage)
        }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
}
