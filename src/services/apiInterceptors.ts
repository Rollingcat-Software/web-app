import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import api from './api'
import type { AppDispatch, RootState } from '../store'
import { clearCredentials, refreshToken as refreshTokenAction } from '../store/slices/authSlice'

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: any) => void
}> = []

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

export const setupInterceptors = (store: { getState: () => RootState; dispatch: AppDispatch }) => {
  // Request interceptor - add auth token
  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const state = store.getState()
      const token = state.auth.accessToken

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }

      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor - handle token refresh
  api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

      // If error is 401 and we haven't retried yet
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              return api(originalRequest)
            })
            .catch((err) => {
              return Promise.reject(err)
            })
        }

        originalRequest._retry = true
        isRefreshing = true

        const state = store.getState()
        const refreshToken = state.auth.refreshToken

        if (!refreshToken) {
          store.dispatch(clearCredentials())
          return Promise.reject(error)
        }

        try {
          // Attempt to refresh token
          const result = await store.dispatch(refreshTokenAction(refreshToken))

          if (refreshTokenAction.fulfilled.match(result)) {
            const newToken = result.payload.accessToken
            processQueue(null, newToken)

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }

            return api(originalRequest)
          } else {
            throw new Error('Token refresh failed')
          }
        } catch (err) {
          processQueue(err as Error, null)
          store.dispatch(clearCredentials())
          return Promise.reject(err)
        } finally {
          isRefreshing = false
        }
      }

      return Promise.reject(error)
    }
  )
}
