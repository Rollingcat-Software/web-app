import { Box, CircularProgress, Typography } from '@mui/material'
import { motion } from 'framer-motion'

interface LoadingAnimationProps {
    message?: string
    size?: 'small' | 'medium' | 'large'
    fullScreen?: boolean
}

const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
}

export function LoadingAnimation({
    message = 'Loading...',
    size = 'medium',
    fullScreen = false,
}: LoadingAnimationProps) {
    const content = (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                }}
            >
                <Box sx={{ position: 'relative' }}>
                    {/* Outer ring */}
                    <CircularProgress
                        size={sizeMap[size]}
                        thickness={2}
                        sx={{
                            color: 'primary.lighter',
                        }}
                        variant="determinate"
                        value={100}
                    />
                    {/* Inner spinning ring */}
                    <CircularProgress
                        size={sizeMap[size]}
                        thickness={2}
                        sx={{
                            position: 'absolute',
                            left: 0,
                            color: 'primary.main',
                            animationDuration: '1.2s',
                        }}
                    />
                </Box>
                {message && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 500 }}
                    >
                        {message}
                    </Typography>
                )}
            </Box>
        </motion.div>
    )

    if (fullScreen) {
        return (
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                }}
            >
                {content}
            </Box>
        )
    }

    return content
}

// Pulse loading dots
export function PulseLoading() {
    return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.15,
                    }}
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#6366f1',
                    }}
                />
            ))}
        </Box>
    )
}

// Skeleton loader with shimmer effect
export function ShimmerSkeleton({
    width = '100%',
    height = 20,
    borderRadius = 8,
}: {
    width?: string | number
    height?: number
    borderRadius?: number
}) {
    return (
        <Box
            sx={{
                width,
                height,
                borderRadius: `${borderRadius}px`,
                background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                '@keyframes shimmer': {
                    '0%': { backgroundPosition: '200% 0' },
                    '100%': { backgroundPosition: '-200% 0' },
                },
            }}
        />
    )
}
