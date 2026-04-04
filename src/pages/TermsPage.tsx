import { Box, Typography, Paper } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function TermsPage() {
    const { t } = useTranslation()

    const sections = [
        { title: t('terms.s1Title'), body: t('terms.s1Body') },
        { title: t('terms.s2Title'), body: t('terms.s2Body') },
        { title: t('terms.s3Title'), body: t('terms.s3Body') },
        { title: t('terms.s4Title'), body: t('terms.s4Body') },
        { title: t('terms.s5Title'), body: t('terms.s5Body') },
        { title: t('terms.s6Title'), body: t('terms.s6Body') },
        { title: t('terms.s7Title'), body: t('terms.s7Body') },
        { title: t('terms.s8Title'), body: t('terms.s8Body') },
        { title: t('terms.s9Title'), body: t('terms.s9Body') },
        { title: t('terms.s10Title'), body: t('terms.s10Body') },
    ]

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>{t('terms.title')}</Typography>
                <Typography variant="body1" paragraph color="text.secondary">
                    {t('terms.lastUpdated')}
                </Typography>
                {sections.map((s, i) => (
                    <Box key={i} sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>{s.title}</Typography>
                        <Typography variant="body2" paragraph>{s.body}</Typography>
                    </Box>
                ))}
            </Paper>
        </Box>
    )
}
