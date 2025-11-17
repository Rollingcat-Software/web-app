import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth'
import { useAuth } from './features/auth/hooks/useAuth'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './features/dashboard/components/DashboardPage'
import UsersListPage from './features/users/components/UsersListPage'
import UserDetailsPage from './pages/UserDetailsPage'
import UserFormPage from './pages/UserFormPage'
import TenantsListPage from './pages/TenantsListPage'
import EnrollmentsListPage from './pages/EnrollmentsListPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'
import { CircularProgress, Box } from '@mui/material'

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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
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
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage/>}/>

            {/* Protected Routes */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <DashboardLayout/>
                    </ProtectedRoute>
                }
            >
                <Route index element={<DashboardPage/>}/>
                <Route path="users" element={<UsersListPage/>}/>
                <Route path="users/create" element={<UserFormPage/>}/>
                <Route path="users/:id" element={<UserDetailsPage/>}/>
                <Route path="users/:id/edit" element={<UserFormPage/>}/>
                <Route path="tenants" element={<TenantsListPage/>}/>
                <Route path="enrollments" element={<EnrollmentsListPage/>}/>
                <Route path="audit-logs" element={<AuditLogsPage/>}/>
                <Route path="settings" element={<SettingsPage/>}/>
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    )
}

export default App
