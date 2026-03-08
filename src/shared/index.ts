/**
 * Shared module exports
 * Contains reusable components, hooks, and utilities
 */

// Hooks
export { usePagination } from './hooks/usePagination'
export type { PaginationOptions, PaginationState, UsePaginationReturn } from './hooks/usePagination'

// Components
export { PaginatedTable } from './components/PaginatedTable'
export type { TableColumn, PaginatedTableProps } from './components/PaginatedTable'
