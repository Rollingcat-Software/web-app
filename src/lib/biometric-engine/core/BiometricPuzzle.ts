/**
 * BiometricPuzzle — Active Liveness Challenge-Response Engine.
 *
 * Uses the Strategy + Registry pattern: each challenge type has its own
 * IChallengeDetector implementation. New challenges are added without modifying
 * this class (Open/Closed Principle).
 *
 * Direct port from demo_local_fast.py lines 451-921 (BiometricPuzzle class).
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5h
 */

import type {
  ChallengeCheckResult,
  ChallengeDefinition,
  ChallengeInfo,
  FaceMetrics,
  HeadPose,
  MotionEntry,
  NormalizedLandmark,
  PuzzleStepResult,
} from '../types';
import { ChallengeType } from '../types';
import type { IBiometricPuzzle, IChallengeDetector, IFaceMetricsCalculator } from '../interfaces';
import {
  HOLD_DURATION,
  HEAD_POSE_EWMA_ALPHA,
  BLINK_EAR_CLOSED,
  EAR_THRESHOLD,
  ATTEMPT_WINDOW_MS,
  ATTEMPT_SAMPLE_INTERVAL_MS,
  POSE_BASELINE_FRAMES,
  EXPRESSION_BASELINE_FRAMES,
  MIN_ATTEMPT_MS,
  MOUTH_OPEN_THRESHOLD,
  PITCH_GESTURE_MAX_ABS_YAW,
  PITCH_GESTURE_MAX_REL_YAW,
} from './constants';
import { LIVENESS_POOL } from './livenessPool';

import {
  BlinkDetector,
  CloseLeftDetector,
  CloseRightDetector,
  SmileDetector,
  OpenMouthDetector,
  TurnLeftDetector,
  TurnRightDetector,
  LookUpDetector,
  LookDownDetector,
  RaiseBothBrowsDetector,
  RaiseLeftBrowDetector,
  RaiseRightBrowDetector,
  NodDetector,
  ShakeHeadDetector,
} from './challenges';

// =============================================================================
// Challenge definitions matching Python CHALLENGES dict
// @see demo_local_fast.py lines 477-492
// =============================================================================

/** @see demo_local_fast.py lines 477-492 */
const CHALLENGE_DEFINITIONS: Record<ChallengeType, ChallengeDefinition> = {
  [ChallengeType.BLINK]: { displayName: 'Close Both Eyes', key: 'blink', icon: '😌' },
  [ChallengeType.CLOSE_LEFT]: { displayName: 'Close YOUR Left Eye', key: 'close_left', icon: '😉' },
  [ChallengeType.CLOSE_RIGHT]: { displayName: 'Close YOUR Right Eye', key: 'close_right', icon: '😉' },
  [ChallengeType.SMILE]: { displayName: 'Smile Wide (Show Teeth)', key: 'smile', icon: '😁' },
  [ChallengeType.OPEN_MOUTH]: { displayName: 'Open Mouth Wide', key: 'open_mouth', icon: '😮' },
  [ChallengeType.TURN_LEFT]: { displayName: 'Turn Head Left', key: 'turn_left', icon: '👈' },
  [ChallengeType.TURN_RIGHT]: { displayName: 'Turn Head Right', key: 'turn_right', icon: '👉' },
  [ChallengeType.LOOK_UP]: { displayName: 'Look Up (Chin Up)', key: 'look_up', icon: '👆' },
  [ChallengeType.LOOK_DOWN]: { displayName: 'Look Down (Chin Down)', key: 'look_down', icon: '👇' },
  [ChallengeType.RAISE_BOTH_BROWS]: { displayName: 'Raise Both Eyebrows', key: 'raise_both', icon: '🤨' },
  [ChallengeType.RAISE_LEFT_BROW]: { displayName: 'Raise YOUR Left Eyebrow', key: 'raise_left', icon: '🤔' },
  [ChallengeType.RAISE_RIGHT_BROW]: { displayName: 'Raise YOUR Right Eyebrow', key: 'raise_right', icon: '🧐' },
  [ChallengeType.NOD]: { displayName: 'Nod Your Head', key: 'nod', icon: '↕️' },
  [ChallengeType.SHAKE_HEAD]: { displayName: 'Shake Your Head', key: 'shake_head', icon: '↔️' },
};

/**
 * Pool the random active-liveness FACE picker draws from.
 *
 * This is the CURATED RELIABLE pool — the single source of truth lives in
 * `livenessPool.ts` (`LIVENESS_POOL`). It deliberately EXCLUDES single-brow
 * raises (RAISE_LEFT_BROW / RAISE_RIGHT_BROW), which ~30-40% of people can't
 * physically perform. The demo's old pool (@see demo_local_fast.py lines
 * 533-539) included them; the redesign drops them from every liveness flow
 * while the library/showcase page still lists them (marked experimental).
 *
 * Note `start(challengeTypes, …)` with an explicit list bypasses this pool
 * entirely, so the per-challenge library puzzles can still exercise an
 * excluded gesture on demand — only the RANDOM flow is curated.
 */
const SIMPLE_CHALLENGE_POOL: readonly ChallengeType[] = LIVENESS_POOL;

/**
 * One equally-sampled entry of the attempt history (see ATTEMPT_* constants).
 * Raw pose (for the baseline), smoothed pose (for the gates / nod / shake) and
 * the raw expression features whose baseline the gates are relative to.
 */
interface AttemptSample {
  t: number;
  yaw: number;
  pitch: number;
  smoothedYaw: number;
  smoothedPitch: number;
  mar: number;
  smileCorner: number;
  browLeft: number;
  browRight: number;
  browAvg: number;
}

/** Unit baseline: makes calculateEyebrowRaise return the raw brow→eye distances. */
const RAW_BROW_BASELINE = { left: 1, right: 1, avg: 1 } as const;

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/**
 * Shuffle an array using Fisher-Yates and return a slice of the requested size.
 */
function randomSample<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * BiometricPuzzle — Active liveness engine with Strategy/Registry pattern.
 *
 * Usage:
 * ```ts
 * const puzzle = new BiometricPuzzle(metricsCalculator, 3);
 * puzzle.registerAllDefaults();
 * puzzle.start();
 *
 * // Per frame:
 * const result = puzzle.checkChallenge(landmarks, yaw, pitch);
 * ```
 *
 * @see demo_local_fast.py lines 451-921
 */
export class BiometricPuzzle implements IBiometricPuzzle {
  // ===== Registry =====
  private detectors: Map<ChallengeType, IChallengeDetector> = new Map();

  // ===== Puzzle State =====
  /** Ordered list of challenges for this puzzle session. */
  private challenges: ChallengeType[] = [];
  /** Current challenge index. @see demo_local_fast.py line 508 */
  private currentIdx = 0;
  /** Whether the puzzle is actively running. @see demo_local_fast.py line 509 */
  private active = false;
  /** Whether the puzzle has finished (pass or stop). @see demo_local_fast.py line 510 */
  private complete = false;
  /** Whether all challenges were passed. @see demo_local_fast.py line 511 */
  private puzzlePassed = false;

  // ===== Hold Timer =====
  /** Continuous detection time in seconds. @see demo_local_fast.py line 515 */
  private holdDuration: number = HOLD_DURATION;
  /** Timestamp when continuous detection started. @see demo_local_fast.py line 514 */
  private holdStart = 0;
  /** Whether the action was detected in the previous frame. @see demo_local_fast.py line 516 */
  private actionDetected = false;

  // ===== Head-pose smoothing (EWMA) + hysteresis =====
  /** EWMA-smoothed yaw, or null until the first frame seeds it. */
  private smoothedYaw: number | null = null;
  /** EWMA-smoothed pitch, or null until the first frame seeds it. */
  private smoothedPitch: number | null = null;
  /**
   * Last accepted detection state for the current challenge — used for
   * release-debounce hysteresis so a single boundary-flicker frame does not
   * reset the hold timer. Counts consecutive "not detected" frames before
   * the gesture is allowed to drop.
   */
  private lostFrames = 0;
  /** Consecutive lost frames required to release a previously-detected gesture. */
  private readonly releaseHysteresisFrames = 2;

  // ===== Attempt history (baseline + nod/shake motion) =====
  /**
   * Rolling, equally-sampled history of the current attempt: the last
   * ATTEMPT_WINDOW_MS sampled every ATTEMPT_SAMPLE_INTERVAL_MS — the same
   * window/sampling as the contract-v2 trace recorder, so the baseline below is
   * taken from (nearly) the same frames biometric-processor takes its baseline
   * from. Gates are evaluated RELATIVE to it (2026-11-01 calibration fix).
   */
  private attempt: AttemptSample[] = [];
  /** Clock time (ms) of the first frame of the current attempt. */
  private attemptStartMs: number | null = null;
  /** Smoothed pose history for nod/shake (derived from `attempt`). */
  private motionHistory: MotionEntry[] = [];

  // ===== Results =====
  /** Per-step results. @see demo_local_fast.py line 523 */
  private results: PuzzleStepResult[] = [];

  // ===== Dependencies =====
  /** Shared metrics calculator (DRY — same instance used by FrameProcessor). */
  private metricsCalculator: IFaceMetricsCalculator;
  /** Default number of challenges per puzzle. @see demo_local_fast.py line 506 */
  private numChallenges: number;

  /**
   * @param metricsCalculator Shared FaceMetricsCalculator instance.
   * @param numChallenges Default number of challenges per puzzle (default: 3).
   * @see demo_local_fast.py line 505
   */
  /** Millisecond clock (injectable for tests). */
  private readonly clock: () => number;

  constructor(
    metricsCalculator: IFaceMetricsCalculator,
    numChallenges = 3,
    clock: () => number = () => performance.now(),
  ) {
    this.metricsCalculator = metricsCalculator;
    this.numChallenges = numChallenges;
    this.clock = clock;
  }

  // ===========================================================================
  // Registry Methods
  // ===========================================================================

  /**
   * Register a single challenge detector.
   * Replaces any existing detector for the same ChallengeType.
   */
  registerDetector(detector: IChallengeDetector): void {
    this.detectors.set(detector.type, detector);
  }

  /**
   * Register all 14 built-in challenge detectors.
   * Call this once after construction for full challenge support.
   * @see demo_local_fast.py lines 477-492 (CHALLENGES dict)
   */
  registerAllDefaults(): void {
    const defaults: IChallengeDetector[] = [
      new BlinkDetector(),
      new CloseLeftDetector(),
      new CloseRightDetector(),
      new SmileDetector(),
      new OpenMouthDetector(),
      new TurnLeftDetector(),
      new TurnRightDetector(),
      new LookUpDetector(),
      new LookDownDetector(),
      new RaiseBothBrowsDetector(),
      new RaiseLeftBrowDetector(),
      new RaiseRightBrowDetector(),
      new NodDetector(),
      new ShakeHeadDetector(),
    ];

    for (const detector of defaults) {
      this.registerDetector(detector);
    }
  }

  // ===========================================================================
  // Control Methods
  // ===========================================================================

  /**
   * Start a new puzzle with random or specified challenges.
   * @param challengeTypes Optional specific challenges to use.
   * @param numChallenges Override number of challenges for this session.
   * @see demo_local_fast.py lines 525-551
   */
  start(challengeTypes?: ChallengeType[], numChallenges?: number): void {
    const count = numChallenges ?? this.numChallenges;

    if (challengeTypes && challengeTypes.length > 0) {
      this.challenges = challengeTypes.slice(0, count);
    } else {
      // Random selection from simple pool (balanced mix, no dynamic by default)
      this.challenges = randomSample(SIMPLE_CHALLENGE_POOL, count);
    }

    this.currentIdx = 0;
    this.active = true;
    this.complete = false;
    this.puzzlePassed = false;
    this.holdStart = 0;
    this.actionDetected = false;
    this.resetAttempt();
    this.results = [];
    this.smoothedYaw = null;
    this.smoothedPitch = null;
    this.lostFrames = 0;

    // Reset any stateful (transient) detectors so a half-finished blink/wink
    // from a previous session can't leak across into this attempt.
    this.resetCurrentDetector();
  }

  /** Clear the attempt history / baseline (new challenge or new attempt). */
  private resetAttempt(): void {
    this.attempt = [];
    this.attemptStartMs = null;
    this.motionHistory = [];
  }

  /**
   * Reset the stateful internal state of the detector for the CURRENT
   * challenge (transition detectors like blink/wink). No-op for stateless ones.
   */
  private resetCurrentDetector(): void {
    const type = this.challenges[this.currentIdx];
    const detector = type ? this.detectors.get(type) : undefined;
    detector?.reset?.();
  }

  /**
   * Whether a transient (blink/wink) challenge is currently in its CLOSE phase
   * (the relevant eye is shut, waiting to re-open). Used purely to drive
   * in-progress UI feedback (50% bar while closing) — it never completes the
   * challenge; only the re-open edge in `detect()` does.
   */
  private isTransientClosing(type: ChallengeType, metrics: FaceMetrics): boolean {
    const { avgEAR, userLeftEAR, userRightEAR } = metrics.eyes;
    switch (type) {
      case ChallengeType.BLINK:
        return avgEAR < BLINK_EAR_CLOSED;
      case ChallengeType.CLOSE_LEFT:
        return userLeftEAR < BLINK_EAR_CLOSED && userRightEAR > EAR_THRESHOLD;
      case ChallengeType.CLOSE_RIGHT:
        return userRightEAR < BLINK_EAR_CLOSED && userLeftEAR > EAR_THRESHOLD;
      default:
        return false;
    }
  }

  /**
   * Stop the puzzle immediately.
   * @see demo_local_fast.py lines 553-557
   */
  stop(): void {
    this.active = false;
    this.complete = true;
  }

  /**
   * Get information about the current challenge.
   * @returns ChallengeInfo or null if no active challenge.
   * @see demo_local_fast.py lines 559-573
   */
  getCurrentChallenge(): ChallengeInfo | null {
    if (!this.active || this.currentIdx >= this.challenges.length) {
      return null;
    }

    const challengeType = this.challenges[this.currentIdx];
    const definition = CHALLENGE_DEFINITIONS[challengeType];

    return {
      type: challengeType,
      displayName: definition.displayName,
      icon: definition.icon,
      index: this.currentIdx,
      total: this.challenges.length,
    };
  }

  // ===========================================================================
  // Per-Frame Challenge Check
  // ===========================================================================

  /**
   * Check whether the current challenge condition is met for this frame.
   *
   * Flow:
   *   1. Calculate FaceMetrics from landmarks via metricsCalculator
   *   2. Build HeadPose from yaw/pitch
   *   3. Update motion history
   *   4. Pass motion history to NodDetector/ShakeHeadDetector if needed
   *   5. Call detector.detect(metrics, headPose)
   *   6. Manage hold timer (0.6s continuous detection)
   *   7. On hold complete, advance to next challenge
   *
   * @see demo_local_fast.py lines 702-881 (check_challenge)
   */
  checkChallenge(
    landmarks: NormalizedLandmark[],
    yaw: number,
    pitch: number,
  ): ChallengeCheckResult {
    if (!this.active || this.currentIdx >= this.challenges.length) {
      return { detected: false, progress: 0, message: 'No active challenge' };
    }

    const challengeType = this.challenges[this.currentIdx];
    const detector = this.detectors.get(challengeType);

    if (!detector) {
      return { detected: false, progress: 0, message: `No detector for ${challengeType}` };
    }

    // Capture the transient flag up-front: the `instanceof NodDetector`/
    // `ShakeHeadDetector` narrowing below collapses `detector` to a union of
    // concrete classes that don't declare the optional `isTransient`, so read
    // it here while `detector` is still the interface type.
    const isTransient = detector.isTransient === true;

    // Calculate face metrics from landmarks
    const rawMetrics = this.metricsCalculator.calculateAll(landmarks);

    // EWMA temporal smoothing of the head-pose angles (Layer 3, ported from
    // the Python hand pipeline). The real-degree Euler pose still wobbles
    // ±2-3° per frame; smoothing keeps directional gestures from flickering.
    this.smoothedYaw =
      this.smoothedYaw === null
        ? yaw
        : HEAD_POSE_EWMA_ALPHA * yaw + (1 - HEAD_POSE_EWMA_ALPHA) * this.smoothedYaw;
    this.smoothedPitch =
      this.smoothedPitch === null
        ? pitch
        : HEAD_POSE_EWMA_ALPHA * pitch + (1 - HEAD_POSE_EWMA_ALPHA) * this.smoothedPitch;

    // ── Attempt history + baseline (2026-11-01) ─────────────────────────────
    const nowMs = this.clock();
    const now = nowMs / 1000;
    if (this.attemptStartMs === null) this.attemptStartMs = nowMs;
    const last = this.attempt[this.attempt.length - 1];
    if (!last || nowMs - last.t >= ATTEMPT_SAMPLE_INTERVAL_MS) {
      const brow = this.metricsCalculator.calculateEyebrowRaise(landmarks, RAW_BROW_BASELINE);
      this.attempt.push({
        t: nowMs,
        yaw,
        pitch,
        smoothedYaw: this.smoothedYaw,
        smoothedPitch: this.smoothedPitch,
        mar: rawMetrics.mouth.mar,
        smileCorner: rawMetrics.mouth.smileCornerRaise,
        browLeft: brow.leftRatio,
        browRight: brow.rightRatio,
        browAvg: brow.bothRatio,
      });
    }
    while (this.attempt.length > 1 && nowMs - this.attempt[0].t > ATTEMPT_WINDOW_MS) {
      this.attempt.shift();
    }
    const poseReady = this.attempt.length >= POSE_BASELINE_FRAMES;
    const exprReady = this.attempt.length >= EXPRESSION_BASELINE_FRAMES;
    const base = (key: keyof AttemptSample, frames: number): number =>
      medianOf(this.attempt.slice(0, frames).map((e) => e[key]));
    const baseYaw = base('yaw', POSE_BASELINE_FRAMES);
    const basePitch = base('pitch', POSE_BASELINE_FRAMES);

    // Gates see the pose RELATIVE to the attempt baseline (bio does the same
    // with its in-trace baseline) and the expression ratios against it.
    const headPose: HeadPose = {
      yaw: this.smoothedYaw - (poseReady ? baseYaw : this.smoothedYaw),
      pitch: this.smoothedPitch - (poseReady ? basePitch : this.smoothedPitch),
    };
    const metrics = this.relativeMetrics(landmarks, rawMetrics, exprReady, base);

    // nod/shake: smoothed pose over the same rolling window.
    // @see demo_local_fast.py line 722
    this.motionHistory = this.attempt.map((e) => ({
      yaw: e.smoothedYaw,
      pitch: e.smoothedPitch,
      time: e.t / 1000,
    }));

    // Pass motion history to motion-aware detectors
    // @see demo_local_fast.py lines 855-861
    if (detector instanceof NodDetector) {
      detector.setMotionHistory(this.motionHistory);
    } else if (detector instanceof ShakeHeadDetector) {
      detector.setMotionHistory(this.motionHistory);
    }

    // Check detection on the smoothed, baseline-relative pose.
    const gateOpen = this.gateAllows(detector.type, poseReady, exprReady, baseYaw, base);
    const rawDetected = gateOpen && detector.detect(metrics, headPose);
    const message = detector.getMessage(metrics, headPose);
    // bio rejects traces shorter than its per-action minimum span / frame
    // count: no completion in the first MIN_ATTEMPT_MS of an attempt.
    const attemptOldEnough = nowMs - this.attemptStartMs >= MIN_ATTEMPT_MS;

    // ── Transient (edge) challenges: BLINK, CLOSE_LEFT, CLOSE_RIGHT ──────────
    // These are momentary actions. The detector is a stateful close→re-open
    // edge that returns `true` exactly ONCE — on the re-open. There is no hold:
    // the single edge completes the challenge. Re-opening the eye is what
    // COMPLETES it (the previous global 0.6s-hold model cancelled progress the
    // instant the eye re-opened, which is the exact bug we're fixing).
    if (isTransient) {
      if (rawDetected && attemptOldEnough) {
        this.advanceChallenge();
        return { detected: true, progress: 100, message: 'Completed!', completed: true };
      }
      // Surface in-progress feedback: the close phase (eyes shut) shows partial
      // progress so the user sees the system reacting, but completion only
      // fires on the re-open edge above.
      const closing = this.isTransientClosing(detector.type, metrics);
      return {
        detected: closing,
        progress: closing ? 50 : 0,
        message,
      };
    }

    // ── Sustained (held) challenges: turns, look up/down, smile, mouth, brows,
    //    nod, shake — keep the continuous HOLD_DURATION timer. ─────────────────

    // Release-debounce hysteresis: once a gesture is registered, tolerate up to
    // `releaseHysteresisFrames` boundary-flicker frames before dropping it, so
    // the hold timer isn't reset by a single noisy frame.
    let detected = rawDetected;
    if (!rawDetected && this.actionDetected) {
      this.lostFrames += 1;
      if (this.lostFrames < this.releaseHysteresisFrames) {
        detected = true;
      }
    } else if (rawDetected) {
      this.lostFrames = 0;
    }

    // Handle hold timer
    // @see demo_local_fast.py lines 863-881
    if (detected) {
      if (!this.actionDetected) {
        this.holdStart = now;
        this.actionDetected = true;
      }

      const holdTime = now - this.holdStart;
      const progress = Math.min(100, (holdTime / this.holdDuration) * 100);

      if (holdTime >= this.holdDuration && attemptOldEnough) {
        // Challenge completed!
        this.advanceChallenge();
        return { detected: true, progress: 100, message: 'Completed!', completed: true };
      }

      return { detected: true, progress, message };
    }

    // Detection lost — reset hold timer + hysteresis counter
    this.actionDetected = false;
    this.lostFrames = 0;
    this.holdStart = now;
    return { detected: false, progress: 0, message };
  }

  // ===========================================================================
  // State Accessors
  // ===========================================================================

  /** Whether the puzzle is currently running. */
  getIsActive(): boolean {
    return this.active;
  }

  /** Whether the puzzle has finished. */
  getIsComplete(): boolean {
    return this.complete;
  }

  /** Whether all challenges were passed. */
  getPassed(): boolean {
    return this.puzzlePassed;
  }

  /** Get results for all completed steps. */
  getResults(): PuzzleStepResult[] {
    return [...this.results];
  }

  /**
   * IBiometricPuzzle conformance — always available once constructed.
   */
  isAvailable(): boolean {
    return true;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Expression metrics relative to the attempt baseline: brow ratios use the
   * median of the first EXPRESSION_BASELINE_FRAMES raw brow→eye distances
   * (1.0 until enough samples exist) and the smile carries the corner-raise
   * increase over its baseline.
   */
  private relativeMetrics(
    landmarks: NormalizedLandmark[],
    raw: FaceMetrics,
    exprReady: boolean,
    base: (key: keyof AttemptSample, frames: number) => number,
  ): FaceMetrics {
    if (!exprReady) {
      return {
        ...raw,
        mouth: { ...raw.mouth, smileCornerIncrease: 0 },
        eyebrows: { bothRatio: 1, leftRatio: 1, rightRatio: 1 },
      };
    }
    const now = this.metricsCalculator.calculateEyebrowRaise(landmarks, RAW_BROW_BASELINE);
    const ratio = (cur: number, b: number) => (b > 0 ? cur / b : 1);
    return {
      ...raw,
      mouth: {
        ...raw.mouth,
        smileCornerIncrease:
          raw.mouth.smileCornerRaise - base('smileCorner', EXPRESSION_BASELINE_FRAMES),
      },
      eyebrows: {
        bothRatio: ratio(now.bothRatio, base('browAvg', EXPRESSION_BASELINE_FRAMES)),
        leftRatio: ratio(now.leftRatio, base('browLeft', EXPRESSION_BASELINE_FRAMES)),
        rightRatio: ratio(now.rightRatio, base('browRight', EXPRESSION_BASELINE_FRAMES)),
      },
    };
  }

  /**
   * Preconditions a frame must meet before the detector's own threshold is
   * consulted (all mirror biometric-processor's trace verifier):
   *   - pose / expression gates need their baseline samples;
   *   - OPEN_MOUTH needs a closed-mouth baseline (bio: NO_REST_TO_GESTURE);
   *   - LOOK_UP / LOOK_DOWN / NOD only count near-frontal in yaw, where the
   *     matrix pitch and bio's landmark pitch agree.
   */
  private gateAllows(
    type: ChallengeType,
    poseReady: boolean,
    exprReady: boolean,
    baseYaw: number,
    base: (key: keyof AttemptSample, frames: number) => number,
  ): boolean {
    const frontal = (yaw: number) =>
      Math.abs(yaw) <= PITCH_GESTURE_MAX_ABS_YAW &&
      Math.abs(yaw - baseYaw) <= PITCH_GESTURE_MAX_REL_YAW;
    switch (type) {
      case ChallengeType.TURN_LEFT:
      case ChallengeType.TURN_RIGHT:
        return poseReady;
      case ChallengeType.LOOK_UP:
      case ChallengeType.LOOK_DOWN:
        return poseReady && frontal(this.smoothedYaw ?? 0);
      case ChallengeType.NOD:
        return poseReady && this.attempt.every((e) => frontal(e.smoothedYaw));
      case ChallengeType.OPEN_MOUTH:
        return poseReady && base('mar', POSE_BASELINE_FRAMES) < MOUTH_OPEN_THRESHOLD;
      case ChallengeType.SMILE:
      case ChallengeType.RAISE_BOTH_BROWS:
      case ChallengeType.RAISE_LEFT_BROW:
      case ChallengeType.RAISE_RIGHT_BROW:
        return exprReady;
      default:
        return true;
    }
  }

  /**
   * Advance to the next challenge or complete the puzzle.
   * @see demo_local_fast.py lines 901-920 (_advance_challenge)
   */
  private advanceChallenge(): void {
    this.results.push({
      challenge: this.challenges[this.currentIdx],
      passed: true,
      timestamp: Date.now(),
    });

    this.currentIdx += 1;
    this.actionDetected = false;
    this.holdStart = 0;
    this.resetAttempt();
    // Reset the pose smoother + hysteresis so the next challenge starts clean.
    this.smoothedYaw = null;
    this.smoothedPitch = null;
    this.lostFrames = 0;
    // Reset the next challenge's stateful (transient) detector so a stray
    // close phase doesn't carry over from the just-finished challenge.
    this.resetCurrentDetector();

    if (this.currentIdx >= this.challenges.length) {
      this.complete = true;
      this.active = false;
      this.puzzlePassed = true;
    }
  }
}
