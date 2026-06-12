import { motion } from 'framer-motion'

/**
 * FloatingShape — the shared decorative background orb for every auth shell
 * (dashboard login + register + MFA + the standalone auth pages).
 *
 * ONE-SHOT fade/scale-in only (no `repeat: Infinity`) with a soft radial fill
 * instead of an animated `backdrop-filter: blur`. The previous orb ran an
 * INFINITE framer-motion loop AND re-blurred its backdrop every frame, which —
 * layered over the (now removed) animated shell gradient — was a continuous
 * main-thread compositing cost (worst with hardware-acceleration off) that
 * contributed to the auth-page jank. After the entrance transition this orb is
 * fully static, so it adds zero per-frame work while staying as brand
 * decoration. See loginBackground.ts for the matching static-gradient fix.
 *
 * Callers gate the orbs behind `!usePrefersReducedMotion()` so users who ask
 * for reduced motion get no decorative chrome at all.
 */
const FloatingShape = ({ delay, size, left, top }: {
    delay: number
    size: number
    left: string
    top: string
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.28, scale: 1 }}
        transition={{
            duration: 1.2,
            delay,
            ease: 'easeOut',
        }}
        style={{
            position: 'absolute',
            left,
            top,
            width: size,
            height: size,
            borderRadius: '50%',
            background:
                'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 60%, rgba(255,255,255,0) 100%)',
        }}
    />
)

export default FloatingShape
