import React from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Paper,
    Box,
    Typography,
    Skeleton,
    Alert,
} from '@mui/material'

/**
 * Column definition for paginated table
 */
export interface TableColumn<T> {
    id: string
    label: string
    minWidth?: number
    align?: 'left' | 'center' | 'right'
    format?: (value: T) => React.ReactNode
    render?: (row: T) => React.ReactNode
}

/**
 * Paginated table props
 */
export interface PaginatedTableProps<T> {
    columns: TableColumn<T>[]
    data: T[]
    loading?: boolean
    error?: Error | null
    totalItems: number
    page: number
    pageSize: number
    pageSizeOptions?: number[]
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    getRowKey: (row: T) => string | number
    emptyMessage?: string
    onRowClick?: (row: T) => void
    stickyHeader?: boolean
    maxHeight?: number | string
}

/**
 * Reusable paginated table component
 *
 * @example
 * <PaginatedTable
 *   columns={[
 *     { id: 'name', label: 'Name', render: (row) => row.name },
 *     { id: 'email', label: 'Email', render: (row) => row.email },
 *   ]}
 *   data={users}
 *   loading={loading}
 *   error={error}
 *   totalItems={totalUsers}
 *   page={page}
 *   pageSize={pageSize}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 *   getRowKey={(row) => row.id}
 *   onRowClick={(row) => navigate(`/users/${row.id}`)}
 * />
 */
export function PaginatedTable<T>({
    columns,
    data,
    loading = false,
    error = null,
    totalItems,
    page,
    pageSize,
    pageSizeOptions = [10, 25, 50, 100],
    onPageChange,
    onPageSizeChange,
    getRowKey,
    emptyMessage = 'No data available',
    onRowClick,
    stickyHeader = true,
    maxHeight,
}: PaginatedTableProps<T>) {
    const handleChangePage = (_event: unknown, newPage: number) => {
        onPageChange(newPage)
    }

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        onPageSizeChange(parseInt(event.target.value, 10))
    }

    // Render loading skeleton
    if (loading) {
        return (
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight }}>
                    <Table stickyHeader={stickyHeader}>
                        <TableHead>
                            <TableRow>
                                {columns.map((column) => (
                                    <TableCell
                                        key={column.id}
                                        align={column.align}
                                        style={{ minWidth: column.minWidth }}
                                    >
                                        {column.label}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Array.from({ length: pageSize }).map((_, index) => (
                                <TableRow key={index}>
                                    {columns.map((column) => (
                                        <TableCell key={column.id}>
                                            <Skeleton variant="text" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        )
    }

    // Render error state
    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error.message || 'An error occurred while loading data'}
            </Alert>
        )
    }

    // Render empty state
    if (!data || data.length === 0) {
        return (
            <Paper sx={{ width: '100%', p: 4 }}>
                <Box textAlign="center">
                    <Typography variant="body1" color="text.secondary">
                        {emptyMessage}
                    </Typography>
                </Box>
            </Paper>
        )
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight }}>
                <Table stickyHeader={stickyHeader}>
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    align={column.align}
                                    style={{ minWidth: column.minWidth }}
                                >
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row) => (
                            <TableRow
                                hover
                                key={getRowKey(row)}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                sx={{
                                    cursor: onRowClick ? 'pointer' : 'default',
                                }}
                            >
                                {columns.map((column) => (
                                    <TableCell key={column.id} align={column.align}>
                                        {column.render
                                            ? column.render(row)
                                            : column.format
                                            ? column.format(row)
                                            : (row as Record<string, unknown>)[column.id] as React.ReactNode}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={pageSizeOptions}
                component="div"
                count={totalItems}
                rowsPerPage={pageSize}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </Paper>
    )
}

export default PaginatedTable
