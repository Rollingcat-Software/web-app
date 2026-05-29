import { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Skeleton,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import { AccountTree, Add, Email as EmailIcon, LinkOff } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useLinkedAccounts, type IdentityMembership } from './useLinkedAccounts'
import LinkAccountDialog from './LinkAccountDialog'

interface LinkedAccountsSectionProps {
    /** The caller's own membership user-id, so we can flag "This account". */
    currentUserId?: string
}

/**
 * Profile "Linked accounts" section (Phase-2 account linking). Lists the
 * person's verified emails and tenant memberships, and offers link / unlink.
 *
 * <p>Self-contained: it owns its own data hook, dialog, and snackbar so it can
 * be dropped into Profile with a single import and minimal edits to the shared
 * page (reducing merge conflicts with the concurrent Phase-3 consent work).</p>
 */
export default function LinkedAccountsSection({ currentUserId }: LinkedAccountsSectionProps) {
    const { t } = useTranslation()
    const { data, loading, error, refetch, initiateLink, confirmLink, unlink } = useLinkedAccounts()

    const [linkOpen, setLinkOpen] = useState(false)
    const [unlinkTarget, setUnlinkTarget] = useState<IdentityMembership | null>(null)
    const [unlinking, setUnlinking] = useState(false)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    })

    const handleUnlink = async () => {
        if (!unlinkTarget) return
        setUnlinking(true)
        try {
            await unlink(unlinkTarget.userId)
            setSnackbar({ open: true, message: t('linkedAccounts.unlinkSuccess'), severity: 'success' })
            setUnlinkTarget(null)
            await refetch()
        } catch (err) {
            setSnackbar({
                open: true,
                message: formatApiError(err, t) || t('linkedAccounts.unlinkError'),
                severity: 'error',
            })
        } finally {
            setUnlinking(false)
        }
    }

    const memberships = data?.memberships ?? []
    const emails = data?.emails ?? []

    return (
        <Card>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountTree sx={{ color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight={600}>
                            {t('linkedAccounts.title')}
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Add />}
                        onClick={() => setLinkOpen(true)}
                    >
                        {t('linkedAccounts.linkButton')}
                    </Button>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('linkedAccounts.subtitle')}
                </Typography>

                {error && (
                    <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                        {t('linkedAccounts.loadError')}
                    </Alert>
                )}

                {loading ? (
                    <Stack spacing={1}>
                        {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}
                    </Stack>
                ) : (
                    <>
                        {/* ---- Verified emails ---- */}
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            {t('linkedAccounts.emailsTitle')}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                            {emails.map((e) => (
                                <Chip
                                    key={e.email}
                                    icon={<EmailIcon />}
                                    label={e.email}
                                    size="small"
                                    color={e.verified ? 'success' : 'default'}
                                    variant="outlined"
                                />
                            ))}
                        </Stack>

                        <Divider sx={{ mb: 2 }} />

                        {/* ---- Memberships ---- */}
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            {t('linkedAccounts.membershipsTitle')}
                        </Typography>
                        {memberships.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                {t('linkedAccounts.noMemberships')}
                            </Typography>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('linkedAccounts.tableTenant')}</TableCell>
                                            <TableCell>{t('linkedAccounts.tableRole')}</TableCell>
                                            <TableCell>{t('linkedAccounts.tableStatus')}</TableCell>
                                            <TableCell align="right" />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {memberships.map((m) => {
                                            const isSelf = currentUserId != null && m.userId === currentUserId
                                            return (
                                                <TableRow key={m.userId} hover>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography variant="body2">
                                                                {m.tenantName || '—'}
                                                            </Typography>
                                                            {isSelf && (
                                                                <Chip
                                                                    label={t('linkedAccounts.you')}
                                                                    size="small"
                                                                    color="primary"
                                                                    sx={{ fontSize: '0.65rem', height: 18 }}
                                                                />
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">
                                                            {m.role ? m.role.replace(/_/g, ' ') : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={m.isActive ? t('linkedAccounts.active') : t('linkedAccounts.inactive')}
                                                            size="small"
                                                            color={m.isActive ? 'success' : 'default'}
                                                            variant="outlined"
                                                            sx={{ fontSize: '0.7rem' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {!isSelf && (
                                                            <Button
                                                                size="small"
                                                                color="error"
                                                                startIcon={<LinkOff />}
                                                                onClick={() => setUnlinkTarget(m)}
                                                            >
                                                                {t('linkedAccounts.unlink')}
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </>
                )}
            </CardContent>

            <LinkAccountDialog
                open={linkOpen}
                onClose={() => setLinkOpen(false)}
                onLinked={async () => {
                    setLinkOpen(false)
                    setSnackbar({ open: true, message: t('linkedAccounts.linkSuccess'), severity: 'success' })
                    await refetch()
                }}
                initiateLink={initiateLink}
                confirmLink={confirmLink}
            />

            {/* Unlink confirmation */}
            <Dialog open={unlinkTarget != null} onClose={() => !unlinking && setUnlinkTarget(null)}>
                <DialogTitle>{t('linkedAccounts.unlinkTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('linkedAccounts.unlinkConfirm', { name: unlinkTarget?.tenantName || unlinkTarget?.userId })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUnlinkTarget(null)} disabled={unlinking}>
                        {t('linkedAccounts.dialog.cancel')}
                    </Button>
                    <Button
                        onClick={handleUnlink}
                        color="error"
                        variant="contained"
                        disabled={unlinking}
                        startIcon={unlinking ? <CircularProgress size={16} /> : <LinkOff />}
                    >
                        {t('linkedAccounts.unlink')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Card>
    )
}
