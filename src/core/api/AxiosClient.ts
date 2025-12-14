import { injectable, inject } from 'inversify'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { TYPES } from '@core/di/types'
import type {
    IHttpClient,
    HttpResponse,
    RequestConfig,
} from '@domain/interfaces/IHttpClient'
import type { IConfig } from '@domain/interfaces/IConfig'
import type { ILogger } from '@domain/interfaces/ILogger'
import { getCsrfToken } from '@utils/auth'

/**
 * Axios HTTP Client (Secure Implementation)
 *
 * SECURITY UPGRADES:
 * - Uses httpOnly cookies for authentication (credentials: 'include')
 * - Includes CSRF tokens in state-changing requests
 * - No direct token manipulation in JavaScript
 * - Automatic cookie handling by browser
 *
 * OWASP Security Best Practices:
 * - httpOnly cookies prevent XSS token theft
 * - CSRF tokens prevent Cross-Site Request Forgery
 * - Credentials 'include' sends cookies with requests
 * - CORS configuration required on backend
 *
 * Features:
 * - Request/response logging
 * - Automatic timeout handling
 * - Error transformation
 * - Type-safe responses
 * - CSRF protection
 * - Automatic token refresh via cookies
 */
@injectable()
export class AxiosClient implements IHttpClient {
    private readonly client: AxiosInstance

    constructor(
        @inject(TYPES.Config) config: IConfig,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {
        this.client = axios.create({
            baseURL: config.apiBaseUrl,
            timeout: config.apiTimeout,
            // SECURITY: Send cookies with requests (required for httpOnly cookies)
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json',
            },
        })

        this.setupInterceptors()
    }

    /**
     * GET request
     */
    async get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.get<T>(url, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    /**
     * POST request
     */
    async post<T>(
        url: string,
        data?: unknown,
        config?: RequestConfig
    ): Promise<HttpResponse<T>> {
        const response = await this.client.post<T>(url, data, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    /**
     * PUT request
     */
    async put<T>(
        url: string,
        data?: unknown,
        config?: RequestConfig
    ): Promise<HttpResponse<T>> {
        const response = await this.client.put<T>(url, data, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    /**
     * DELETE request
     */
    async delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
        const response = await this.client.delete<T>(url, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    /**
     * PATCH request
     */
    async patch<T>(
        url: string,
        data?: unknown,
        config?: RequestConfig
    ): Promise<HttpResponse<T>> {
        const response = await this.client.patch<T>(url, data, this.toAxiosConfig(config))
        return this.mapResponse(response)
    }

    /**
     * Get underlying Axios instance
     * Useful for advanced configuration (e.g., interceptors)
     */
    getAxiosInstance(): AxiosInstance {
        return this.client
    }

    /**
     * Set up request and response interceptors
     *
     * SECURITY: Implements CSRF protection and httpOnly cookie authentication
     */
    private setupInterceptors(): void {
        // Request interceptor - add CSRF token and log outgoing requests
        this.client.interceptors.request.use(
            async (config) => {
                const method = config.method?.toUpperCase() || 'UNKNOWN'
                const url = config.url || 'unknown'

                // SECURITY: Add CSRF token to state-changing requests
                // CSRF tokens prevent Cross-Site Request Forgery attacks
                if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
                    const csrfToken = getCsrfToken()
                    if (csrfToken) {
                        config.headers['X-CSRF-Token'] = csrfToken
                    } else {
                        this.logger.warn(`CSRF token not found for ${method} ${url}`)
                    }
                }

                // SECURITY NOTE: No Authorization header needed!
                // Tokens are in httpOnly cookies and sent automatically by browser

                this.logger.debug(`HTTP ${method} ${url}`, {
                    params: config.params,
                    hasCsrfToken: !!(config.headers['X-CSRF-Token']),
                    withCredentials: config.withCredentials,
                })
                return config
            },
            (error) => {
                this.logger.error('Request interceptor error', error)
                return Promise.reject(error)
            }
        )

        // Response interceptor - log responses and handle errors
        this.client.interceptors.response.use(
            (response) => {
                const method = response.config.method?.toUpperCase() || 'UNKNOWN'
                const url = response.config.url || 'unknown'
                const status = response.status

                this.logger.debug(`HTTP ${method} ${url} ${status}`, {
                    status,
                    statusText: response.statusText,
                })

                return response
            },
            async (error) => {
                if (axios.isAxiosError(error)) {
                    const method = error.config?.method?.toUpperCase() || 'UNKNOWN'
                    const url = error.config?.url || 'unknown'
                    const status = error.response?.status || 'NETWORK_ERROR'

                    this.logger.error(`HTTP ${method} ${url} ${status}`, {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        message: error.message,
                        data: error.response?.data,
                    })

                    // SECURITY: Handle 401 Unauthorized
                    // With httpOnly cookies, token refresh is handled automatically by backend
                    // When backend refreshes tokens, it sets new cookies automatically
                    if (error.response?.status === 401 && error.config) {
                        const originalRequest = error.config

                        // Prevent infinite loop - don't retry auth endpoints
                        if (!originalRequest.url?.includes('/auth/refresh') &&
                            !originalRequest.url?.includes('/auth/login') &&
                            !originalRequest.url?.includes('/auth/logout')) {

                            try {
                                this.logger.info('Attempting automatic token refresh via httpOnly cookies')

                                // Call refresh endpoint - backend uses refresh_token cookie automatically
                                // No need to send token in request body
                                await this.client.post('/auth/refresh', {})

                                // Backend has set new cookies, retry original request
                                // Cookies are sent automatically by browser
                                return this.client.request(originalRequest)
                            } catch (refreshError) {
                                this.logger.error('Token refresh failed, user needs to login', refreshError)

                                // Redirect to login - handled by error handler
                                // Backend should clear cookies on refresh failure
                                return Promise.reject(error)
                            }
                        }
                    }

                    // SECURITY: Handle 403 Forbidden (CSRF validation failure)
                    if (error.response?.status === 403) {
                        const errorMessage = error.response?.data?.message || ''
                        if (errorMessage.toLowerCase().includes('csrf')) {
                            this.logger.error('CSRF validation failed - possible attack or expired token')
                        }
                    }
                } else {
                    this.logger.error('Non-Axios error in response interceptor', error)
                }

                return Promise.reject(error)
            }
        )
    }

    /**
     * Convert our RequestConfig to Axios config
     */
    private toAxiosConfig(config?: RequestConfig): AxiosRequestConfig {
        if (!config) return {}

        return {
            params: config.params,
            headers: config.headers,
            timeout: config.timeout,
        }
    }

    /**
     * Map Axios response to our HttpResponse interface
     */
    private mapResponse<T>(response: AxiosResponse<T>): HttpResponse<T> {
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as Record<string, string>,
        }
    }
}
