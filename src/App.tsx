import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './features/auth/hooks/useAuth'
import DashboardLayout from './components/layout/DashboardLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CircularProgress, Box } from '@mui/material'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./features/auth/components/LoginPage'))
const DashboardPage = lazy(() => import('./features/dashboard/components/DashboardPage'))
const UsersListPage = lazy(() => import('./features/users/components/UsersListPage'))
const UserDetailsPage = lazy(() => import('./pages/UserDetailsPage'))
const UserFormPage = lazy(() => import('./pages/UserFormPage'))
const TenantsListPage = lazy(() => import('./pages/TenantsListPage'))
const EnrollmentsListPage = lazy(() => import('./pages/EnrollmentsListPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

/**
 * Loading fallback for lazy-loaded components
 */
function PageLoader() {
    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400,
            }}
        >
            <CircularProgress />
        </Box>
    )
}

/**
 * Protected Route Component
 * Uses new auth architecture with useAuth hook
 */
interface ProtectedRouteProps {
    children: React.ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                }}
            >
                <CircularProgress />
            </Box>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function App() {
    return (
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<DashboardPage />} />
                    <Route path="users" element={<UsersListPage />} />
                    <Route path="users/create" element={<UserFormPage />} />
                    <Route path="users/:id" element={<UserDetailsPage />} />
                    <Route path="users/:id/edit" element={<UserFormPage />} />
                    <Route path="tenants" element={<TenantsListPage />} />
                    <Route path="enrollments" element={<EnrollmentsListPage />} />
                    <Route path="audit-logs" element={<AuditLogsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
        </ErrorBoundary>
    )
}

export default App
