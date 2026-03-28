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
 * Send a message to the parent window (if we are embedded).
 * In standalone mode (window.parent === window), this is a no-op.
 */
export function sendToParent(msg: VerifyMessage): void {
    if (window.parent !== window) {
        // In production, restrict targetOrigin to the allowed origin
        // configured by the parent. For now, '*' is used during development.
        window.parent.postMessage(msg, '*')
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
    userId: string
    sessionId: string
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
            callback(data as InboundMessage)
        }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
}
