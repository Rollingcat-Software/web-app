import { motion } from 'framer-motion'
import { Card, CardProps } from '@mui/material'
import { ReactNode } from 'react'

interface AnimatedCardProps extends Omit<CardProps, 'ref'> {
    children: ReactNode
    delay?: number
    hover?: boolean
}

export function AnimatedCard({
    children,
    delay = 0,
    hover = true,
    ...props
}: AnimatedCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
            }}
            whileHover={hover ? {
                y: -4,
                transition: { duration: 0.2 },
            } : undefined}
        >
            <Card {...props}>
                {children}
            </Card>
        </motion.div>
    )
}

// Animated stat card with number counting
interface AnimatedStatProps {
    value: number
}

export function AnimatedNumber({ value }: AnimatedStatProps) {
    return (
        <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {value.toLocaleString()}
        </motion.span>
    )
}
