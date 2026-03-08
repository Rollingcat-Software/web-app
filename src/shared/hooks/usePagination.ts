import { useState, useCallback, useMemo } from 'react'

/**
 * Pagination options
 */
export interface PaginationOptions {
    initialPage?: number
    initialPageSize?: number
    pageSizeOptions?: number[]
}

/**
 * Pagination state
 */
export interface PaginationState {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
}

/**
 * Pagination hook return type
 */
export interface UsePaginationReturn {
    page: number
    pageSize: number
    pageSizeOptions: number[]
    offset: number
    setPage: (page: number) => void
    setPageSize: (size: number) => void
    setTotalItems: (total: number) => void
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    goToFirstPage: () => void
    goToLastPage: () => void
    goToNextPage: () => void
    goToPreviousPage: () => void
    resetPagination: () => void
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * Custom hook for pagination state management
 *
 * @example
 * const {
 *   page,
 *   pageSize,
 *   offset,
 *   setPage,
 *   setPageSize,
 *   setTotalItems,
 *   totalPages,
 * } = usePagination({ initialPageSize: 25 })
 *
 * // Fetch data with pagination
 * const { data } = useQuery(['users', page, pageSize], () =>
 *   fetchUsers({ offset, limit: pageSize })
 * )
 *
 * // Update total items when data changes
 * useEffect(() => {
 *   if (data?.total) setTotalItems(data.total)
 * }, [data])
 */
export function usePagination(options: PaginationOptions = {}): UsePaginationReturn {
    const {
        initialPage = 0,
        initialPageSize = 10,
        pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    } = options

    const [page, setPageState] = useState(initialPage)
    const [pageSize, setPageSizeState] = useState(initialPageSize)
    const [totalItems, setTotalItemsState] = useState(0)

    const totalPages = useMemo(
        () => Math.ceil(totalItems / pageSize) || 1,
        [totalItems, pageSize]
    )

    const offset = useMemo(() => page * pageSize, [page, pageSize])

    const hasNextPage = page < totalPages - 1
    const hasPreviousPage = page > 0

    const setPage = useCallback((newPage: number) => {
        setPageState(Math.max(0, newPage))
    }, [])

    const setPageSize = useCallback((newSize: number) => {
        setPageSizeState(newSize)
        // Reset to first page when page size changes
        setPageState(0)
    }, [])

    const setTotalItems = useCallback((total: number) => {
        setTotalItemsState(total)
        // Adjust page if it's now out of bounds
        const newTotalPages = Math.ceil(total / pageSize) || 1
        setPageState((currentPage) =>
            currentPage >= newTotalPages ? Math.max(0, newTotalPages - 1) : currentPage
        )
    }, [pageSize])

    const goToFirstPage = useCallback(() => setPage(0), [setPage])
    const goToLastPage = useCallback(() => setPage(totalPages - 1), [setPage, totalPages])
    const goToNextPage = useCallback(() => {
        if (hasNextPage) setPage(page + 1)
    }, [hasNextPage, page, setPage])
    const goToPreviousPage = useCallback(() => {
        if (hasPreviousPage) setPage(page - 1)
    }, [hasPreviousPage, page, setPage])

    const resetPagination = useCallback(() => {
        setPageState(initialPage)
        setPageSizeState(initialPageSize)
        setTotalItemsState(0)
    }, [initialPage, initialPageSize])

    return {
        page,
        pageSize,
        pageSizeOptions,
        offset,
        setPage,
        setPageSize,
        setTotalItems,
        totalItems,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        goToFirstPage,
        goToLastPage,
        goToNextPage,
        goToPreviousPage,
        resetPagination,
    }
}

export default usePagination
