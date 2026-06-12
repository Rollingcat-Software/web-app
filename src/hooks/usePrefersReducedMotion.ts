/**
 * usePrefersReducedMotion — reflects the OS/browser
 * `(prefers-reduced-motion: reduce)` user setting, live.
 *
 * Returns `true` when the user has asked the system to minimize non-essential
 * motion. Components use it to skip decorative, continuously-animating chrome
 * (infinite gradient pans, floating shapes) — both as an accessibility courtesy
 * and, on the login surfaces, as a performance lever: those animations otherwise
 * contend with the camera/MediaPipe rAF loop during the FACE/PUZZLE capture step
 * (worst with browser hardware-acceleration off, where the animated gradient +
 * backdrop-blur composite on the main thread).
 *
 * SSR-safe (defaults to `false` when `window`/`matchMedia` is unavailable) and
 * updates if the preference changes at runtime.
 */
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function readPreference(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false
    }
    return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(readPreference)

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return
        }
        const mql = window.matchMedia(QUERY)
        const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
        // Sync once on mount in case the value changed before the listener attached.
        setPrefersReducedMotion(mql.matches)
        // addEventListener is the modern API; older Safari only has addListener.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', onChange)
            return () => mql.removeEventListener('change', onChange)
        }
        mql.addListener(onChange)
        return () => mql.removeListener(onChange)
    }, [])

    return prefersReducedMotion
}
