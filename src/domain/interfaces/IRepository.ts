/**
 * Generic repository interface
 * Defines standard CRUD operations for data access
 * @template T - Entity type
 * @template ID - ID type (defaults to string)
 */
export interface IRepository<T, ID = string> {
    /**
     * Find all entities matching the query parameters
     */
    findAll(params?: QueryParams): Promise<PaginatedResult<T>>

    /**
     * Find entity by ID
     * @returns Entity if found, null otherwise
     */
    findById(id: ID): Promise<T | null>

    /**
     * Create new entity
     */
    create(entity: CreateEntity<T>): Promise<T>

    /**
     * Update existing entity
     */
    update(id: ID, entity: UpdateEntity<T>): Promise<T>

    /**
     * Delete entity by ID
     */
    delete(id: ID): Promise<void>
}

/**
 * Query parameters for list operations
 */
export interface QueryParams {
    page?: number
    pageSize?: number
    sort?: string
    order?: 'asc' | 'desc'
    filters?: Record<string, unknown>
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

/**
 * Helper type to exclude 'id' and timestamp fields from entity
 */
export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Helper type for update operations (all fields optional except certain system fields)
 */
export type UpdateEntity<T> = Partial<Omit<T, 'id' | 'createdAt'>>
