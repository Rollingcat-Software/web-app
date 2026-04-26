/**
 * AuthMethodTaskbar — a compact chip row showing which platforms an auth
 * method supports. Used inside AuthMethodCard and the modal header.
 */
import { Box, Chip } from '@mui/material'
import {
    Android,
    Apple,
    DesktopWindows,
    Language,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { AuthMethodPlatform } from './authMethodRegistry'

const PLATFORM_ICON: Record<AuthMethodPlatform, JSX.Element> = {
    web: <Language fontSize="small" />,
    android: <Android fontSize="small" />,
    ios: <Apple fontSize="small" />,
    desktop: <DesktopWindows fontSize="small" />,
}

const PLATFORM_LABEL_KEY: Record<AuthMethodPlatform, string> = {
    web: 'authMethodsTesting.platforms.web',
    android: 'authMethodsTesting.platforms.android',
    ios: 'authMethodsTesting.platforms.ios',
    desktop: 'authMethodsTesting.platforms.desktop',
}

export interface AuthMethodTaskbarProps {
    platforms: AuthMethodPlatform[]
    /** 'compact' hides labels and only shows icons. */
    variant?: 'default' | 'compact'
}

export default function AuthMethodTaskbar({
    platforms,
    variant = 'default',
}: AuthMethodTaskbarProps) {
    const { t } = useTranslation()

    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                alignItems: 'center',
            }}
            aria-label={t('authMethodsTesting.platformLabel')}
        >
            {platforms.map((platform) => {
                const platformLabel = t(PLATFORM_LABEL_KEY[platform])
                const isCompact = variant === 'compact'
                return (
                    <Chip
                        key={platform}
                        size="small"
                        icon={PLATFORM_ICON[platform]}
                        // In compact mode keep the visible label empty but
                        // expose the platform name to assistive tech via
                        // aria-label so icon-only chips stay accessible.
                        label={isCompact ? '' : platformLabel}
                        aria-label={isCompact ? platformLabel : undefined}
                        variant="outlined"
                        sx={{
                            borderRadius: '8px',
                            fontWeight: 500,
                            fontSize: '0.7rem',
                            ...(isCompact && {
                                '& .MuiChip-label': { display: 'none' },
                                '& .MuiChip-icon': { ml: '8px', mr: '-4px' },
                            }),
                        }}
                    />
                )
            })}
        </Box>
    )
}
