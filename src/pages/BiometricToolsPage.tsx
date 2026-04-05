import { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { Face, RecordVoiceOver, CreditCard, Contactless } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import FaceSearchPage from './FaceSearchPage'
import VoiceSearchPage from './VoiceSearchPage'
import CardDetectionPage from './CardDetectionPage'
import NfcEnrollmentPage from './NfcEnrollmentPage'

export default function BiometricToolsPage() {
    const [tab, setTab] = useState(0)
    const { t } = useTranslation()

    return (
        <Box sx={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', px: { xs: 0, sm: 1 }, boxSizing: 'border-box' }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5, px: { xs: 2, sm: 0 }, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {t('biometricTools.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, px: { xs: 2, sm: 0 }, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {t('biometricTools.subtitle')}
            </Typography>
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 1, fontSize: '0.8rem' } }}
            >
                <Tab icon={<Face sx={{ fontSize: 18 }} />} label={t('biometricTools.faceTab')} iconPosition="start" />
                <Tab icon={<RecordVoiceOver sx={{ fontSize: 18 }} />} label={t('biometricTools.voiceTab')} iconPosition="start" />
                <Tab icon={<CreditCard sx={{ fontSize: 18 }} />} label={t('biometricTools.cardTab')} iconPosition="start" />
                <Tab icon={<Contactless sx={{ fontSize: 18 }} />} label={t('biometricTools.nfcTab')} iconPosition="start" />
            </Tabs>
            <Box sx={{ overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box', '& > div': { maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' } }}>
                {tab === 0 && <FaceSearchPage />}
                {tab === 1 && <VoiceSearchPage />}
                {tab === 2 && <CardDetectionPage />}
                {tab === 3 && <NfcEnrollmentPage />}
            </Box>
        </Box>
    )
}
