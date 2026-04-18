import type { Variants } from 'framer-motion'
import { ANIMATION, EASE_OUT } from '../../constants'

/**
 * Shared framer-motion variants for step bodies.
 *
 * Every refactored step body uses this on motion.div wrappers around
 * individual items so they enter with the same staggered slide-up that
 * StepLayout's root stagger coordinates.
 *
 * Kept in its own module (not re-exported from StepLayout.tsx) so Vite
 * Fast Refresh works correctly — `react-refresh/only-export-components`
 * fails when a component file also exports non-component values.
 */
export const stepItemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: ANIMATION.ITEM_ENTER, ease: EASE_OUT },
    },
}
