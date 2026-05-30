/**
 * Tests for HeadPoseEstimator — real Euler decomposition from the MediaPipe
 * 4x4 facial transformation matrix (column-major), plus the landmark fallback.
 *
 * Sign convention under test (see HeadPoseEstimator class doc):
 *   yaw   < 0 → head turned to the user's left
 *   pitch < 0 → looking up / chin up
 *   roll  < 0 → head tilted toward the user's left shoulder
 */

import { describe, it, expect } from 'vitest'
import { HeadPoseEstimator } from '../HeadPoseEstimator'
import type { PixelLandmark } from '../../types'

/**
 * Build a 16-element COLUMN-MAJOR 4x4 matrix from a 3x3 rotation given as
 * rows. m[col*4 + row]. Translation is zero, bottom-right is 1.
 */
function colMajorFromRotationRows(
  r: [[number, number, number], [number, number, number], [number, number, number]],
): number[] {
  const m = new Array<number>(16).fill(0)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      m[col * 4 + row] = r[row][col]
    }
  }
  m[15] = 1
  return m
}

const DEG = Math.PI / 180

/** Rotation about Y axis (yaw) by angle a (radians). */
function rotY(a: number): [[number, number, number], [number, number, number], [number, number, number]] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ]
}

/** Rotation about X axis (pitch). */
function rotX(a: number): [[number, number, number], [number, number, number], [number, number, number]] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}

/** Rotation about Z axis (roll). */
function rotZ(a: number): [[number, number, number], [number, number, number], [number, number, number]] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ]
}

describe('HeadPoseEstimator — matrix → Euler', () => {
  const est = new HeadPoseEstimator()

  it('identity matrix → level head (all angles ~0)', () => {
    const m = colMajorFromRotationRows([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    const pose = est.estimateFromMatrix(m)
    expect(Math.abs(pose.yaw)).toBeLessThan(1)
    expect(Math.abs(pose.pitch)).toBeLessThan(1)
    expect(Math.abs(pose.roll ?? 0)).toBeLessThan(1)
  })

  it('pure yaw rotation produces yaw and ~0 pitch/roll', () => {
    const m = colMajorFromRotationRows(rotY(25 * DEG))
    const pose = est.estimateFromMatrix(m)
    // Magnitude ~25°, pitch/roll near zero.
    expect(Math.abs(pose.yaw)).toBeGreaterThan(20)
    expect(Math.abs(pose.yaw)).toBeLessThan(30)
    expect(Math.abs(pose.pitch)).toBeLessThan(3)
    expect(Math.abs(pose.roll ?? 0)).toBeLessThan(3)
  })

  it('opposite yaw rotations produce opposite-sign yaw', () => {
    const left = est.estimateFromMatrix(colMajorFromRotationRows(rotY(20 * DEG)))
    const right = est.estimateFromMatrix(colMajorFromRotationRows(rotY(-20 * DEG)))
    expect(Math.sign(left.yaw)).toBe(-Math.sign(right.yaw))
    expect(Math.abs(left.yaw)).toBeGreaterThan(15)
    expect(Math.abs(right.yaw)).toBeGreaterThan(15)
  })

  it('pure pitch rotation produces pitch and ~0 yaw/roll', () => {
    const m = colMajorFromRotationRows(rotX(15 * DEG))
    const pose = est.estimateFromMatrix(m)
    expect(Math.abs(pose.pitch)).toBeGreaterThan(10)
    expect(Math.abs(pose.pitch)).toBeLessThan(20)
    expect(Math.abs(pose.yaw)).toBeLessThan(3)
  })

  it('pure roll rotation produces roll and ~0 yaw/pitch', () => {
    const m = colMajorFromRotationRows(rotZ(18 * DEG))
    const pose = est.estimateFromMatrix(m)
    expect(Math.abs(pose.roll ?? 0)).toBeGreaterThan(13)
    expect(Math.abs(pose.roll ?? 0)).toBeLessThan(23)
    expect(Math.abs(pose.yaw)).toBeLessThan(3)
    expect(Math.abs(pose.pitch)).toBeLessThan(3)
  })

  it('estimate() prefers the matrix over landmarks when supplied', () => {
    const m = colMajorFromRotationRows(rotY(30 * DEG))
    // Landmarks that would yield a different (wrong) yaw if used.
    const landmarks: PixelLandmark[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }))
    const pose = est.estimate(landmarks, { width: 640, height: 480 }, m)
    expect(Math.abs(pose.yaw)).toBeGreaterThan(20)
  })

  it('falls back to landmark ratios when no matrix is given', () => {
    // Build minimal landmarks where the nose is offset to the side.
    const landmarks: PixelLandmark[] = Array.from({ length: 478 }, () => ({ x: 320, y: 240 }))
    // nose tip (index 1) shifted right of the eye centre.
    landmarks[1] = { x: 360, y: 240 }
    landmarks[33] = { x: 280, y: 230 } // left eye outer
    landmarks[263] = { x: 360, y: 230 } // right eye outer
    landmarks[61] = { x: 290, y: 300 } // mouth left
    landmarks[291] = { x: 350, y: 300 } // mouth right
    const pose = est.estimate(landmarks, { width: 640, height: 480 })
    // Should produce a finite yaw without throwing.
    expect(Number.isFinite(pose.yaw)).toBe(true)
    expect(Number.isFinite(pose.pitch)).toBe(true)
  })

  it('returns zeros for a degenerate matrix', () => {
    const pose = est.estimateFromMatrix([0, 0, 0])
    expect(pose).toEqual({ yaw: 0, pitch: 0, roll: 0 })
  })
})
