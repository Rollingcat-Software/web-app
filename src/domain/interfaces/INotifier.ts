/**
 * Notifier interface
 * Defines contract for user notification service (toasts, snackbars, etc.)
 */
export interface INotifier {
    success(message: string): void
    error(message: string): void
    warning(message: string): void
    info(message: string): void
}
