import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './features/auth/hooks/useAuth'
import DashboardLayout from './components/layout/DashboardLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CircularProgress, Box } from '@mui/material'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./features/auth/components/LoginPage'))
const RegisterPage = lazy(() => import('./features/auth/components/RegisterPage'))
const DashboardPage = lazy(() => import('./features/dashboard/components/DashboardPage'))
const UsersListPage = lazy(() => import('./features/users/components/UsersListPage'))
const UserDetailsPage = lazy(() => import('./pages/UserDetailsPage'))
const UserFormPage = lazy(() => import('./pages/UserFormPage'))
const TenantsListPage = lazy(() => import('./pages/TenantsListPage'))
const TenantFormPage = lazy(() => import('./pages/TenantFormPage'))
const EnrollmentsListPage = lazy(() => import('./pages/EnrollmentsListPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const RolesListPage = lazy(() => import('./pages/RolesListPage'))
const RoleFormPage = lazy(() => import('./pages/RoleFormPage'))
const AuthFlowsPage = lazy(() => import('./features/authFlows/components/AuthFlowsPage'))
const DevicesPage = lazy(() => import('./pages/DevicesPage'))
const AuthSessionsPage = lazy(() => import('./pages/AuthSessionsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const UserEnrollmentPage = lazy(() => import('./features/userEnrollment/components/UserEnrollmentPage'))

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
            <CircularProgress aria-label="Loading page" />
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
                <Route path="/register" element={<RegisterPage />} />

                {/* Protected Routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                    <Route path="users" element={<ErrorBoundary><UsersListPage /></ErrorBoundary>} />
                    <Route path="users/create" element={<ErrorBoundary><UserFormPage /></ErrorBoundary>} />
                    <Route path="users/:id" element={<ErrorBoundary><UserDetailsPage /></ErrorBoundary>} />
                    <Route path="users/:id/edit" element={<ErrorBoundary><UserFormPage /></ErrorBoundary>} />
                    <Route path="tenants" element={<ErrorBoundary><TenantsListPage /></ErrorBoundary>} />
                    <Route path="tenants/create" element={<ErrorBoundary><TenantFormPage /></ErrorBoundary>} />
                    <Route path="tenants/:id/edit" element={<ErrorBoundary><TenantFormPage /></ErrorBoundary>} />
                    <Route path="roles" element={<ErrorBoundary><RolesListPage /></ErrorBoundary>} />
                    <Route path="roles/create" element={<ErrorBoundary><RoleFormPage /></ErrorBoundary>} />
                    <Route path="roles/:id/edit" element={<ErrorBoundary><RoleFormPage /></ErrorBoundary>} />
                    <Route path="auth-flows" element={<ErrorBoundary><AuthFlowsPage /></ErrorBoundary>} />
                    <Route path="devices" element={<ErrorBoundary><DevicesPage /></ErrorBoundary>} />
                    <Route path="auth-sessions" element={<ErrorBoundary><AuthSessionsPage /></ErrorBoundary>} />
                    <Route path="enrollments" element={<ErrorBoundary><EnrollmentsListPage /></ErrorBoundary>} />
                    <Route path="user-enrollment" element={<ErrorBoundary><UserEnrollmentPage /></ErrorBoundary>} />
                    <Route path="audit-logs" element={<ErrorBoundary><AuditLogsPage /></ErrorBoundary>} />
                    <Route path="analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
                    <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                </Route>

                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
        </ErrorBoundary>
    )
}

export default App
