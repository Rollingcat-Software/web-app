import { useEffect, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { ITokenService, JwtPayload } from '@domain/interfaces/ITokenService'

export interface SessionCountdown {
    /** Seconds remaining until the access token expires (0 when expired/unknown). */
    secondsRemaining: number
    /** `mm:ss` formatted remaining time, or null when unknown. */
    formatted: string | null
    /** True when under the warning threshold (default 2 minutes). */
    warning: boolean
}

const WARNING_THRESHOLD_SECONDS = 120

/**
 * Live countdown of the current access-token lifetime.
 *
 * Decodes the JWT `exp` from the cached access token and ticks once a second.
 * Lightweight by design: a single setInterval that clears on unmount and
 * re-reads the token each tick (cheap, in-memory cached by TokenService) so
 * the display stays correct across silent token refreshes.
 */
export function useSessionCountdown(): SessionCountdown {
    const tokenService = useService<ITokenService>(TYPES.TokenService)
    const [secondsRemaining, setSecondsRemaining] = useState(0)

    useEffect(() => {
        let cancelled = false

        const tick = async () => {
            try {
                const token = await tokenService.getAccessToken()
                if (cancelled) return
                if (!token) {
                    setSecondsRemaining(0)
                    return
                }
                const { exp } = jwtDecode<JwtPayload>(token)
                const remaining = Math.max(0, Math.floor(exp - Date.now() / 1000))
                setSecondsRemaining(remaining)
            } catch {
                if (!cancelled) setSecondsRemaining(0)
            }
        }

        tick()
        const interval = setInterval(tick, 1000)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [tokenService])

    const formatted =
        secondsRemaining > 0
            ? `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`
            : null

    return {
        secondsRemaining,
        formatted,
        warning: secondsRemaining > 0 && secondsRemaining <= WARNING_THRESHOLD_SECONDS,
    }
}
