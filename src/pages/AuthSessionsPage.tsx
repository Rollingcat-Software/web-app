import { useState } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
        case 'COMPLETED': return 'success'
        case 'IN_PROGRESS': return 'warning'
        case 'FAILED': return 'error'
        case 'EXPIRED': return 'error'
        case 'CANCELLED': return 'default'
        case 'CREATED': return 'info'
        default: return 'default'
    }
}

export default function AuthSessionsPage() {
    const [statusFilter, setStatusFilter] = useState<string>('')

    // Sessions will be loaded from API in future iteration
    const sessions: Array<{
        id: string
        operationType: string
        status: string
        currentStep: number
        userEmail?: string
        createdAt: string
    }> = []

    return (
        <PageTransition>
            <Box>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                >
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h4" fontWeight={700}>
                            Authentication Sessions
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Monitor active and completed authentication sessions
                        </Typography>
                    </Box>
                </motion.div>

                <Box sx={{ mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Filter by Status</InputLabel>
                        <Select
                            value={statusFilter}
                            label="Filter by Status"
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <MenuItem value="">All Statuses</MenuItem>
                            <MenuItem value="CREATED">Created</MenuItem>
                            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                            <MenuItem value="COMPLETED">Completed</MenuItem>
                            <MenuItem value="FAILED">Failed</MenuItem>
                            <MenuItem value="EXPIRED">Expired</MenuItem>
                            <MenuItem value="CANCELLED">Cancelled</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {sessions.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <Typography variant="h6" color="text.secondary">
                                No authentication sessions found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Sessions will appear here when users authenticate through multi-step flows
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Session ID</TableCell>
                                    <TableCell>User</TableCell>
                                    <TableCell>Operation</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Current Step</TableCell>
                                    <TableCell>Created</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sessions.map((session) => (
                                    <TableRow key={session.id} hover>
                                        <TableCell>
                                            <Typography variant="caption" fontFamily="monospace">
                                                {session.id.substring(0, 8)}...
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{session.userEmail || '-'}</TableCell>
                                        <TableCell>
                                            <Chip label={session.operationType} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={session.status}
                                                size="small"
                                                color={getStatusColor(session.status)}
                                            />
                                        </TableCell>
                                        <TableCell>Step {session.currentStep}</TableCell>
                                        <TableCell>{new Date(session.createdAt).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </PageTransition>
    )
}
