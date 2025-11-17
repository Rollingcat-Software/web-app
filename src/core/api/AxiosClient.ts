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

/**
 * Axios HTTP Client
 * Provides HTTP communication with the backend API
 * Wraps Axios to provide our IHttpClient interface
 *
 * Features:
 * - Request/response logging
 * - Automatic timeout handling
 * - Error transformation
 * - Type-safe responses
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
     */
    private setupInterceptors(): void {
        // Request interceptor - log outgoing requests
        this.client.interceptors.request.use(
            (config) => {
                const method = config.method?.toUpperCase() || 'UNKNOWN'
                const url = config.url || 'unknown'
                this.logger.debug(`HTTP ${method} ${url}`, {
                    params: config.params,
                    headers: config.headers,
                })
                return config
            },
            (error) => {
                this.logger.error('Request interceptor error', error)
                return Promise.reject(error)
            }
        )

        // Response interceptor - log responses and errors
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
            (error) => {
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
