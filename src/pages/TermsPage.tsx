import { Box, Typography, Paper } from '@mui/material'

export default function TermsPage() {
    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>Terms of Service</Typography>
                <Typography variant="body1" paragraph>
                    Last updated: April 2026
                </Typography>
                <Typography variant="h6" gutterBottom>1. Acceptance of Terms</Typography>
                <Typography variant="body2" paragraph>
                    By accessing and using the FIVUCSAS Identity Verification Platform, you agree to be bound by these Terms of Service.
                </Typography>
                <Typography variant="h6" gutterBottom>2. Service Description</Typography>
                <Typography variant="body2" paragraph>
                    FIVUCSAS provides biometric identity verification services including face recognition, voice authentication, fingerprint verification, and document scanning capabilities.
                </Typography>
                <Typography variant="h6" gutterBottom>3. User Data</Typography>
                <Typography variant="body2" paragraph>
                    Biometric data is processed in accordance with KVKK (Turkish Data Protection Law) and GDPR regulations. Your biometric templates are encrypted and stored securely.
                </Typography>
                <Typography variant="h6" gutterBottom>4. User Responsibilities</Typography>
                <Typography variant="body2" paragraph>
                    Users are responsible for maintaining the security of their account credentials and enrolled biometric data.
                </Typography>
                <Typography variant="h6" gutterBottom>5. Contact</Typography>
                <Typography variant="body2" paragraph>
                    For questions about these terms, contact: bilgisayar@marmara.edu.tr
                </Typography>
            </Paper>
        </Box>
    )
}
