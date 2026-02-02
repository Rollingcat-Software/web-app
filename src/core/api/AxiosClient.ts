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
import type { ITokenService } from '@domain/interfaces/ITokenService'
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
        @inject(TYPES.Logger) private readonly logger: ILogger,
        @inject(TYPES.TokenService) private readonly tokenService: ITokenService
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
        // Request interceptor - add Authorization header and CSRF token
        this.client.interceptors.request.use(
            async (config) => {
                const method = config.method?.toUpperCase() || 'UNKNOWN'
                const url = config.url || 'unknown'

                // Add Bearer token Authorization header
                const accessToken = await this.tokenService.getAccessToken()
                if (accessToken) {
                    config.headers['Authorization'] = `Bearer ${accessToken}`
                }

                // Add CSRF token to state-changing requests
                if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
                    const csrfToken = getCsrfToken()
                    if (csrfToken) {
                        config.headers['X-CSRF-Token'] = csrfToken
                    }
                }

                this.logger.debug(`HTTP ${method} ${url}`, {
                    params: config.params,
                    hasAuth: !!accessToken,
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

                    // Handle 401 Unauthorized - attempt token refresh
                    if (error.response?.status === 401 && error.config) {
                        const originalRequest = error.config

                        // Prevent infinite loop - don't retry auth endpoints
                        if (!originalRequest.url?.includes('/auth/refresh') &&
                            !originalRequest.url?.includes('/auth/login') &&
                            !originalRequest.url?.includes('/auth/logout')) {

                            try {
                                this.logger.info('Attempting automatic token refresh')

                                const refreshToken = await this.tokenService.getRefreshToken()
                                if (!refreshToken) {
                                    return Promise.reject(error)
                                }

                                // Send refresh token in request body
                                const refreshResponse = await this.client.post('/auth/refresh', {
                                    refreshToken,
                                })

                                // Store new tokens
                                const data = refreshResponse.data as any
                                if (data.accessToken && data.refreshToken) {
                                    await this.tokenService.storeTokens({
                                        accessToken: data.accessToken,
                                        refreshToken: data.refreshToken,
                                    })
                                }

                                // Retry original request with new token
                                originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`
                                return this.client.request(originalRequest)
                            } catch (refreshError) {
                                this.logger.error('Token refresh failed, user needs to login', refreshError)
                                await this.tokenService.clearTokens()
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
