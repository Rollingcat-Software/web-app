import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {Autorenew, CheckCircle, Delete, Error, Refresh, Schedule, Search, Visibility,} from '@mui/icons-material'
import {useEnrollments} from '@features/enrollments'
import {EnrollmentStatus} from '@domain/models/Enrollment'
import {format} from 'date-fns'
import {keyframes} from '@mui/system'

const rotate = keyframes`
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
`

function getStatusColor(status: EnrollmentStatus): 'success' | 'warning' | 'error' | 'info' {
    switch (status) {
        case EnrollmentStatus.SUCCESS:
            return 'success'
        case EnrollmentStatus.PENDING:
            return 'warning'
        case EnrollmentStatus.PROCESSING:
            return 'info'
        case EnrollmentStatus.FAILED:
            return 'error'
        default:
            return 'warning'
    }
}

function getStatusIcon(status: EnrollmentStatus) {
    switch (status) {
        case EnrollmentStatus.SUCCESS:
            return <CheckCircle fontSize="small"/>
        case EnrollmentStatus.PENDING:
            return <Schedule fontSize="small"/>
        case EnrollmentStatus.PROCESSING:
            return <Autorenew fontSize="small" sx={{animation: `${rotate} 2s linear infinite`}}/>
        case EnrollmentStatus.FAILED:
            return <Error fontSize="small"/>
    }
}

export default function EnrollmentsListPage() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'ALL'>('ALL')
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const filters = statusFilter === 'ALL' ? undefined : {status: statusFilter}
    const {enrollments, loading, retryEnrollment, deleteEnrollment} = useEnrollments(filters)

    const filteredEnrollments = enrollments.filter((enrollment) =>
        enrollment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        enrollment.userId.toString().includes(searchQuery)
    )

    const handleRetry = async (id: string) => {
        try {
            await retryEnrollment(id)
        } catch {
            // Error handled by hook
        }
    }

    const handleDeleteClick = (id: string) => {
        setDeletingId(id)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (deletingId) {
            try {
                await deleteEnrollment(deletingId)
            } catch {
                // Error handled by hook
            }
        }
        setDeleteDialogOpen(false)
        setDeletingId(null)
    }

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false)
        setDeletingId(null)
    }

    return (
        <Box>
            <Box sx={{mb: 3}}>
                <Typography variant="h4" gutterBottom fontWeight={600}>
                    Biometric Enrollments
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Monitor and manage biometric enrollment jobs
                </Typography>
            </Box>

            <Box sx={{display: 'flex', gap: 2, mb: 3}}>
                <Paper sx={{p: 2, flex: 1}}>
                    <TextField
                        fullWidth
                        placeholder="Search by enrollment ID or user ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search/>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Paper>

                <Paper sx={{p: 2, minWidth: 200}}>
                    <TextField
                        select
                        fullWidth
                        label="Status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | 'ALL')}
                    >
                        <MenuItem value="ALL">All Statuses</MenuItem>
                        <MenuItem value={EnrollmentStatus.SUCCESS}>Success</MenuItem>
                        <MenuItem value={EnrollmentStatus.PENDING}>Pending</MenuItem>
                        <MenuItem value={EnrollmentStatus.PROCESSING}>Processing</MenuItem>
                        <MenuItem value={EnrollmentStatus.FAILED}>Failed</MenuItem>
                    </TextField>
                </Paper>
            </Box>

            {loading ? (
                <Box sx={{display: 'flex', justifyContent: 'center', py: 8}}>
                    <CircularProgress/>
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Enrollment ID</TableCell>
                                <TableCell>User ID</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Quality Score</TableCell>
                                <TableCell>Liveness Score</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell>Completed</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredEnrollments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <Typography color="text.secondary" py={4}>
                                            No enrollments found
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredEnrollments.map((enrollment) => (
                                    <TableRow key={enrollment.id} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontFamily="monospace">
                                                {enrollment.id}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{enrollment.userId}</TableCell>
                                        <TableCell>
                                            <Chip
                                                icon={getStatusIcon(enrollment.status)}
                                                label={enrollment.status}
                                                size="small"
                                                color={getStatusColor(enrollment.status)}
                                            />
                                            {enrollment.errorMessage && (
                                                <Tooltip title={enrollment.errorMessage}>
                                                    <Typography
                                                        variant="caption"
                                                        color="error"
                                                        sx={{display: 'block', mt: 0.5}}
                                                    >
                                                        {enrollment.errorCode}
                                                    </Typography>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {enrollment.qualityScore
                                                ? `${(enrollment.qualityScore * 100).toFixed(1)}%`
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {enrollment.livenessScore
                                                ? `${(enrollment.livenessScore * 100).toFixed(1)}%`
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(enrollment.createdAt), 'MMM dd, HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            {enrollment.completedAt
                                                ? format(new Date(enrollment.completedAt), 'MMM dd, HH:mm')
                                                : '-'}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={() => navigate(`/enrollments/${enrollment.id}`)}
                                                aria-label="View details"
                                            >
                                                <Visibility fontSize="small"/>
                                            </IconButton>
                                            {enrollment.status === EnrollmentStatus.FAILED && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleRetry(enrollment.id)}
                                                    color="primary"
                                                    aria-label="Retry enrollment"
                                                >
                                                    <Refresh fontSize="small"/>
                                                </IconButton>
                                            )}
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDeleteClick(enrollment.id)}
                                                color="error"
                                                aria-label="Delete enrollment"
                                            >
                                                <Delete fontSize="small"/>
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog
                open={deleteDialogOpen}
                onClose={handleDeleteCancel}
                aria-labelledby="delete-enrollment-dialog-title"
            >
                <DialogTitle id="delete-enrollment-dialog-title">Delete Enrollment</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this enrollment job?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
