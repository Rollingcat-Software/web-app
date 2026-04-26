/**
 * AuthMethodsTestingPage
 *
 * Admin playground for every pluggable authentication method the platform
 * supports. Renders a responsive grid of `AuthMethodCard`s driven by
 * AUTH_METHOD_REGISTRY; launching a card opens the shared
 * `AuthMethodRunnerModal` with stubbed dependencies.
 *
 * NOTE: this page is NOT the Biometric Puzzles page. The Biometric Puzzles
 * page (`src/pages/BiometricPuzzlesPage.tsx`) lists the 23 face/hand
 * micro-challenges used for active liveness. This one exists so tenants
 * can preview each of the 9 auth methods end-to-end before wiring them into
 * their auth flow.
 *
 * Future work (intentionally out of scope of this PR):
 *   - Difficulty + platform filters
 *   - "Try this method" deep-link from the AuthFlow editor
 *   - Shared package so the landing-website can embed the same grid
 */
import { useCallback, useMemo, useState } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import AuthMethodCard from '@features/auth-methods-testing/AuthMethodCard'
import AuthMethodRunnerModal from '@features/auth-methods-testing/AuthMethodRunnerModal'
import {
    listAuthMethods,
    type AuthMethodEntry,
} from '@features/auth-methods-testing/authMethodRegistry'

export default function AuthMethodsTestingPage() {
    const { t } = useTranslation()
    const [activeMethod, setActiveMethod] = useState<AuthMethodEntry | null>(null)

    const methods = useMemo(() => listAuthMethods(), [])

    const handleLaunch = useCallback((method: AuthMethodEntry) => {
        setActiveMethod(method)
    }, [])

    const handleClose = useCallback(() => {
        setActiveMethod(null)
    }, [])

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '100%',
                px: { xs: 2, sm: 0 },
                boxSizing: 'border-box',
            }}
        >
            <Typography
                variant="h5"
                fontWeight={700}
                sx={{ mb: 0.5, wordBreak: 'break-word' }}
            >
                {t('authMethodsTesting.pageTitle')}
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, wordBreak: 'break-word' }}
            >
                {t('authMethodsTesting.pageSubtitle')}
            </Typography>

            {/* TODO: difficulty + platform filters (post-MVP). */}

            <Grid container spacing={2}>
                {methods.map((method) => (
                    <Grid key={method.id} item xs={12} sm={6} md={4} lg={3}>
                        <AuthMethodCard method={method} onLaunch={handleLaunch} />
                    </Grid>
                ))}
            </Grid>

            <AuthMethodRunnerModal
                method={activeMethod}
                open={activeMethod !== null}
                onClose={handleClose}
            />
        </Box>
    )
}
