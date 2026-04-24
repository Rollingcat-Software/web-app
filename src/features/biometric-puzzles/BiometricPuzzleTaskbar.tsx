import { Box, Chip } from '@mui/material'
import { Computer, PhoneAndroid, PhoneIphone, DesktopMac } from '@mui/icons-material'
import type { BiometricPuzzlePlatform } from './biometricPuzzleRegistry'

const PLATFORM_ICON: Record<
    BiometricPuzzlePlatform,
    React.ComponentType<{ fontSize?: 'inherit' | 'small' | 'medium' | 'large' }>
> = {
    web: Computer,
    android: PhoneAndroid,
    ios: PhoneIphone,
    desktop: DesktopMac,
}

interface Props {
    platforms: ReadonlyArray<BiometricPuzzlePlatform>
}

export default function BiometricPuzzleTaskbar({ platforms }: Props) {
    return (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {platforms.map((p) => {
                const Icon = PLATFORM_ICON[p]
                return (
                    <Chip
                        key={p}
                        icon={<Icon fontSize="small" />}
                        label={p}
                        size="small"
                        variant="outlined"
                        sx={{
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            height: 22,
                            textTransform: 'capitalize',
                        }}
                    />
                )
            })}
        </Box>
    )
}
