/**
 * PerfContext hook + context object — split from PerfContext.tsx so that
 * react-refresh can detect the provider file as component-only.
 */

import { createContext, useContext } from 'react'
import type { usePerformanceMetrics } from '../hooks/usePerformanceMetrics'

export type PerfContextValue = ReturnType<typeof usePerformanceMetrics>

export const PerfContext = createContext<PerfContextValue | null>(null)

/**
 * No-op profiler used when no <PerfProvider> wraps the tree (e.g. unit
 * tests or callers that opt-out). Keeps the same shape so consumers can
 * unconditionally call recordFrame / recordOperation without overhead.
 */
const NOOP_PERF: PerfContextValue = {
    enabled: false,
    metrics: { fps: 0, operations: {} },
    recordFrame: () => {},
    recordOperation: () => {},
    timeOperation: <T,>(_name: string, fn: () => T) => fn(),
}

/**
 * Returns the performance profiler instance from context.
 *
 * When ?debug is absent all methods are no-ops and `enabled` is false,
 * so callers can unconditionally call recordOperation / recordFrame
 * without adding any production overhead.
 */
export function usePerf(): PerfContextValue {
    return useContext(PerfContext) ?? NOOP_PERF
}
