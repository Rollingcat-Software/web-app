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

/**
 * SIGN from REAL geometry (not magnitudes only). The matrices + landmarks below
 * were captured 2026-11-01 in headless Chromium (MediaPipe tasks-vision 0.10.32,
 * FaceLandmarker VIDEO mode with outputFacialTransformationMatrixes, a fake
 * camera fed with a real Mixkit clip — the same pipeline as FaceDetector.ts).
 * What the person physically did was checked on the video frames and agrees
 * with biometric-processor's landmark (Kabsch) pose. The raw camera frame is
 * NOT mirrored, so a user turning to their own right points the nose toward the
 * image LEFT. Before the 2026-11-01 fix both cases below read with the wrong
 * sign (yaw −38.8°, pitch +26.0°).
 */
const REAL = {
  // user turned to their OWN RIGHT (nose toward the IMAGE LEFT of the raw frame); browser read yawM=-38.8 pitchM=17.8 BEFORE the fix
  turned_to_users_right: {
    matrix: [0.77899, 0.0163761, 0.626822, 0, 0.171964, 0.955751, -0.238679, 0, -0.602995, 0.29372, 0.741705, 0, 1.92477, 17.4746, -67.9545, 1],
    landmarks: { 1: { x: 0.43483, y: 0.26514 }, 33: { x: 0.43589, y: 0.24799 }, 61: { x: 0.43247, y: 0.32161 }, 263: { x: 0.58395, y: 0.22987 }, 291: { x: 0.51904, y: 0.31573 } } as Record<number, { x: number; y: number }>,
    frame: { width: 720, height: 1280 },
  },
  // user tilted the chin UP (nose moved up toward the eye line); browser read yawM=17.8 pitchM=26.0 BEFORE the fix
  looking_up: {
    matrix: [0.95182, 0.0196318, -0.30603, 0, -0.152744, 0.895698, -0.417607, 0, 0.265912, 0.444231, 0.855541, 0, -2.91966, 16.9588, -61.3099, 1],
    landmarks: { 1: { x: 0.48637, y: 0.22174 }, 33: { x: 0.33860, y: 0.20779 }, 61: { x: 0.40520, y: 0.29097 }, 263: { x: 0.53781, y: 0.21197 }, 291: { x: 0.52735, y: 0.29196 } } as Record<number, { x: number; y: number }>,
    frame: { width: 720, height: 1280 },
  },
}

function pixels(lms: Record<number, { x: number; y: number }>, frame: { width: number; height: number }): PixelLandmark[] {
  const out: PixelLandmark[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }))
  for (const [k, v] of Object.entries(lms)) out[Number(k)] = { x: v.x * frame.width, y: v.y * frame.height }
  return out
}

describe('HeadPoseEstimator — sign from real browser geometry', () => {
  const est = new HeadPoseEstimator()

  it("matrix path: turning to the user's own RIGHT gives yaw > 0 (TURN_RIGHT)", () => {
    const pose = est.estimateFromMatrix(REAL.turned_to_users_right.matrix)
    expect(pose.yaw).toBeGreaterThan(25)
  })

  it('matrix path: chin up gives pitch < 0 (LOOK_UP)', () => {
    const pose = est.estimateFromMatrix(REAL.looking_up.matrix)
    expect(pose.pitch).toBeLessThan(-15)
  })

  it('landmark fallback agrees with the matrix path on the yaw and pitch sign', () => {
    const right = REAL.turned_to_users_right
    const up = REAL.looking_up
    const poseR = est.estimate(pixels(right.landmarks, right.frame), right.frame)
    const poseU = est.estimate(pixels(up.landmarks, up.frame), up.frame)
    expect(poseR.yaw).toBeGreaterThan(15)
    expect(poseU.pitch).toBeLessThan(-10)
    expect(Math.sign(poseR.yaw)).toBe(Math.sign(est.estimateFromMatrix(right.matrix).yaw))
    expect(Math.sign(poseU.pitch)).toBe(Math.sign(est.estimateFromMatrix(up.matrix).pitch))
  })

  it('nose toward the IMAGE RIGHT of the raw frame = user turned to their own LEFT (yaw < 0)', () => {
    const lms: PixelLandmark[] = Array.from({ length: 478 }, () => ({ x: 320, y: 240 }))
    lms[1] = { x: 360, y: 255 }
    lms[33] = { x: 280, y: 230 }
    lms[263] = { x: 360, y: 230 }
    lms[61] = { x: 290, y: 300 }
    lms[291] = { x: 350, y: 300 }
    expect(est.estimate(lms, { width: 640, height: 480 }).yaw).toBeLessThan(-10)
  })
})
