/**
 * Pure helpers extracted from SessionsSection.tsx so the component file
 * is component-only (react-refresh).
 */

import type { UserSessionResponse } from '@core/repositories/AuthSessionRepository'

/** Cap on how many deduped rows we render. */
export const SESSIONS_DISPLAY_CAP = 10

/**
 * Dedupe the session list by (ipAddress + userAgent). Today's Marmara-admin
 * console shows 14+ near-duplicate rows because every refresh-token mint
 * creates a new session row; the user sees noise. We collapse duplicates to
 * the most recently active row, preserve `isCurrent` if any duplicate is
 * the current session, and cap the total list at SESSIONS_DISPLAY_CAP.
 *
 * Exported so the unit test can assert the dedupe logic without rendering.
 */
export function dedupeSessions(
    sessions: readonly UserSessionResponse[],
): UserSessionResponse[] {
    const byKey = new Map<string, UserSessionResponse>()
    for (const s of sessions) {
        const key = `${s.ipAddress || '-'}|${s.userAgent || s.deviceInfo || '-'}`
        const existing = byKey.get(key)
        if (!existing) {
            byKey.set(key, s)
            continue
        }
        // Keep the row with the most recent createdAt; if any duplicate is
        // the current session, ensure the merged entry flags isCurrent.
        const existingMs = Date.parse(existing.createdAt) || 0
        const candidateMs = Date.parse(s.createdAt) || 0
        const winner = candidateMs > existingMs ? s : existing
        byKey.set(key, {
            ...winner,
            isCurrent: existing.isCurrent || s.isCurrent,
        })
    }

    // Sort with current session first, then newest first.
    return Array.from(byKey.values())
        .sort((a, b) => {
            if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
            return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
        })
        .slice(0, SESSIONS_DISPLAY_CAP)
}
