import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, Typography, Paper } from '@mui/material'
import { ErrorOutline } from '@mui/icons-material'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

/**
 * Error Boundary component to catch rendering errors
 * Prevents the entire app from crashing when a component fails
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: 400,
                        p: 3,
                    }}
                >
                    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 500 }}>
                        <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                        <Typography variant="h5" gutterBottom fontWeight={600}>
                            Something went wrong
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            An unexpected error occurred. Please try again or contact support if the problem persists.
                        </Typography>
                        {this.state.error && (
                            <Typography
                                variant="caption"
                                component="pre"
                                sx={{
                                    mb: 3,
                                    p: 2,
                                    bgcolor: 'grey.100',
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    textAlign: 'left',
                                    maxHeight: 200,
                                    fontSize: '0.7rem',
                                }}
                            >
                                {this.state.error.message}
                                {'\n'}
                                {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button variant="contained" onClick={this.handleReset}>
                                Try Again
                            </Button>
                            <Button variant="outlined" onClick={() => window.location.assign('/')}>
                                Go to Dashboard
                            </Button>
                            <Button variant="outlined" color="error" onClick={() => {
                                sessionStorage.clear()
                                localStorage.clear()
                                window.location.assign('/login')
                            }}>
                                Logout & Clear
                            </Button>
                        </Box>
                    </Paper>
                </Box>
            )
        }

        return this.props.children
    }
}
