import { LoginRequest, LoginResponse, User, UserRole, UserStatus } from '../types'
import api from './api'

// Mock mode - controlled by environment variable
const MOCK_MODE = import.meta.env.VITE_ENABLE_MOCK_API === 'true'

// Mock user data
const MOCK_USER: User = {
  id: 1,
  email: 'admin@fivucsas.com',
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  tenantId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  lastLoginIp: '127.0.0.1',
}

const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const MOCK_REFRESH_TOKEN = 'mock-refresh-token-' + Date.now()

class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    if (MOCK_MODE) {
      // Mock login - accept any email/password
      await this.delay(500) // Simulate network delay

      if (credentials.email && credentials.password.length >= 6) {
        return {
          accessToken: MOCK_ACCESS_TOKEN,
          refreshToken: MOCK_REFRESH_TOKEN,
          user: {
            ...MOCK_USER,
            email: credentials.email,
          },
        }
      } else {
        throw new Error('Invalid credentials')
      }
    }

    // Real API call
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    return response.data
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    if (MOCK_MODE) {
      await this.delay(300)

      return {
        accessToken: MOCK_ACCESS_TOKEN + '-refreshed',
        refreshToken: MOCK_REFRESH_TOKEN,
        user: MOCK_USER,
      }
    }

    // Real API call - TODO: Backend needs to implement /auth/refresh endpoint
    // For now, fallback to re-login flow
    console.warn('Refresh token endpoint not implemented on backend yet')
    throw new Error('Token refresh not available - please login again')
  }

  async logout(): Promise<void> {
    if (MOCK_MODE) {
      await this.delay(200)
      return
    }

    // Real API call - TODO: Backend needs to implement /auth/logout endpoint
    // For now, just clear client-side tokens
    // await api.post('/auth/logout')
    console.log('Logout - clearing local tokens')
  }

  // Utility function to simulate network delay
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default new AuthService()
