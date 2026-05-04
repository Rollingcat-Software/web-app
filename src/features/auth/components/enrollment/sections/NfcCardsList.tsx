/**
 * Collapsible list of enrolled NFC cards with deactivate action.
 * Visible only when NFC_DOCUMENT is enrolled. Owns its own expanded/loading
 * state and `userId`-based fetch effect.
 *
 * Extracted from EnrollmentPage.tsx during P1-Q7 decomposition.
 * Behavior unchanged: same /nfc/user/{id} GET, same DELETE /nfc/cards/{id},
 * same silent-fail behavior on the GET (cards list is supplementary).
 */
import { useCallback, useEffect, useState } from 'react'
import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Collapse,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material'
import { Delete, ExpandLess, ExpandMore, Nfc } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'
import type { NfcCard, NfcCardsResponse, ShowSnackbar } from '../types'

interface Props {
    userId: string
    /** Re-fetch trigger — bumped by parent when enrollments change. */
    refreshKey: unknown
    showSnackbar: ShowSnackbar
}

export default function NfcCardsList({ userId, refreshKey, showSnackbar }: Props) {
    const { t } = useTranslation()
    const [nfcCards, setNfcCards] = useState<NfcCard[]>([])
    const [nfcCardsLoading, setNfcCardsLoading] = useState(false)
    const [nfcCardsExpanded, setNfcCardsExpanded] = useState(true)
    const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

    const fetchNfcCards = useCallback(async () => {
        if (!userId) return
        setNfcCardsLoading(true)
        try {
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            const response = await httpClient.get<NfcCardsResponse>(`/nfc/user/${userId}`)
            setNfcCards(response.data?.cards ?? [])
        } catch {
            // Silently fail — cards list is supplementary
            setNfcCards([])
        } finally {
            setNfcCardsLoading(false)
        }
    }, [userId])

    useEffect(() => {
        fetchNfcCards()
    }, [fetchNfcCards, refreshKey])

    const handleDeleteNfcCard = useCallback(
        async (cardId: string) => {
            setDeletingCardId(cardId)
            try {
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                await httpClient.delete(`/nfc/cards/${cardId}`)
                showSnackbar(t('enrollmentPage.nfcCards.deleteSuccess'), 'success')
                fetchNfcCards()
            } catch (err) {
                showSnackbar(formatApiError(err, t), 'error')
            } finally {
                setDeletingCardId(null)
            }
        },
        [fetchNfcCards, t, showSnackbar]
    )

    return (
        <Card
            sx={{
                mt: 3,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
            }}
        >
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                    }}
                    onClick={() => setNfcCardsExpanded(!nfcCardsExpanded)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Nfc sx={{ fontSize: 22, color: 'white' }} />
                        </Box>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                                {t('enrollmentPage.nfcCards.title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('enrollmentPage.nfcCards.subtitle', { count: nfcCards.length })}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton size="small" aria-label={nfcCardsExpanded ? t('common.aria.collapse') : t('common.aria.expand')}>
                        {nfcCardsExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                </Box>

                <Collapse in={nfcCardsExpanded}>
                    <Box sx={{ mt: 2 }}>
                        {nfcCardsLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress size={28} />
                            </Box>
                        ) : nfcCards.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                {t('enrollmentPage.nfcCards.noCards')}
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {nfcCards.map((card) => (
                                    <Box
                                        key={card.cardId}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            p: 2,
                                            borderRadius: '12px',
                                            bgcolor: card.isActive ? 'action.hover' : 'action.disabledBackground',
                                            border: '1px solid',
                                            borderColor: card.isActive ? 'divider' : 'action.disabled',
                                            opacity: card.isActive ? 1 : 0.7,
                                        }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={700}
                                                    sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                                >
                                                    {card.cardSerial}
                                                </Typography>
                                                <Chip
                                                    label={card.isActive ? t('enrollmentPage.nfcCards.active') : t('enrollmentPage.nfcCards.inactive')}
                                                    size="small"
                                                    color={card.isActive ? 'success' : 'default'}
                                                    sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem' }}
                                                />
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('enrollmentPage.nfcCards.type')}: {card.cardType}
                                                </Typography>
                                                {card.label && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('enrollmentPage.nfcCards.label')}: {card.label}
                                                    </Typography>
                                                )}
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('enrollmentPage.nfcCards.enrolledAt')}: {new Date(card.enrolledAt).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {card.isActive && (
                                            <Tooltip title={t('enrollmentPage.nfcCards.deactivate')}>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteNfcCard(card.cardId)}
                                                    disabled={deletingCardId === card.cardId}
                                                    aria-label={t('common.aria.delete')}
                                                    sx={{ ml: 1 }}
                                                >
                                                    {deletingCardId === card.cardId ? (
                                                        <CircularProgress size={18} color="error" />
                                                    ) : (
                                                        <Delete fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </CardContent>
        </Card>
    )
}
