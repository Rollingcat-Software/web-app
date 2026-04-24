import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './features/auth/hooks/useAuth'
import DashboardLayout from './components/layout/DashboardLayout'
import PublicLayout from './components/layout/PublicLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CircularProgress, Box } from '@mui/material'

const PAGE_TITLES: Record<string, string> = {
    '/': 'Dashboard — FIVUCSAS',
    '/users': 'Users — FIVUCSAS',
    '/tenants': 'Tenants — FIVUCSAS',
    '/roles': 'Roles — FIVUCSAS',
    '/auth-flows': 'Auth Flows — FIVUCSAS',
    '/auth-sessions': 'Auth Sessions — FIVUCSAS',
    '/devices': 'Devices — FIVUCSAS',
    '/enrollments': 'Enrollments — FIVUCSAS',
    '/user-enrollment': 'Identity Enrollment — FIVUCSAS',
    '/enrollment': 'Biometric Enrollment — FIVUCSAS',
    '/biometric-tools': 'Biometric Tools — FIVUCSAS',
    '/biometric-puzzles': 'Biometric Puzzles — FIVUCSAS',
    '/auth-methods-testing': 'Auth Methods Testing — FIVUCSAS',
    '/widget-demo': 'Auth Widget — FIVUCSAS',
    '/widget-auth': 'Widget Auth — FIVUCSAS',
    '/developer-portal': 'Developer Portal — FIVUCSAS',
    '/verification-flows': 'Verification Flows — FIVUCSAS',
    '/verification-dashboard': 'Verification Dashboard — FIVUCSAS',
    '/verification-sessions': 'Verification Session — FIVUCSAS',
    '/audit-logs': 'Audit Logs — FIVUCSAS',
    '/analytics': 'Analytics — FIVUCSAS',
    '/guests': 'Guests — FIVUCSAS',
    '/settings': 'Settings — FIVUCSAS',
    '/my-profile': 'My Profile — FIVUCSAS',
    '/login': 'Sign In — FIVUCSAS',
    '/register': 'Create Account — FIVUCSAS',
    '/forgot-password': 'Forgot Password — FIVUCSAS',
    '/reset-password': 'Reset Password — FIVUCSAS',
    '/terms': 'Terms of Service — FIVUCSAS',
    '/privacy': 'Privacy Policy — FIVUCSAS',
}

function PageTitle() {
    const location = useLocation()
    const { i18n } = useTranslation()

    useEffect(() => {
        const base = '/' + location.pathname.split('/').filter(Boolean)[0]
        document.title = PAGE_TITLES[base] ?? PAGE_TITLES[location.pathname] ?? 'FIVUCSAS'
    }, [location.pathname])

    // Keep <html lang> in sync with i18next so native date pickers use correct locale
    useEffect(() => {
        document.documentElement.lang = i18n.language
        i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng })
        return () => { i18n.off('languageChanged') }
    }, [i18n])

    return null
}

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
const GuestsPage = lazy(() => import('./pages/GuestsPage'))
const BiometricEnrollmentPage = lazy(() => import('./features/auth/components/EnrollmentPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const BiometricToolsPage = lazy(() => import('./pages/BiometricToolsPage'))
const BiometricPuzzlesPage = lazy(() => import('./pages/BiometricPuzzlesPage'))
const AuthMethodsTestingPage = lazy(() => import('./pages/AuthMethodsTestingPage'))
const WidgetDemoPage = lazy(() => import('./pages/WidgetDemoPage'))
const DeveloperPortalPage = lazy(() => import('./pages/DeveloperPortalPage'))
const VerificationFlowBuilderPage = lazy(() => import('./pages/VerificationFlowBuilderPage'))
const VerificationDashboardPage = lazy(() => import('./pages/VerificationDashboardPage'))
const VerificationSessionDetailPage = lazy(() => import('./pages/VerificationSessionDetailPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const WidgetAuthPage = lazy(() => import('./pages/WidgetAuthPage'))
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'))

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

/**
 * Admin Route Component
 * Redirects non-admin users to the dashboard
 */
const AdminRoute = ({ children }: ProtectedRouteProps) => {
    const { user } = useAuth()

    if (!user?.isAdmin()) {
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}

function App() {
    return (
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
            <PageTitle />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/widget-auth" element={<WidgetAuthPage />} />
                <Route element={<PublicLayout />}>
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/widget-demo" element={<ErrorBoundary><WidgetDemoPage /></ErrorBoundary>} />
                    <Route path="/developer-portal" element={<ErrorBoundary><DeveloperPortalPage /></ErrorBoundary>} />
                </Route>

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
                    <Route path="user-enrollment" element={<Navigate to="/enrollment" replace />} />
                    <Route path="enrollment" element={<ErrorBoundary><BiometricEnrollmentPage /></ErrorBoundary>} />
                    <Route path="biometric-tools" element={<ErrorBoundary><BiometricToolsPage /></ErrorBoundary>} />
                    <Route path="biometric-puzzles" element={<ErrorBoundary><BiometricPuzzlesPage /></ErrorBoundary>} />
                    <Route path="auth-methods-testing" element={<ErrorBoundary><AuthMethodsTestingPage /></ErrorBoundary>} />
                    <Route path="card-detection" element={<Navigate to="/biometric-tools" replace />} />
                    <Route path="face-search" element={<Navigate to="/biometric-tools" replace />} />
                    <Route path="voice-search" element={<Navigate to="/biometric-tools" replace />} />
                    <Route path="nfc-enrollment" element={<Navigate to="/biometric-tools" replace />} />
                    <Route path="verification-flows" element={<AdminRoute><ErrorBoundary><VerificationFlowBuilderPage /></ErrorBoundary></AdminRoute>} />
                    <Route path="verification-dashboard" element={<AdminRoute><ErrorBoundary><VerificationDashboardPage /></ErrorBoundary></AdminRoute>} />
                    <Route path="verification-sessions/:id" element={<AdminRoute><ErrorBoundary><VerificationSessionDetailPage /></ErrorBoundary></AdminRoute>} />
                    <Route path="audit-logs" element={<ErrorBoundary><AuditLogsPage /></ErrorBoundary>} />
                    <Route path="guests" element={<ErrorBoundary><GuestsPage /></ErrorBoundary>} />
                    <Route path="analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
                    <Route path="my-profile" element={<ErrorBoundary><MyProfilePage /></ErrorBoundary>} />
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
