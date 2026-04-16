/**
 * usePerformanceMetrics — Developer performance profiler.
 *
 * Tracks per-operation latency with 60-sample sliding window.
 * Active only when ?debug is in the URL (e.g. ?debug=perf).
 * Port of demo_local_fast.py Profiler class.
 */

import { useCallback, useRef, useState, useEffect } from 'react'

export interface OperationMetrics {
  avg: number
  min: number
  max: number
  p95: number
  samples: number
}

export interface PerformanceMetrics {
  fps: number
  operations: Record<string, OperationMetrics>
}

const WINDOW_SIZE = 60

function computeMetrics(samples: number[]): OperationMetrics {
  if (samples.length === 0) return { avg: 0, min: 0, max: 0, p95: 0, samples: 0 }
  const sorted = [...samples].sort((a, b) => a - b)
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length
  return {
    avg: Math.round(avg),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]),
    samples: samples.length,
  }
}

export function usePerformanceMetrics() {
  const enabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug')

  const buffers = useRef<Record<string, number[]>>({})
  const frameTimestamps = useRef<number[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics>({ fps: 0, operations: {} })

  /** Record a frame tick — call once per animation frame to compute FPS. */
  const recordFrame = useCallback(() => {
    if (!enabled) return
    const now = performance.now()
    frameTimestamps.current.push(now)
    // Retain only frames from the last 2 seconds
    const cutoff = now - 2000
    frameTimestamps.current = frameTimestamps.current.filter(t => t > cutoff)
  }, [enabled])

  /** Record a single operation's latency in milliseconds. */
  const recordOperation = useCallback((name: string, durationMs: number) => {
    if (!enabled) return
    if (!buffers.current[name]) buffers.current[name] = []
    buffers.current[name].push(durationMs)
    if (buffers.current[name].length > WINDOW_SIZE) {
      buffers.current[name].shift()
    }
  }, [enabled])

  /** Time an async operation and record it automatically. */
  const timeOperation = useCallback(
    async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      if (!enabled) return fn()
      const t0 = performance.now()
      const result = await fn()
      recordOperation(name, performance.now() - t0)
      return result
    },
    [enabled, recordOperation],
  )

  // Refresh display metrics every 500 ms
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      // frames collected in last 2 seconds / 2 = FPS
      const fps = frameTimestamps.current.length / 2
      const operations: Record<string, OperationMetrics> = {}
      for (const [name, samples] of Object.entries(buffers.current)) {
        operations[name] = computeMetrics(samples)
      }
      setMetrics({ fps: Math.round(fps), operations })
    }, 500)
    return () => clearInterval(id)
  }, [enabled])

  return { enabled, metrics, recordFrame, recordOperation, timeOperation }
}
