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
 * When set, postMessage will be restricted to this origin instead of '*'.
 */
let parentOrigin: string = '*'

export function setParentOrigin(origin: string): void {
    parentOrigin = origin
}

/**
 * Send a message to the parent window (if we are embedded).
 * In standalone mode (window.parent === window), this is a no-op.
 */
export function sendToParent(msg: VerifyMessage): void {
    if (window.parent !== window) {
        window.parent.postMessage(msg, parentOrigin)
    }
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
}): void {
    sendToParent({
        type: 'fivucsas:complete',
        payload: result,
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
                if (parentOrigin === '*') {
                    setParentOrigin(event.origin)
                }
            }
            // Validate origin: once parentOrigin is set, reject messages from other origins
            if (parentOrigin !== '*' && event.origin !== parentOrigin) {
                return
            }
            callback(data as InboundMessage)
        }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
}
