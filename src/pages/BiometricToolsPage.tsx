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
        <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, sm: 3 } }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
                Biometric Tools
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Search, detect, and verify using biometric data
            </Typography>
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab icon={<Face />} label="Face Search" iconPosition="start" />
                <Tab icon={<RecordVoiceOver />} label="Voice Search" iconPosition="start" />
                <Tab icon={<CreditCard />} label="Card Detection" iconPosition="start" />
                <Tab icon={<Contactless />} label="NFC Scanner" iconPosition="start" />
            </Tabs>
            {tab === 0 && <FaceSearchPage />}
            {tab === 1 && <VoiceSearchPage />}
            {tab === 2 && <CardDetectionPage />}
            {tab === 3 && <NfcEnrollmentPage />}
        </Box>
    )
}
