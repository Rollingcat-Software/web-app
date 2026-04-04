import { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { Face, RecordVoiceOver, CreditCard, Contactless } from '@mui/icons-material'
import FaceSearchPage from './FaceSearchPage'
import VoiceSearchPage from './VoiceSearchPage'
import CardDetectionPage from './CardDetectionPage'
import NfcEnrollmentPage from './NfcEnrollmentPage'

export default function BiometricToolsPage() {
    const [tab, setTab] = useState(0)

    return (
        <Box sx={{ width: '100%', px: { xs: 0, sm: 1 } }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5, px: { xs: 2, sm: 0 } }}>
                Biometric Tools
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, px: { xs: 2, sm: 0 } }}>
                Search, detect, and verify using biometric data
            </Typography>
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 1, fontSize: '0.8rem' } }}
            >
                <Tab icon={<Face sx={{ fontSize: 18 }} />} label="Face" iconPosition="start" />
                <Tab icon={<RecordVoiceOver sx={{ fontSize: 18 }} />} label="Voice" iconPosition="start" />
                <Tab icon={<CreditCard sx={{ fontSize: 18 }} />} label="Card" iconPosition="start" />
                <Tab icon={<Contactless sx={{ fontSize: 18 }} />} label="NFC" iconPosition="start" />
            </Tabs>
            <Box sx={{ overflow: 'hidden', '& *': { maxWidth: '100% !important' }, '& > div > div': { px: '0 !important', py: '0 !important', mx: '0 !important' } }}>
                {tab === 0 && <FaceSearchPage />}
                {tab === 1 && <VoiceSearchPage />}
                {tab === 2 && <CardDetectionPage />}
                {tab === 3 && <NfcEnrollmentPage />}
            </Box>
        </Box>
    )
}
