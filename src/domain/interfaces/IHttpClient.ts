/**
 * HTTP Client interface
 * Defines contract for making HTTP requests
 * Abstracts away the underlying HTTP library (Axios, Fetch, etc.)
 */
export interface IHttpClient {
    get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
    post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
    put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
    delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
    patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
}

/**
 * HTTP Response wrapper
 */
export interface HttpResponse<T> {
    data: T
    status: number
    statusText: string
    headers: Record<string, string>
}

/**
 * Request configuration
 */
export interface RequestConfig {
    params?: Record<string, unknown>
    headers?: Record<string, string>
    timeout?: number
}
