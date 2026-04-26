/**
 * PerfContext — Application-wide performance profiling context.
 *
 * Wrap the app with <PerfProvider> to expose usePerf() to any component.
 * The <PerfOverlay> is rendered as a sibling to children so it floats
 * above all content without affecting layout.
 *
 * Active only when ?debug is present in the URL — no-ops otherwise.
 *
 * NOTE: The `usePerf` hook + the React context object live in
 * `PerfContextHook.ts` so react-refresh can detect this file as
 * component-only.
 */

import React from 'react'
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics'
import { PerfOverlay } from '../components/PerfOverlay'
import { PerfContext } from './PerfContextHook'

export function PerfProvider({ children }: { children: React.ReactNode }) {
    const perf = usePerformanceMetrics()

    return (
        <PerfContext.Provider value={perf}>
            {children}
            <PerfOverlay metrics={perf.metrics} enabled={perf.enabled} />
        </PerfContext.Provider>
    )
}
