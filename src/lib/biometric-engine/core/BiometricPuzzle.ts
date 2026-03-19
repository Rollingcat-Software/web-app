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
  HeadPose,
  MotionEntry,
  NormalizedLandmark,
  PuzzleStepResult,
} from '../types';
import { ChallengeType } from '../types';
import type { IBiometricPuzzle, IChallengeDetector, IFaceMetricsCalculator } from '../interfaces';
import {
  HOLD_DURATION,
  MOTION_HISTORY_SIZE,
} from './constants';

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
 * Simple pool of challenge types for random selection (excludes dynamic).
 * @see demo_local_fast.py lines 533-539
 */
const SIMPLE_CHALLENGE_POOL: ChallengeType[] = [
  ChallengeType.BLINK,
  ChallengeType.CLOSE_LEFT,
  ChallengeType.CLOSE_RIGHT,
  ChallengeType.SMILE,
  ChallengeType.OPEN_MOUTH,
  ChallengeType.TURN_LEFT,
  ChallengeType.TURN_RIGHT,
  ChallengeType.LOOK_UP,
  ChallengeType.LOOK_DOWN,
  ChallengeType.RAISE_BOTH_BROWS,
  ChallengeType.RAISE_LEFT_BROW,
  ChallengeType.RAISE_RIGHT_BROW,
];

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

  // ===== Motion History (for nod/shake) =====
  /** Ring buffer of recent yaw/pitch values. @see demo_local_fast.py line 519 */
  private motionHistory: MotionEntry[] = [];
  /** Max entries in the motion history buffer. */
  private readonly motionHistorySize: number = MOTION_HISTORY_SIZE;

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
  constructor(metricsCalculator: IFaceMetricsCalculator, numChallenges = 3) {
    this.metricsCalculator = metricsCalculator;
    this.numChallenges = numChallenges;
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
    this.motionHistory = [];
    this.results = [];
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

    // Calculate face metrics from landmarks
    const metrics = this.metricsCalculator.calculateAll(landmarks);
    const headPose: HeadPose = { yaw, pitch };

    // Update motion history ring buffer
    // @see demo_local_fast.py line 722
    const now = performance.now() / 1000; // Convert to seconds
    this.motionHistory.push({ yaw, pitch, time: now });
    if (this.motionHistory.length > this.motionHistorySize) {
      this.motionHistory.shift();
    }

    // Pass motion history to motion-aware detectors
    // @see demo_local_fast.py lines 855-861
    if (detector instanceof NodDetector) {
      detector.setMotionHistory(this.motionHistory);
    } else if (detector instanceof ShakeHeadDetector) {
      detector.setMotionHistory(this.motionHistory);
    }

    // Check detection
    const detected = detector.detect(metrics, headPose);
    const message = detector.getMessage(metrics, headPose);

    // Handle hold timer
    // @see demo_local_fast.py lines 863-881
    if (detected) {
      if (!this.actionDetected) {
        this.holdStart = now;
        this.actionDetected = true;
      }

      const holdTime = now - this.holdStart;
      const progress = Math.min(100, (holdTime / this.holdDuration) * 100);

      if (holdTime >= this.holdDuration) {
        // Challenge completed!
        this.advanceChallenge();
        return { detected: true, progress: 100, message: 'Completed!', completed: true };
      }

      return { detected: true, progress, message };
    }

    // Detection lost — reset hold timer
    this.actionDetected = false;
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
    this.motionHistory = [];

    if (this.currentIdx >= this.challenges.length) {
      this.complete = true;
      this.active = false;
      this.puzzlePassed = true;
    }
  }
}
