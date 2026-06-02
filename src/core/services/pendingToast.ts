/**
 * Pending-toast bridge (survives a full-page reload).
 *
 * Some actions (e.g. the ROOT tenant DATA switcher in TopBar) intentionally do a
 * `window.location.reload()` so every already-fetched admin surface re-queries
 * under the new `X-Tenant-ID` scope. A toast enqueued just before that reload is
 * wiped out before the user can read it. This tiny bridge stashes a ONE-SHOT toast
 * in sessionStorage; `replayPendingToast()` (called once on dashboard mount, after
 * the reload) reads, clears, and emits it via the existing notifier.
 *
 * Kept deliberately minimal: a single pending toast, no queue.
 */
import type { INotifier } from '@domain/interfaces/INotifier'

const PENDING_TOAST_KEY = 'pending_toast'

type ToastSeverity = 'success' | 'error' | 'warning' | 'info'

interface PendingToast {
    message: string
    severity: ToastSeverity
}

/**
 * Stash a toast to be shown after the next page load. Safe no-op when
 * sessionStorage is unavailable.
 */
export function setPendingToast(message: string, severity: ToastSeverity = 'success'): void {
    try {
        sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify({ message, severity } satisfies PendingToast))
    } catch {
        // sessionStorage unavailable — the toast is simply not persisted.
    }
}

/**
 * Read + clear any pending toast and emit it through the notifier. Idempotent:
 * clears the slot first so a re-render never double-fires.
 */
export function replayPendingToast(notifier: INotifier): void {
    let raw: string | null = null
    try {
        raw = sessionStorage.getItem(PENDING_TOAST_KEY)
        if (raw !== null) {
            sessionStorage.removeItem(PENDING_TOAST_KEY)
        }
    } catch {
        return
    }
    if (!raw) return
    try {
        const parsed = JSON.parse(raw) as Partial<PendingToast>
        if (!parsed || typeof parsed.message !== 'string' || parsed.message.length === 0) {
            return
        }
        const severity: ToastSeverity = parsed.severity ?? 'success'
        notifier[severity](parsed.message)
    } catch {
        // Malformed payload — ignore.
    }
}
