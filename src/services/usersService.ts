import { User, PaginatedResponse, UserRole, UserStatus } from '../types'
import api from './api'

// Mock mode - controlled by environment variable
const MOCK_MODE = import.meta.env.VITE_ENABLE_MOCK_API === 'true'

// Mock users data
const MOCK_USERS: User[] = [
  {
    id: 1,
    email: 'admin@fivucsas.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    tenantId: 1,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    lastLoginAt: '2025-11-17T06:00:00Z',
    lastLoginIp: '192.168.1.1',
  },
  {
    id: 2,
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    tenantId: 1,
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-01T10:00:00Z',
    lastLoginAt: '2025-11-16T14:30:00Z',
    lastLoginIp: '192.168.1.50',
  },
  {
    id: 3,
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: UserRole.USER,
    status: UserStatus.PENDING_ENROLLMENT,
    tenantId: 1,
    createdAt: '2025-03-10T10:00:00Z',
    updatedAt: '2025-03-10T10:00:00Z',
  },
  {
    id: 4,
    email: 'bob.wilson@example.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    role: UserRole.USER,
    status: UserStatus.SUSPENDED,
    tenantId: 1,
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-11-15T10:00:00Z',
    lastLoginAt: '2025-11-10T10:00:00Z',
    lastLoginIp: '192.168.1.75',
  },
  {
    id: 5,
    email: 'alice.johnson@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    tenantId: 1,
    createdAt: '2025-01-25T10:00:00Z',
    updatedAt: '2025-01-25T10:00:00Z',
    lastLoginAt: '2025-11-16T18:00:00Z',
    lastLoginIp: '192.168.1.100',
  },
]

class UsersService {
  async getUsers(page: number = 0, size: number = 20): Promise<PaginatedResponse<User>> {
    if (MOCK_MODE) {
      await this.delay(400)

      return {
        content: MOCK_USERS,
        totalElements: MOCK_USERS.length,
        totalPages: 1,
        page,
        size,
      }
    }

    // Real API call
    const response = await api.get<User[]>('/users')
    // Backend returns array, not paginated response yet
    // TODO: Backend should implement pagination
    return {
      content: response.data,
      totalElements: response.data.length,
      totalPages: Math.ceil(response.data.length / size),
      page,
      size,
    }
  }

  async getUserById(id: number): Promise<User> {
    if (MOCK_MODE) {
      await this.delay(300)
      const user = MOCK_USERS.find(u => u.id === id)
      if (!user) throw new Error('User not found')
      return user
    }

    // Real API call
    const response = await api.get<User>(`/users/${id}`)
    return response.data
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    if (MOCK_MODE) {
      await this.delay(500)
      const newUser: User = {
        ...user,
        id: Math.max(...MOCK_USERS.map(u => u.id)) + 1,
      }
      MOCK_USERS.push(newUser)
      return newUser
    }

    // Real API call
    // Map frontend User to backend CreateUserRequest format
    const createRequest = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: 'DefaultPassword123!', // TODO: Should come from form
      role: user.role,
      tenantId: user.tenantId,
    }
    const response = await api.post<User>('/users', createRequest)
    return response.data
  }

  async updateUser(id: number, user: User): Promise<User> {
    if (MOCK_MODE) {
      await this.delay(400)
      const index = MOCK_USERS.findIndex(u => u.id === id)
      if (index === -1) throw new Error('User not found')
      MOCK_USERS[index] = { ...user, id, updatedAt: new Date().toISOString() }
      return MOCK_USERS[index]
    }

    // Real API call
    // Map frontend User to backend UpdateUserRequest format
    const updateRequest = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    }
    const response = await api.put<User>(`/users/${id}`, updateRequest)
    return response.data
  }

  async deleteUser(id: number): Promise<void> {
    if (MOCK_MODE) {
      await this.delay(300)
      const index = MOCK_USERS.findIndex(u => u.id === id)
      if (index !== -1) {
        MOCK_USERS.splice(index, 1)
      }
      console.log(`Mock: Delete user ${id}`)
      return
    }

    // Real API call
    await api.delete(`/users/${id}`)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default new UsersService()
