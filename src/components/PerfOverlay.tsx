/**
 * PerfOverlay — Developer performance metrics overlay.
 *
 * Renders a semi-transparent panel in the top-right corner showing
 * real-time FPS and per-operation latency statistics.
 *
 * Only visible when ?debug (or ?debug=perf) is present in the URL —
 * zero production overhead because the component returns null otherwise.
 *
 * Color coding (mirrors demo_local_fast.py thresholds):
 *   Green  < 30 ms
 *   Yellow 30-60 ms
 *   Orange 60-100 ms
 *   Red    > 100 ms
 */

import type { PerformanceMetrics } from '../hooks/usePerformanceMetrics'

interface PerfOverlayProps {
  metrics: PerformanceMetrics
  enabled: boolean
}

function latencyColor(ms: number): string {
  if (ms < 30) return '#4ade80'   // green
  if (ms < 60) return '#facc15'   // yellow
  if (ms < 100) return '#fb923c'  // orange
  return '#f87171'                 // red
}

export function PerfOverlay({ metrics, enabled }: PerfOverlayProps) {
  if (!enabled) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        background: 'rgba(0, 0, 0, 0.78)',
        color: '#fff',
        fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", monospace',
        fontSize: 11,
        padding: '8px 10px',
        borderRadius: 6,
        zIndex: 9999,
        minWidth: 200,
        lineHeight: 1.65,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: '#94a3b8',
          fontSize: 9,
          marginBottom: 4,
          textTransform: 'uppercase',
        }}
      >
        FIVUCSAS perf
      </div>

      {/* FPS row */}
      <div style={{ color: metrics.fps >= 15 ? '#4ade80' : '#f87171', fontWeight: 700, marginBottom: 4 }}>
        FPS: {metrics.fps}
      </div>

      {/* Divider */}
      {Object.keys(metrics.operations).length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }} />
      )}

      {/* Per-operation rows */}
      {Object.entries(metrics.operations).map(([name, m]) => (
        <div
          key={name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <span style={{ color: '#94a3b8' }}>{name}</span>
          <span>
            <span style={{ color: latencyColor(m.avg) }}>{m.avg}ms</span>
            {' '}
            <span style={{ color: '#475569', fontSize: 10 }}>
              p95:{m.p95} n:{m.samples}
            </span>
          </span>
        </div>
      ))}

      {Object.keys(metrics.operations).length === 0 && (
        <div style={{ color: '#475569' }}>Waiting for data...</div>
      )}
    </div>
  )
}
