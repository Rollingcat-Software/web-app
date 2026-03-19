/**
 * EnrollmentController — Multi-angle enrollment state machine.
 *
 * Manages the enrollment flow: puzzle verification followed by 5-pose face capture.
 * Consumes FrameResult from FrameProcessor — does NOT perform detection itself (SRP).
 *
 * State machine transitions follow the architecture doc Section 7:
 *   IDLE → PUZZLE_ACTIVE → CAPTURE_STRAIGHT → CAPTURE_LEFT → CAPTURE_RIGHT
 *   → CAPTURE_UP → CAPTURE_DOWN → SUBMITTING → COMPLETE
 *
 * Stability tracking ports Python's deque-based approach (lines 1298-1301).
 * Hold-to-capture follows Python's 0.8s hold requirement (line 2212).
 *
 * @see demo_local_fast.py lines 1282-1301 (enrollment state + stability)
 * @see demo_local_fast.py lines 2161-2223 (capture logic)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5c, Section 7
 */

import type {
  BoundingBox,
  EnrollmentCapture,
  EnrollmentPose,
  EnrollmentResult,
  EnrollmentUpdate,
  HeadPose,
  QualityReport,
} from '../types';
import { EnrollmentState, ENROLLMENT_POSES } from '../types';
import {
  STABILITY_THRESHOLD,
  STABILITY_MIN_FRAMES,
  STABILITY_HISTORY_SIZE,
  HOLD_TO_CAPTURE,
  ENROLLMENT_QUALITY_MIN,
} from './constants';

/**
 * Map from EnrollmentState to the corresponding capture state sequence.
 * Used to determine state transitions after a successful capture.
 */
const CAPTURE_STATE_SEQUENCE: EnrollmentState[] = [
  EnrollmentState.CAPTURE_STRAIGHT,
  EnrollmentState.CAPTURE_LEFT,
  EnrollmentState.CAPTURE_RIGHT,
  EnrollmentState.CAPTURE_UP,
  EnrollmentState.CAPTURE_DOWN,
];

/**
 * EnrollmentController manages the two-phase enrollment flow:
 *
 * Phase 1: Active liveness puzzle (delegated to BiometricPuzzle).
 * Phase 2: Multi-angle face capture with stability and quality gates.
 *
 * @see demo_local_fast.py lines 1282-1301 (enrollment init)
 * @see demo_local_fast.py lines 2181-2223 (process_enrollment)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5c, Section 7
 */
export class EnrollmentController {
  /** Current state machine state. */
  private _state: EnrollmentState = EnrollmentState.IDLE;

  /** Captured poses collected during the capture phase. */
  private _captures: EnrollmentCapture[] = [];

  /**
   * Index into CAPTURE_STATE_SEQUENCE / ENROLLMENT_POSES.
   * @see demo_local_fast.py line 1286 (self._enroll_step)
   */
  private currentPoseIdx: number = 0;

  /**
   * Circular buffer of recent face centroid positions for stability tracking.
   * @see demo_local_fast.py lines 1298-1299 (self._face_positions, maxlen=10)
   */
  private positionHistory: Array<{ x: number; y: number }> = [];

  /**
   * Timestamp (seconds) when the hold timer started.
   * Reset whenever pose or stability conditions fail.
   * @see demo_local_fast.py line 1294 (self._hold_start)
   */
  private holdStart: number = 0;

  /** Cached stability flag. @see demo_local_fast.py line 1301 */
  private _isStable: boolean = false;

  /** Cached stability score 0-100. @see demo_local_fast.py line 2176 */
  private _stabilityScore: number = 0;

  // --- Event callbacks ---

  /** Fired when the state machine transitions. */
  onStateChange: ((state: EnrollmentState) => void) | null = null;

  /** Fired when a pose capture completes. */
  onCapture: ((capture: EnrollmentCapture) => void) | null = null;

  /** Fired when all captures are done and ready for submission. */
  onComplete: ((result: EnrollmentResult) => void) | null = null;

  /** Fired on failure (puzzle failed, quality too low, etc.). */
  onFailed: ((reason: string) => void) | null = null;

  /**
   * Start the enrollment flow. Transitions IDLE → PUZZLE_ACTIVE.
   *
   * @see demo_local_fast.py line 1283 (self._enrolling = True)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (IDLE → PUZZLE_ACTIVE)
   */
  start(): void {
    if (this._state !== EnrollmentState.IDLE) return;

    this.reset();
    this.transitionTo(EnrollmentState.PUZZLE_ACTIVE);
  }

  /**
   * Cancel the enrollment from any state. Transitions to IDLE.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (Any → IDLE via cancel)
   */
  cancel(): void {
    this.reset();
    this.transitionTo(EnrollmentState.IDLE);
  }

  /**
   * Called when the liveness puzzle is passed.
   * Transitions PUZZLE_ACTIVE → CAPTURE_STRAIGHT.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (PUZZLE_ACTIVE → CAPTURE_STRAIGHT)
   */
  onPuzzlePassed(): void {
    if (this._state !== EnrollmentState.PUZZLE_ACTIVE) return;

    this.currentPoseIdx = 0;
    this.holdStart = 0;
    this.transitionTo(EnrollmentState.CAPTURE_STRAIGHT);
  }

  /**
   * Called when the liveness puzzle fails or times out.
   * Transitions PUZZLE_ACTIVE → FAILED.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (PUZZLE_ACTIVE → FAILED)
   */
  onPuzzleFailed(): void {
    if (this._state !== EnrollmentState.PUZZLE_ACTIVE) return;

    this.transitionTo(EnrollmentState.FAILED);
    this.onFailed?.('Liveness puzzle failed');
  }

  /**
   * Called each frame during a capture state with current face data.
   * Checks pose alignment, stability, quality, and hold timer.
   * When all conditions are met for HOLD_TO_CAPTURE seconds, performs capture.
   *
   * @param headPose   - Current head pose from HeadPoseEstimator.
   * @param faceBbox   - Current face bounding box for stability tracking.
   * @param quality    - Current quality report from QualityAssessor.
   * @param captureFrame - Async function to capture the current frame as an EnrollmentCapture.
   *
   * @see demo_local_fast.py lines 2181-2223 (process_enrollment)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (Capture Conditions)
   */
  updateCapture(
    headPose: HeadPose,
    faceBbox: BoundingBox,
    quality: QualityReport,
    captureFrame: () => Promise<EnrollmentCapture>,
  ): void {
    // Only process during capture states
    if (!this.isCapturing()) return;

    const pose = this.getCurrentPose();
    if (!pose) return;

    const now = performance.now() / 1000; // seconds

    // --- Track face centroid for stability ---
    // @see demo_local_fast.py lines 2200-2201
    this.pushPosition({
      x: faceBbox.x + faceBbox.width / 2,
      y: faceBbox.y + faceBbox.height / 2,
    });

    // --- Check pose alignment ---
    // @see demo_local_fast.py lines 2196-2198
    const yawOk = Math.abs(headPose.yaw - pose.targetYaw) < pose.tolerance;
    const pitchOk =
      Math.abs(headPose.pitch - pose.targetPitch) < pose.tolerance;

    if (!yawOk || !pitchOk) {
      // Reset hold timer when pose is off
      // @see demo_local_fast.py lines 2203-2205
      this.holdStart = now;
      return;
    }

    // --- Check stability ---
    // @see demo_local_fast.py lines 2207-2210
    this.computeStability();
    if (!this._isStable) {
      this.holdStart = now;
      return;
    }

    // --- Check hold timer ---
    // @see demo_local_fast.py line 2212
    if (this.holdStart === 0) {
      this.holdStart = now;
    }
    if (now - this.holdStart < HOLD_TO_CAPTURE) {
      return;
    }

    // --- Quality gate ---
    // @see demo_local_fast.py line 2223
    if (quality.score < ENROLLMENT_QUALITY_MIN) {
      // Quality too low — keep waiting but don't reset hold
      return;
    }

    // --- Capture! ---
    // Prevent re-entry during async capture
    const captureIdx = this.currentPoseIdx;
    this.holdStart = 0;

    captureFrame()
      .then((capture) => {
        // Guard: state may have changed during async capture
        if (!this.isCapturing() || this.currentPoseIdx !== captureIdx) return;

        this._captures.push(capture);
        this.onCapture?.(capture);

        // Advance to next pose or complete
        this.advanceToNextPose();
      })
      .catch(() => {
        // Capture failed — reset hold so user can retry
        this.holdStart = 0;
      });
  }

  // ===== State Accessors =====

  /** Current enrollment state. */
  getState(): EnrollmentState {
    return this._state;
  }

  /**
   * Current target pose, or null if not in a capture state.
   * @see demo_local_fast.py lines 1287-1293 (self._enroll_poses)
   */
  getCurrentPose(): EnrollmentPose | null {
    if (!this.isCapturing()) return null;
    return ENROLLMENT_POSES[this.currentPoseIdx] ?? null;
  }

  /** All captures collected so far. */
  getCaptures(): EnrollmentCapture[] {
    return [...this._captures];
  }

  /**
   * Whether the face position is currently stable.
   * @see demo_local_fast.py line 2177 (self._is_stable)
   */
  isStable(): boolean {
    return this._isStable;
  }

  /**
   * Hold-to-capture progress as a percentage (0-100).
   * Returns 0 when not in a capture state.
   *
   * @see demo_local_fast.py line 2212 (0.8 second hold)
   */
  getHoldProgress(): number {
    if (!this.isCapturing() || this.holdStart === 0) return 0;

    const now = performance.now() / 1000;
    const elapsed = now - this.holdStart;
    return Math.min(100, (elapsed / HOLD_TO_CAPTURE) * 100);
  }

  /**
   * Get a full enrollment update for UI rendering.
   * Combines all current state into a single object.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (EnrollmentUpdate type)
   */
  getUpdate(headPose: HeadPose | null): EnrollmentUpdate {
    const pose = this.getCurrentPose();
    const yawOk = headPose && pose
      ? Math.abs(headPose.yaw - pose.targetYaw) < pose.tolerance
      : false;
    const pitchOk = headPose && pose
      ? Math.abs(headPose.pitch - pose.targetPitch) < pose.tolerance
      : false;

    let message = '';
    if (this._state === EnrollmentState.PUZZLE_ACTIVE) {
      message = 'Complete the liveness puzzle';
    } else if (this.isCapturing() && pose) {
      if (!yawOk || !pitchOk) {
        message = `Turn your head ${pose.name.toLowerCase()}`;
      } else if (!this._isStable) {
        message = 'Hold still...';
      } else {
        message = 'Capturing...';
      }
    } else if (this._state === EnrollmentState.SUBMITTING) {
      message = 'Submitting enrollment...';
    } else if (this._state === EnrollmentState.COMPLETE) {
      message = 'Enrollment complete!';
    } else if (this._state === EnrollmentState.FAILED) {
      message = 'Enrollment failed';
    }

    return {
      state: this._state,
      yawOk,
      pitchOk,
      isStable: this._isStable,
      stabilityScore: this._stabilityScore,
      holdProgress: this.getHoldProgress(),
      message,
    };
  }

  // ===== Private Helpers =====

  /** Whether the current state is one of the capture states. */
  private isCapturing(): boolean {
    return CAPTURE_STATE_SEQUENCE.includes(this._state);
  }

  /**
   * Transition to the next state and fire callback.
   */
  private transitionTo(newState: EnrollmentState): void {
    this._state = newState;
    this.onStateChange?.(newState);
  }

  /**
   * Advance to the next capture pose, or to SUBMITTING if all done.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (state transition table)
   */
  private advanceToNextPose(): void {
    this.currentPoseIdx++;
    this.positionHistory = [];
    this.holdStart = 0;
    this._isStable = false;

    if (this.currentPoseIdx < CAPTURE_STATE_SEQUENCE.length) {
      // Move to next capture state
      this.transitionTo(CAPTURE_STATE_SEQUENCE[this.currentPoseIdx]);
    } else {
      // All 5 poses captured → submit
      this.transitionTo(EnrollmentState.SUBMITTING);
      this.emitComplete();
    }
  }

  /**
   * Emit the onComplete callback with the collected captures.
   */
  private emitComplete(): void {
    const result: EnrollmentResult = {
      name: '', // Caller sets the name
      captures: [...this._captures],
      puzzlePassed: true,
    };
    this.onComplete?.(result);
  }

  /**
   * Push a face centroid position into the history buffer.
   * Maintains a fixed-size circular buffer (STABILITY_HISTORY_SIZE).
   *
   * @see demo_local_fast.py line 1299 (deque maxlen=10)
   */
  private pushPosition(pos: { x: number; y: number }): void {
    this.positionHistory.push(pos);
    if (this.positionHistory.length > STABILITY_HISTORY_SIZE) {
      this.positionHistory.shift();
    }
  }

  /**
   * Compute face stability from the position history.
   * Stable = max movement across X and Y < STABILITY_THRESHOLD pixels.
   *
   * @see demo_local_fast.py lines 2161-2179 (_check_stability)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (Stability Tracking)
   */
  private computeStability(): void {
    if (this.positionHistory.length < STABILITY_MIN_FRAMES) {
      this._isStable = false;
      this._stabilityScore = 0;
      return;
    }

    const xs = this.positionHistory.map((p) => p.x);
    const ys = this.positionHistory.map((p) => p.y);

    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    const movement = Math.max(xRange, yRange);

    // Stability score: 0-100 (higher = more stable)
    // @see demo_local_fast.py line 2176
    this._stabilityScore = Math.max(
      0,
      Math.min(100, 100 - (movement / STABILITY_THRESHOLD) * 100),
    );
    this._isStable = movement < STABILITY_THRESHOLD;
  }

  /**
   * Reset all internal state to initial values.
   */
  private reset(): void {
    this._captures = [];
    this.currentPoseIdx = 0;
    this.positionHistory = [];
    this.holdStart = 0;
    this._isStable = false;
    this._stabilityScore = 0;
  }
}
