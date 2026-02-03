import { Box } from '@mui/material'
import { AuthFlowBuilder } from './AuthFlowBuilder'
import { PageTransition } from '@components/animations'

export default function AuthFlowsPage() {
    const handleSave = (steps: unknown[]) => {
        console.log('Saving flow with steps:', steps)
        // TODO: Implement API call to save flow
    }

    return (
        <PageTransition>
            <Box>
                <AuthFlowBuilder onSave={handleSave} />
            </Box>
        </PageTransition>
    )
}
