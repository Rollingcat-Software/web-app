import { motion, Variants } from 'framer-motion'
import { ReactNode } from 'react'

interface PageTransitionProps {
    children: ReactNode
}

const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 20,
    },
    enter: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
            when: 'beforeChildren',
            staggerChildren: 0.1,
        },
    },
    exit: {
        opacity: 0,
        y: -10,
        transition: {
            duration: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        },
    },
}

export function PageTransition({ children }: PageTransitionProps) {
    return (
        <motion.div
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
        >
            {children}
        </motion.div>
    )
}

// Staggered children animation
export const staggerContainer: Variants = {
    initial: {},
    enter: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
}

export const fadeInUp: Variants = {
    initial: {
        opacity: 0,
        y: 30,
    },
    enter: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        },
    },
}

export const fadeIn: Variants = {
    initial: {
        opacity: 0,
    },
    enter: {
        opacity: 1,
        transition: {
            duration: 0.4,
        },
    },
}

export const scaleIn: Variants = {
    initial: {
        opacity: 0,
        scale: 0.9,
    },
    enter: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        },
    },
}

export const slideInLeft: Variants = {
    initial: {
        opacity: 0,
        x: -30,
    },
    enter: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        },
    },
}

export const slideInRight: Variants = {
    initial: {
        opacity: 0,
        x: 30,
    },
    enter: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        },
    },
}
