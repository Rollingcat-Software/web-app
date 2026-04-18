import { injectable } from 'inversify'
import type {
    CreateUserData,
    IUserRepository,
    UpdateUserData,
    UserDataExport,
} from '@domain/interfaces/IUserRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { User, UserRole, UserStatus } from '@domain/models/User'

function toUserRole(value: string | undefined): UserRole {
    if (!value) {
        return UserRole.USER
    }

    return Object.values(UserRole).includes(value as UserRole)
        ? (value as UserRole)
        : UserRole.USER
}

function toUserStatus(value: string | undefined): UserStatus {
    if (!value) {
        return UserStatus.ACTIVE
    }

    return Object.values(UserStatus).includes(value as UserStatus)
        ? (value as UserStatus)
        : UserStatus.ACTIVE
}

@injectable()
export class MockUserRepository implements IUserRepository {
    private users = new Map<string, User>([
        [
            '1',
            new User(
                '1',
                'admin@fivucsas.com',
                'Admin',
                'User',
                UserRole.ADMIN,
                UserStatus.ACTIVE,
                '1',
                new Date(),
                new Date()
            ),
        ],
        [
            '2',
            new User(
                '2',
                'user@fivucsas.com',
                'Normal',
                'User',
                UserRole.USER,
                UserStatus.ACTIVE,
                '1',
                new Date(),
                new Date()
            ),
        ],
    ])

    async findAll(params?: QueryParams): Promise<PaginatedResult<User>> {
        const page = params?.page ?? 0
        const pageSize = params?.pageSize ?? 20
        const filters = params?.filters ?? {}

        const filtered = Array.from(this.users.values()).filter((user) => {
            const roleFilter = filters.role as string | undefined
            const statusFilter = filters.status as string | undefined
            const emailFilter = filters.email as string | undefined

            if (roleFilter && user.role !== roleFilter) {
                return false
            }

            if (statusFilter && user.status !== statusFilter) {
                return false
            }

            if (emailFilter && user.email !== emailFilter) {
                return false
            }

            return true
        })

        const start = page * pageSize
        const items = filtered.slice(start, start + pageSize)

        return {
            items,
            total: filtered.length,
            page,
            pageSize,
            totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize),
        }
    }

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) ?? null
    }

    async findByEmail(email: string): Promise<User | null> {
        const found = Array.from(this.users.values()).find((user) => user.email === email)
        return found ?? null
    }

    async create(data: CreateUserData): Promise<User> {
        const id = String(this.users.size + 1)
        const user = new User(
            id,
            data.email,
            data.firstName,
            data.lastName,
            toUserRole(data.role),
            UserStatus.PENDING_ENROLLMENT,
            data.tenantId,
            new Date(),
            new Date()
        )

        this.users.set(id, user)
        return user
    }

    async update(id: string, data: UpdateUserData): Promise<User> {
        const current = this.users.get(id)
        if (!current) {
            throw new Error(`User not found: ${id}`)
        }

        const updated = new User(
            current.id,
            data.email ?? current.email,
            data.firstName ?? current.firstName,
            data.lastName ?? current.lastName,
            data.role ? toUserRole(data.role) : current.role,
            data.status ? toUserStatus(data.status) : current.status,
            current.tenantId,
            current.createdAt,
            new Date()
        )

        this.users.set(id, updated)
        return updated
    }

    async delete(id: string): Promise<void> {
        this.users.delete(id)
    }

    async search(query: string): Promise<PaginatedResult<User>> {
        const lowerQuery = query.toLowerCase()
        const filtered = Array.from(this.users.values()).filter(
            (user) =>
                user.email.toLowerCase().includes(lowerQuery) ||
                user.fullName.toLowerCase().includes(lowerQuery)
        )

        return {
            items: filtered,
            total: filtered.length,
            page: 0,
            pageSize: filtered.length || 20,
            totalPages: 1,
        }
    }

    async exportData(id: string): Promise<UserDataExport> {
        const user = this.users.get(id)
        const bundle = {
            exportDate: new Date().toISOString(),
            user: user ? { id: user.id, email: user.email } : null,
        }
        return {
            blob: new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
            filename: `fivucsas-export-${id}.json`,
        }
    }
}
