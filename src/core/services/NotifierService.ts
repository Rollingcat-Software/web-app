import { injectable } from 'inversify'
import { enqueueSnackbar, VariantType } from 'notistack'
import type { INotifier } from '@domain/interfaces/INotifier'

/**
 * Low-severity variants get deduped within this window so rapid-fire
 * events ("Profile updated", "Notification settings updated",
 * "Appearance settings updated" fired within a single save flow) don't
 * stack four toasts on top of each other.
 *
 * Errors and warnings are never suppressed — user safety signal first.
 */
const LOW_SEVERITY_DEDUPE_WINDOW_MS = 2_500

/**
 * Notifier Service
 * Provides user notifications using notistack
 * Displays toast messages for success, error, warning, and info
 */
@injectable()
export class NotifierService implements INotifier {
    /**
     * Recent low-severity toasts keyed by `${variant}:${message}`
     * → timestamp of last emission. Used to dedupe back-to-back identical
     * toasts fired by chatty services (Settings save fans out to 3-4
     * success toasts; OAuth client CRUD fires info + success for the same
     * action; etc.).
     */
    private readonly recentLowSeverity = new Map<string, number>()

    /**
     * Show success notification
     */
    success(message: string): void {
        this.notify(message, 'success')
    }

    /**
     * Show error notification
     */
    error(message: string): void {
        this.notify(message, 'error')
    }

    /**
     * Show warning notification
     */
    warning(message: string): void {
        this.notify(message, 'warning')
    }

    /**
     * Show info notification
     */
    info(message: string): void {
        this.notify(message, 'info')
    }

    /**
     * Internal method to display notification
     */
    private notify(message: string, variant: VariantType): void {
        // In test and SSR-like contexts notistack may not expose enqueueSnackbar.
        // Skip toast dispatch there to avoid crashing non-UI flows.
        if (typeof enqueueSnackbar !== 'function') {
            return
        }

        if (this.shouldSuppressAsDuplicate(message, variant)) {
            // Still leave a breadcrumb in the console so we can debug
            // "why didn't my toast show up?" without re-instrumenting.
            if (typeof console !== 'undefined' && typeof console.debug === 'function') {
                console.debug('[NotifierService] Deduped low-severity toast:', { variant, message })
            }
            return
        }

        enqueueSnackbar(message, {
            variant,
            autoHideDuration: this.getAutoHideDuration(variant),
            anchorOrigin: {
                vertical: 'top',
                horizontal: 'right',
            },
        })
    }

    /**
     * Suppress back-to-back identical low-severity toasts within the
     * dedupe window. Errors + warnings are ALWAYS shown — those are
     * the user's safety signal and must never be throttled.
     */
    private shouldSuppressAsDuplicate(message: string, variant: VariantType): boolean {
        if (variant === 'error' || variant === 'warning') {
            return false
        }
        const key = `${variant}:${message}`
        const now = Date.now()
        const last = this.recentLowSeverity.get(key)
        if (last !== undefined && now - last < LOW_SEVERITY_DEDUPE_WINDOW_MS) {
            return true
        }
        this.recentLowSeverity.set(key, now)
        // Prune opportunistically so the map can't grow unbounded over a
        // long-lived SPA session.
        if (this.recentLowSeverity.size > 64) {
            const cutoff = now - LOW_SEVERITY_DEDUPE_WINDOW_MS
            for (const [k, ts] of this.recentLowSeverity) {
                if (ts < cutoff) this.recentLowSeverity.delete(k)
            }
        }
        return false
    }

    /**
     * Get auto-hide duration based on variant
     * Errors stay longer to ensure user sees them
     */
    private getAutoHideDuration(variant: VariantType): number {
        switch (variant) {
            case 'error':
                return 6000 // 6 seconds for errors
            case 'warning':
                return 5000 // 5 seconds for warnings
            case 'success':
                return 3000 // 3 seconds for success
            case 'info':
            default:
                return 4000 // 4 seconds for info
        }
    }
}
