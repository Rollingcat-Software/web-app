import { DashboardStats } from '../types'
import api from './api'

// Mock mode - controlled by environment variable
const MOCK_MODE = import.meta.env.VITE_ENABLE_MOCK_API === 'true'

// Mock dashboard statistics
const MOCK_STATS: DashboardStats = {
  totalUsers: 1247,
  activeUsers: 1089,
  pendingEnrollments: 23,
  successfulEnrollments: 1156,
  failedEnrollments: 68,
  authSuccessRate: 98.5,
  verificationSuccessRate: 94.4,
}

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    if (MOCK_MODE) {
      await this.delay(300)
      return MOCK_STATS
    }

    // Real API call - check StatisticsController
    const response = await api.get<DashboardStats>('/statistics')
    return response.data
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default new DashboardService()
