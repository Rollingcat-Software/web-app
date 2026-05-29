import { useState } from 'react'
import {
    alpha,
    Box,
    Chip,
    CircularProgress,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material'
import { Check, SwitchAccount } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { INotifier } from '@domain/interfaces/INotifier'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatApiError } from '@/utils/formatApiError'
import { useAccountSwitcher, type IdentityMembership } from './useAccountSwitcher'

/**
 * TopBar **account / workspace switcher** for Identity & Account-Linking
 * **Phase 5**. Shown ONLY when the logged-in person has more than one linked
 * membership (`/identity/me` returns >1 membership). Selecting a DIFFERENT
 * membership calls `POST /auth/switch-membership`, swaps the session tokens via
 * the canonical login path, and reloads so the new identity / role / tenant
 * takes effect everywhere.
 *
 * <p><b>Not the SUPER_ADMIN data-switcher.</b> This changes WHO you are; the
 * `X-Tenant-ID` selector in {@code TopBar} only re-scopes a SUPER_ADMIN's data
 * VIEW. Both are intentionally separate and clearly labelled
 * ("Switch account" vs the tenant view selector).</p>
 */
export default function AccountSwitcher() {
    const theme = useTheme()
    const isDark = theme.palette.mode === 'dark'
    const { t } = useTranslation()
    const { user, refreshUser } = useAuth()
    const notifier = useService<INotifier>(TYPES.Notifier)
    const { memberships, canSwitch, loading, switching, switchMembership } =
        useAccountSwitcher()

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    // Hide entirely while loading the membership list, or when the person has a
    // single membership (the common case). Keeps the TopBar uncluttered.
    if (loading || !canSwitch) {
        return null
    }

    const currentUserId = user?.id ?? null
    const currentMembership =
        memberships.find((m) => m.userId === currentUserId) ?? null

    const open = Boolean(anchorEl)
    const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
    const handleClose = () => setAnchorEl(null)

    const membershipLabel = (m: IdentityMembership) =>
        m.tenantName ?? t('accountSwitcher.unknownTenant')

    const handleSelect = async (m: IdentityMembership) => {
        handleClose()
        // Selecting the membership you are already operating as is a no-op.
        if (m.userId === currentUserId) {
            return
        }
        try {
            await switchMembership(m.userId)
            await refreshUser()
            notifier.success(
                t('accountSwitcher.switchSuccess', { tenant: membershipLabel(m) }),
            )
            // Full reload so EVERY already-fetched surface re-bootstraps under
            // the new membership (role / tenant / permissions) — matches how the
            // app re-bootstraps after login.
            window.location.assign('/')
        } catch (err) {
            notifier.error(formatApiError(err, t))
        }
    }

    return (
        <>
            <Tooltip title={t('accountSwitcher.tooltip')}>
                <Box
                    component="button"
                    type="button"
                    onClick={handleOpen}
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-label={t('accountSwitcher.label')}
                    disabled={switching}
                    sx={{
                        display: { xs: 'none', sm: 'flex' },
                        alignItems: 'center',
                        gap: 0.75,
                        mr: 0.5,
                        px: 1.25,
                        py: 0.75,
                        maxWidth: 220,
                        cursor: switching ? 'default' : 'pointer',
                        border: 'none',
                        borderRadius: '8px',
                        font: 'inherit',
                        color: 'text.primary',
                        backgroundColor: alpha('#8b5cf6', isDark ? 0.16 : 0.08),
                        '&:hover': {
                            backgroundColor: alpha('#8b5cf6', isDark ? 0.24 : 0.14),
                        },
                    }}
                >
                    {switching ? (
                        <CircularProgress size={16} sx={{ color: 'secondary.main' }} />
                    ) : (
                        <SwitchAccount sx={{ fontSize: 18, color: 'secondary.main' }} />
                    )}
                    <Typography
                        variant="caption"
                        noWrap
                        sx={{ fontWeight: 600, lineHeight: 1.2 }}
                    >
                        {currentMembership
                            ? membershipLabel(currentMembership)
                            : t('accountSwitcher.label')}
                    </Typography>
                </Box>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{ sx: { minWidth: 280 } }}
            >
                <Typography
                    variant="overline"
                    sx={{ px: 2, pt: 1, display: 'block', color: 'text.secondary' }}
                >
                    {t('accountSwitcher.menuHeading')}
                </Typography>
                {memberships.map((m) => {
                    const isCurrent = m.userId === currentUserId
                    const disabled = isCurrent || !m.isActive || switching
                    return (
                        <MenuItem
                            key={m.userId}
                            onClick={() => handleSelect(m)}
                            disabled={disabled}
                            selected={isCurrent}
                        >
                            <ListItemIcon>
                                {isCurrent ? (
                                    <Check fontSize="small" color="secondary" />
                                ) : (
                                    <SwitchAccount fontSize="small" />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={membershipLabel(m)}
                                secondary={m.role ?? undefined}
                                primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
                            />
                            {isCurrent && (
                                <Chip
                                    label={t('accountSwitcher.current')}
                                    size="small"
                                    color="secondary"
                                    sx={{ ml: 1, height: 20, fontSize: '0.62rem' }}
                                />
                            )}
                            {!isCurrent && !m.isActive && (
                                <Chip
                                    label={t('accountSwitcher.inactive')}
                                    size="small"
                                    sx={{ ml: 1, height: 20, fontSize: '0.62rem' }}
                                />
                            )}
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}
