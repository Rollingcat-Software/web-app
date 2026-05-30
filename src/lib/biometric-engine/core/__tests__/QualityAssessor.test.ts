/**
 * Tests for QualityAssessor — the blur / size / brightness gate wired into the
 * face enrollment capture flow (useFaceChallenge). These pin the accept/reject
 * decision the enrollment gate relies on.
 */

import { describe, it, expect } from 'vitest'
import { QualityAssessor } from '../QualityAssessor'
import { ENROLLMENT_QUALITY_MIN } from '../constants'
import type { QualityIssue } from '../types'

/**
 * Build an ImageData of `w`×`h`. `fill` paints every pixel a flat gray value
 * (for brightness / "no texture = blurry" cases). `sharp` overlays a
 * high-contrast checkerboard to raise Laplacian variance (sharpness).
 */
function makeImage(w: number, h: number, fill: number, sharp = false): ImageData {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let v = fill
      if (sharp && (x + y) % 2 === 0) v = Math.min(255, fill + 120)
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData
}

describe('QualityAssessor', () => {
  const assessor = new QualityAssessor()

  it('rejects a degenerate (tiny) image', () => {
    const report = assessor.assess(makeImage(2, 2, 128))
    expect(report.score).toBe(0)
    expect(report.issues).toContain('Small' as QualityIssue)
  })

  it('flags a flat, blurry crop as low quality', () => {
    // Flat gray → near-zero Laplacian variance → blur score ~0.
    const report = assessor.assess(makeImage(120, 120, 128, /* sharp */ false))
    expect(report.issues).toContain('Blurry' as QualityIssue)
    expect(report.score).toBeLessThan(ENROLLMENT_QUALITY_MIN)
  })

  it('flags a too-dark crop', () => {
    // Flat very-dark fill keeps the mean below MIN_BRIGHTNESS (50).
    const report = assessor.assess(makeImage(120, 120, 20))
    expect(report.brightnessOk).toBe(false)
    expect(report.issues).toContain('Dark' as QualityIssue)
  })

  it('flags a too-bright crop', () => {
    // Flat near-white fill keeps the mean above MAX_BRIGHTNESS (200).
    const report = assessor.assess(makeImage(120, 120, 240))
    expect(report.brightnessOk).toBe(false)
    expect(report.issues).toContain('Bright' as QualityIssue)
  })

  it('passes a sharp, well-lit, adequately-sized crop', () => {
    // Sharp checkerboard at mid brightness, large enough face → high score.
    const report = assessor.assess(makeImage(160, 160, 110, /* sharp */ true))
    expect(report.brightnessOk).toBe(true)
    expect(report.issues).not.toContain('Blurry' as QualityIssue)
    expect(report.score).toBeGreaterThanOrEqual(ENROLLMENT_QUALITY_MIN)
  })
})
