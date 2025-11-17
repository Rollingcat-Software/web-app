/**
 * Storage interface
 * Defines contract for data storage (localStorage, sessionStorage, etc.)
 */
export interface IStorage {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
    clear(): Promise<void>
}

/**
 * Secure storage interface
 * Extends IStorage with additional security features
 */
export interface ISecureStorage extends IStorage {
    // Inherits all IStorage methods
    // Can add additional methods for encryption/decryption if needed
}
