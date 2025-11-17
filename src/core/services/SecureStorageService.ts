import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ISecureStorage } from '@domain/interfaces/IStorage'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * Secure Storage Service
 * Provides secure storage for sensitive data (tokens, credentials)
 *
 * Security Features:
 * 1. Uses sessionStorage instead of localStorage (cleared on tab close)
 * 2. Prefixes keys to avoid conflicts
 * 3. Can be extended with encryption using Web Crypto API
 * 4. Handles errors gracefully
 *
 * PRODUCTION RECOMMENDATION:
 * For maximum security, consider using httpOnly cookies set by the backend
 * This completely removes token access from JavaScript, preventing XSS attacks
 */
@injectable()
export class SecureStorageService implements ISecureStorage {
    private readonly storage: Storage
    private readonly prefix: string

    constructor(
        @inject(TYPES.Config) config: IConfig,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {
        // Use sessionStorage for better security (cleared on tab close)
        // localStorage persists even after browser closes, increasing risk
        this.storage = sessionStorage

        // Prefix keys based on environment to avoid conflicts
        this.prefix = config.environment === 'production'
            ? 'fivucsas_prod'
            : `fivucsas_${config.environment}`
    }

    /**
     * Get item from storage
     * Returns null if item doesn't exist or on error
     */
    async getItem(key: string): Promise<string | null> {
        try {
            const prefixedKey = this.getPrefixedKey(key)
            const value = this.storage.getItem(prefixedKey)

            if (!value) {
                return null
            }

            // In production, decrypt here using Web Crypto API
            // const decrypted = await this.decrypt(value)
            // return decrypted

            return value
        } catch (error) {
            this.logger.error(`Failed to get item from storage: ${key}`, error)
            return null
        }
    }

    /**
     * Set item in storage
     * Throws error if storage quota exceeded
     */
    async setItem(key: string, value: string): Promise<void> {
        try {
            const prefixedKey = this.getPrefixedKey(key)

            // In production, encrypt here using Web Crypto API
            // const encrypted = await this.encrypt(value)
            // this.storage.setItem(prefixedKey, encrypted)

            this.storage.setItem(prefixedKey, value)
            this.logger.debug(`Stored item: ${key}`)
        } catch (error) {
            this.logger.error(`Failed to set item in storage: ${key}`, error)
            // Re-throw to let caller handle quota exceeded errors
            throw new Error(`Failed to store ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Remove item from storage
     */
    async removeItem(key: string): Promise<void> {
        try {
            const prefixedKey = this.getPrefixedKey(key)
            this.storage.removeItem(prefixedKey)
            this.logger.debug(`Removed item: ${key}`)
        } catch (error) {
            this.logger.error(`Failed to remove item from storage: ${key}`, error)
        }
    }

    /**
     * Clear all items with our prefix
     * Only clears items belonging to this application
     */
    async clear(): Promise<void> {
        try {
            const keysToRemove: string[] = []

            // Find all keys with our prefix
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i)
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key)
                }
            }

            // Remove them
            keysToRemove.forEach(key => this.storage.removeItem(key))

            this.logger.info(`Cleared ${keysToRemove.length} items from storage`)
        } catch (error) {
            this.logger.error('Failed to clear storage', error)
        }
    }

    /**
     * Get prefixed key to avoid conflicts
     */
    private getPrefixedKey(key: string): string {
        return `${this.prefix}_${key}`
    }
}

/**
 * Example Web Crypto API encryption implementation (for reference):
 *
 * async encrypt(value: string): Promise<string> {
 *     const encoder = new TextEncoder()
 *     const data = encoder.encode(value)
 *
 *     const key = await this.getEncryptionKey()
 *     const iv = crypto.getRandomValues(new Uint8Array(12))
 *
 *     const encrypted = await crypto.subtle.encrypt(
 *         { name: 'AES-GCM', iv },
 *         key,
 *         data
 *     )
 *
 *     // Combine IV and encrypted data
 *     const combined = new Uint8Array(iv.length + encrypted.byteLength)
 *     combined.set(iv)
 *     combined.set(new Uint8Array(encrypted), iv.length)
 *
 *     return btoa(String.fromCharCode(...combined))
 * }
 */
