/**
 * useNow — triggers a re-render at a fixed interval so that relative
 * timestamps ("just now", "2 min ago") stay accurate without the parent
 * component having to re-fetch data.
 *
 * Default tick is 60 000 ms (once a minute), which is appropriate for
 * `formatDistanceToNow` / `minutesAgo` / `hoursAgo` granularity.
 */
import { useEffect, useState } from 'react'

export function useNow(intervalMs: number = 60_000): Date {
    const [now, setNow] = useState<Date>(() => new Date())

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])

    return now
}

export default useNow
