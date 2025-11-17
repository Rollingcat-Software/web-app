import { injectable } from 'inversify'
import { enqueueSnackbar, VariantType } from 'notistack'
import type { INotifier } from '@domain/interfaces/INotifier'

/**
 * Notifier Service
 * Provides user notifications using notistack
 * Displays toast messages for success, error, warning, and info
 */
@injectable()
export class NotifierService implements INotifier {
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
