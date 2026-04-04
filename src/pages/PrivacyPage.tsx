import { Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material'
import { CheckCircleOutline } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

export default function PrivacyPage() {
    const { t } = useTranslation()

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>{t('privacy.title')}</Typography>
                <Typography variant="body1" paragraph color="text.secondary">
                    {t('privacy.lastUpdated')}
                </Typography>

                {/* Section 1: Data We Collect */}
                <Typography variant="h6" gutterBottom>{t('privacy.s1Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s1Body')}</Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                    {['s1Biometric', 's1Personal', 's1Technical'].map((key) => (
                        <ListItem key={key} sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <CheckCircleOutline fontSize="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary={t(`privacy.${key}`)}
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                        </ListItem>
                    ))}
                </List>

                {/* Section 2: Processing and Storage */}
                <Typography variant="h6" gutterBottom>{t('privacy.s2Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s2Body')}</Typography>

                {/* Section 3: Retention and Deletion */}
                <Typography variant="h6" gutterBottom>{t('privacy.s3Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s3Body')}</Typography>

                {/* Section 4: KVKK */}
                <Typography variant="h6" gutterBottom>{t('privacy.s4Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s4Body')}</Typography>

                {/* Section 5: GDPR */}
                <Typography variant="h6" gutterBottom>{t('privacy.s5Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s5Body')}</Typography>

                {/* Section 6: Your Rights */}
                <Typography variant="h6" gutterBottom>{t('privacy.s6Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s6Body')}</Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                    {['s6Right1', 's6Right2', 's6Right3', 's6Right4', 's6Right5', 's6Right6'].map((key) => (
                        <ListItem key={key} sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <CheckCircleOutline fontSize="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary={t(`privacy.${key}`)}
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                        </ListItem>
                    ))}
                </List>

                {/* Section 7: Third-Party Sharing */}
                <Typography variant="h6" gutterBottom>{t('privacy.s7Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s7Body')}</Typography>

                {/* Section 8: Data Security */}
                <Typography variant="h6" gutterBottom>{t('privacy.s8Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s8Body')}</Typography>

                {/* Section 9: Contact */}
                <Typography variant="h6" gutterBottom>{t('privacy.s9Title')}</Typography>
                <Typography variant="body2" paragraph>{t('privacy.s9Body')}</Typography>
            </Paper>
        </Box>
    )
}
