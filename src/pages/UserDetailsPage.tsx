import {useNavigate, useParams} from 'react-router-dom'
import {Box, Button, CircularProgress, Paper, Typography} from '@mui/material'
import {ArrowBack} from '@mui/icons-material'
import {useUser} from '@features/users'

export default function UserDetailsPage() {
    const {id} = useParams()
    const navigate = useNavigate()
    const {user, loading, error} = useUser(id || '')

    if (loading) {
        return (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 8}}>
                <CircularProgress/>
            </Box>
        )
    }

    return (
        <Box>
            <Button
                startIcon={<ArrowBack/>}
                onClick={() => navigate('/users')}
                sx={{mb: 2}}
            >
                Back to Users
            </Button>

            <Typography variant="h4" gutterBottom fontWeight={600}>
                User Details
            </Typography>

            <Paper sx={{p: 4, textAlign: 'center', minHeight: 400}}>
                {error ? (
                    <Typography variant="body1" color="error">
                        Failed to load user: {error.message}
                    </Typography>
                ) : user ? (
                    <>
                        <Typography variant="h6" color="text.secondary">
                            User ID: {user.id}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
                            {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                            {user.email}
                        </Typography>
                    </>
                ) : (
                    <Typography variant="body1" color="text.secondary">
                        User not found
                    </Typography>
                )}
            </Paper>
        </Box>
    )
}
