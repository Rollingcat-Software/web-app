/**
 * Domain interfaces module
 * Exports all core interfaces for dependency injection and abstraction
 */

export type { IConfig } from './IConfig'
export type { ILogger } from './ILogger'
export type { INotifier } from './INotifier'
export type { IStorage, ISecureStorage } from './IStorage'
export type { IHttpClient, HttpResponse, RequestConfig } from './IHttpClient'
export type {
    IRepository,
    QueryParams,
    PaginatedResult,
    CreateEntity,
    UpdateEntity,
} from './IRepository'
export type {
    ITokenService,
    TokenPair,
    JwtPayload,
} from './ITokenService'
