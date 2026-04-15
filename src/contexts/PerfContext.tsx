/**
 * PerfContext — Application-wide performance profiling context.
 *
 * Wrap the app with <PerfProvider> to expose usePerf() to any component.
 * The <PerfOverlay> is rendered as a sibling to children so it floats
 * above all content without affecting layout.
 *
 * Active only when ?debug is present in the URL — no-ops otherwise.
 */

import React, { createContext, useContext } from 'react'
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics'
import { PerfOverlay } from '../components/PerfOverlay'

type PerfContextValue = ReturnType<typeof usePerformanceMetrics>

const PerfContext = createContext<PerfContextValue | null>(null)

export function PerfProvider({ children }: { children: React.ReactNode }) {
  const perf = usePerformanceMetrics()

  return (
    <PerfContext.Provider value={perf}>
      {children}
      <PerfOverlay metrics={perf.metrics} enabled={perf.enabled} />
    </PerfContext.Provider>
  )
}

/**
 * Returns the performance profiler instance from context.
 *
 * When ?debug is absent all methods are no-ops and `enabled` is false,
 * so callers can unconditionally call recordOperation / recordFrame
 * without adding any production overhead.
 */
const NOOP_PERF: PerfContextValue = {
  enabled: false,
  metrics: { fps: 0, operations: {} },
  recordFrame: () => {},
  recordOperation: () => {},
  timeOperation: <T,>(_name: string, fn: () => T) => fn(),
}

export function usePerf(): PerfContextValue {
  return useContext(PerfContext) ?? NOOP_PERF
}
