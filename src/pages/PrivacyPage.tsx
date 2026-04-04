import { Box, Typography, Paper } from '@mui/material'

export default function PrivacyPage() {
    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>Privacy Policy</Typography>
                <Typography variant="body1" paragraph>
                    Last updated: April 2026
                </Typography>
                <Typography variant="h6" gutterBottom>1. Data Collection</Typography>
                <Typography variant="body2" paragraph>
                    FIVUCSAS collects biometric data (face embeddings, voice prints, fingerprint templates) and personal information (name, email, phone number) necessary for identity verification services.
                </Typography>
                <Typography variant="h6" gutterBottom>2. KVKK Compliance</Typography>
                <Typography variant="body2" paragraph>
                    All personal and biometric data is processed in accordance with the Turkish Personal Data Protection Law (KVKK, Law No. 6698). Biometric data is classified as sensitive personal data and is processed only with explicit consent.
                </Typography>
                <Typography variant="h6" gutterBottom>3. Data Security</Typography>
                <Typography variant="body2" paragraph>
                    Biometric templates are encrypted using AES-256 encryption at rest. All data transmission uses TLS 1.3. Face and voice embeddings are stored as mathematical vectors and cannot be reverse-engineered into original biometric samples.
                </Typography>
                <Typography variant="h6" gutterBottom>4. Data Retention</Typography>
                <Typography variant="body2" paragraph>
                    Biometric enrollment data is retained for the duration of the user's active account. Upon account deletion, all biometric templates are permanently erased within 30 days.
                </Typography>
                <Typography variant="h6" gutterBottom>5. User Rights</Typography>
                <Typography variant="body2" paragraph>
                    Under KVKK and GDPR, you have the right to: access your personal data, request correction of inaccurate data, request deletion of your data, withdraw consent for biometric processing, and request data portability.
                </Typography>
                <Typography variant="h6" gutterBottom>6. Third-Party Sharing</Typography>
                <Typography variant="body2" paragraph>
                    Biometric data is never shared with third parties. Personal data may be shared with tenant organizations only as required for identity verification services.
                </Typography>
                <Typography variant="h6" gutterBottom>7. Contact</Typography>
                <Typography variant="body2" paragraph>
                    For privacy-related inquiries or to exercise your data rights, contact the Data Protection Officer at: bilgisayar@marmara.edu.tr
                </Typography>
            </Paper>
        </Box>
    )
}
