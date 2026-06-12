/**
 * loginBackground — shared sx builders for the dashboard (app.fivucsas) auth
 * surfaces' full-screen glass shell.
 *
 * WHY THIS EXISTS (perf): the dashboard login + MFA shells used to paint the
 * brand gradient with a `gradientShift` keyframe animation — a `400% 400%`
 * background-size whose `background-position` was animated indefinitely. Animating
 * background-position cannot be GPU-composited; it forces a full-viewport REPAINT
 * every frame, on EVERY login screen (identifier / password / MFA), and with
 * browser hardware-acceleration OFF that paint lands on the main thread. Layered
 * with the floating-orb `backdrop-filter` animations and the glass card blur, that
 * was the entire reason app.fivucsas login felt laggy while verify.fivucsas — whose
 * shell uses a STATIC radial gradient with no continuous animation — stayed smooth.
 * (It was never WebGPU; both surfaces share the same WASM/MediaPipe face pipeline.)
 *
 * Fix: the dashboard shell now renders a STATIC brand gradient for everyone — same
 * colours/stops, no infinite pan — so there is no per-frame background repaint. This
 * also brings app.fivucsas to visual+behavioural parity with verify.fivucsas. The
 * change is purely presentational and reversible (restore the `gradientShift`
 * animation here to get the old behaviour back).
 */
import type { SxProps, Theme } from '@mui/material'

/** The brand gradient stops, shared by every dashboard auth shell. */
const BRAND_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)'

/**
 * Full-screen background sx for the dashboard auth shell: a STATIC brand gradient.
 *
 * Intentionally has no `gradientShift`/`backgroundSize` animation — the continuous
 * pan was the dominant cause of the login-page jank (full-viewport repaint per
 * frame, worst with hardware-acceleration off). verify.fivucsas is smooth for the
 * same reason: a static gradient.
 */
export function loginShellBackgroundSx(): SxProps<Theme> {
    return { background: BRAND_GRADIENT }
}

/**
 * `backdrop-filter` value for the glass card.
 *
 * Over the now-STATIC shell gradient the 20px glass blur is composited once and is
 * cheap, so off-camera screens keep the original glassmorphism. It is dropped while
 * `quiet` (the live FACE/PUZZLE camera step, or `prefers-reduced-motion`): there the
 * card can sit over changing content and dropping the blur frees main-thread budget
 * for the MediaPipe capture loop.
 */
export function glassCardBackdropFilter(quiet: boolean): string | undefined {
    return quiet ? undefined : 'blur(20px)'
}
