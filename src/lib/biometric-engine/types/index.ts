/**
 * Biometric Engine — Type Definitions
 *
 * All TypeScript interfaces, enums, and constants for the biometric engine.
 * Direct port from demo_local_fast.py.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 6
 */

// ===== Landmark Types =====

/**
 * Normalized landmark from MediaPipe (0-1 range).
 * @see demo_local_fast.py — MediaPipe FaceLandmarker output
 */
export interface NormalizedLandmark {
  /** Horizontal position, 0.0 - 1.0 */
  x: number;
  /** Vertical position, 0.0 - 1.0 */
  y: number;
  /** Depth (relative) */
  z: number;
}

/**
 * Pixel-space landmark (scaled to frame dimensions).
 * @see demo_local_fast.py — used for head pose estimation
 */
export interface PixelLandmark {
  /** Horizontal position, 0 - frameWidth */
  x: number;
  /** Vertical position, 0 - frameHeight */
  y: number;
}

// ===== Face Detection Types =====

/**
 * Bounding box in pixel coordinates.
 * @see demo_local_fast.py line 269
 */
export interface BoundingBox {
  /** Top-left X (pixels) */
  x: number;
  /** Top-left Y (pixels) */
  y: number;
  /** Width (pixels) */
  width: number;
  /** Height (pixels) */
  height: number;
}

/**
 * Face detection result with landmarks.
 * @see demo_local_fast.py — FaceDetector output
 */
export interface FaceDetection {
  /** Tracker-assigned ID */
  id: number;
  /** Face bounding box */
  boundingBox: BoundingBox;
  /** Detection confidence 0-1 */
  confidence: number;
  /** All 478 MediaPipe landmarks in normalized coordinates */
  landmarks478: NormalizedLandmark[];
  /** Same landmarks in pixel coordinates */
  pixelLandmarks: PixelLandmark[];
}

// ===== Quality Types =====

/**
 * Quality assessment report for a face image.
 * @see demo_local_fast.py lines 338-366 (FastQualityAssessor.assess)
 */
export interface QualityReport {
  /** Overall quality score 0-100 */
  score: number;
  /** Blur score 0-100 (higher = sharper) */
  blur: number;
  /** Size score 0-100 (higher = larger face) */
  size: number;
  /** Raw mean brightness 0-255 */
  brightness: number;
  /** Whether brightness is in acceptable range (50 < brightness < 200) */
  brightnessOk: boolean;
  /** List of detected quality issues */
  issues: QualityIssue[];
}

/**
 * Quality issue identifiers.
 * @see demo_local_fast.py lines 338-366
 */
export type QualityIssue = 'Blurry' | 'Small' | 'Dark' | 'Bright';

/**
 * Configurable quality assessment thresholds.
 * @see demo_local_fast.py lines 335, 350, 354
 */
export interface QualityThresholds {
  /** Laplacian variance divisor. Default: 100.0 */
  blurThreshold: number;
  /** Minimum overall score for enrollment. Default: 65 */
  minScore: number;
  /** Minimum acceptable brightness. Default: 50 */
  minBrightness: number;
  /** Maximum acceptable brightness. Default: 200 */
  maxBrightness: number;
  /** Minimum face dimension in pixels. Default: 80 */
  minFaceDimension: number;
}

// ===== Liveness Types =====

/**
 * Passive liveness detection result.
 * @see demo_local_fast.py lines 387-444 (FastLivenessDetector.check)
 */
export interface LivenessResult {
  /** Whether the face is determined to be live */
  isLive: boolean;
  /** Overall liveness score 0-100 */
  score: number;
  /** Individual sub-scores */
  breakdown: {
    /** Texture score 0-100, weight 0.25 */
    texture: number;
    /** Color naturalness score 0-100, weight 0.25 */
    color: number;
    /** Skin tone score 0-100, weight 0.15 */
    skinTone: number;
    /** Moire pattern score 0-100, weight 0.20 */
    moire: number;
    /** Local variance score 0-100, weight 0.15 */
    localVariance: number;
  };
}

/**
 * Passive liveness detection configuration.
 * @see demo_local_fast.py line 379
 */
export interface LivenessConfig {
  /** Score threshold for isLive determination. Default: 50.0 */
  threshold: number;
}

// ===== Puzzle Types =====

/**
 * All 14 challenge types for active liveness puzzle.
 * @see demo_local_fast.py lines 451-921 (BiometricPuzzle)
 */
export enum ChallengeType {
  BLINK = 'BLINK',
  CLOSE_LEFT = 'CLOSE_LEFT',
  CLOSE_RIGHT = 'CLOSE_RIGHT',
  SMILE = 'SMILE',
  OPEN_MOUTH = 'OPEN_MOUTH',
  TURN_LEFT = 'TURN_LEFT',
  TURN_RIGHT = 'TURN_RIGHT',
  LOOK_UP = 'LOOK_UP',
  LOOK_DOWN = 'LOOK_DOWN',
  RAISE_BOTH_BROWS = 'RAISE_BOTH_BROWS',
  RAISE_LEFT_BROW = 'RAISE_LEFT_BROW',
  RAISE_RIGHT_BROW = 'RAISE_RIGHT_BROW',
  NOD = 'NOD',
  SHAKE_HEAD = 'SHAKE_HEAD',
}

/**
 * Static definition of a challenge type (display info).
 * @see demo_local_fast.py — puzzle challenge definitions
 */
export interface ChallengeDefinition {
  /** Human-readable name */
  displayName: string;
  /** Internal key */
  key: string;
  /** Emoji/icon for UI display */
  icon: string;
}

/**
 * Runtime info about the current challenge in a puzzle.
 * @see demo_local_fast.py — BiometricPuzzle state
 */
export interface ChallengeInfo {
  /** Challenge type */
  type: ChallengeType;
  /** Human-readable name */
  displayName: string;
  /** Emoji/icon for UI */
  icon: string;
  /** 0-based index of current challenge */
  index: number;
  /** Total number of challenges in this puzzle */
  total: number;
}

/**
 * Result of checking whether a challenge condition is met.
 * @see demo_local_fast.py — BiometricPuzzle.check_challenge
 */
export interface ChallengeCheckResult {
  /** Whether the target condition was detected */
  detected: boolean;
  /** Hold timer progress 0-100 */
  progress: number;
  /** User-facing feedback message */
  message: string;
  /** True when this challenge is fully completed */
  completed?: boolean;
}

/**
 * Result of a single puzzle step.
 * @see demo_local_fast.py — puzzle step tracking
 */
export interface PuzzleStepResult {
  /** The challenge that was attempted */
  challenge: ChallengeType;
  /** Whether the challenge was passed */
  passed: boolean;
  /** Timestamp when the step completed */
  timestamp: number;
}

/**
 * Overall result of a completed puzzle.
 * @see demo_local_fast.py — puzzle completion
 */
export interface PuzzleResult {
  /** Whether all challenges were passed */
  passed: boolean;
  /** Individual step results */
  steps: PuzzleStepResult[];
  /** Total time in milliseconds */
  totalTime: number;
}

// ===== Head Pose Types =====

/**
 * Head pose estimation result.
 * @see demo_local_fast.py lines 1415-1440 (estimate_head_pose)
 */
export interface HeadPose {
  /** Yaw in degrees. -45 to +45. Negative = left, positive = right. */
  yaw: number;
  /** Pitch in degrees. -35 to +35. Negative = up, positive = down. */
  pitch: number;
}

// ===== Metric Types =====

/**
 * Eye aspect ratio metrics.
 * @see demo_local_fast.py lines 462-471 (calculate_ear)
 */
export interface EyeMetrics {
  /** Left eye aspect ratio (MediaPipe LEFT = user's right) */
  leftEAR: number;
  /** Right eye aspect ratio (MediaPipe RIGHT = user's left) */
  rightEAR: number;
  /** Average of both eyes */
  avgEAR: number;
  /** User's left eye (= MediaPipe RIGHT_EYE) */
  userLeftEAR: number;
  /** User's right eye (= MediaPipe LEFT_EYE) */
  userRightEAR: number;
}

/**
 * Mouth metrics for open/close and smile detection.
 * @see demo_local_fast.py lines 464-467 (mouth landmarks)
 */
export interface MouthMetrics {
  /** Mouth aspect ratio (open/close) */
  mar: number;
  /** Lip corner raise ratio */
  smileCornerRaise: number;
  /** Mouth width / face height */
  smileWidthRatio: number;
}

/**
 * Eyebrow raise metrics relative to baseline.
 * @see demo_local_fast.py lines 468-469 (eyebrow landmarks)
 */
export interface EyebrowMetrics {
  /** Both eyebrows raise ratio vs baseline */
  bothRatio: number;
  /** Left eyebrow raise ratio */
  leftRatio: number;
  /** Right eyebrow raise ratio */
  rightRatio: number;
}

/**
 * Smile detection metrics.
 * @see demo_local_fast.py lines 497-498 (smile thresholds)
 */
export interface SmileMetrics {
  /** Lip corner raise ratio */
  cornerRaise: number;
  /** Mouth width / face height ratio */
  widthRatio: number;
}

/**
 * Eyebrow baseline for relative raise detection.
 * @see demo_local_fast.py — eyebrow calibration
 */
export interface EyebrowBaseline {
  /** Left eyebrow baseline distance */
  left: number;
  /** Right eyebrow baseline distance */
  right: number;
  /** Average baseline distance */
  avg: number;
}

/**
 * Combined face metrics from FaceMetricsCalculator.
 * @see demo_local_fast.py — FaceMetricsCalculator output
 */
export interface FaceMetrics {
  /** Eye aspect ratio metrics */
  eyes: EyeMetrics;
  /** Mouth metrics */
  mouth: MouthMetrics;
  /** Eyebrow raise metrics */
  eyebrows: EyebrowMetrics;
}

// ===== Embedding Types =====

/**
 * Face embedding vector with model metadata.
 * @see demo_local_fast.py line 966 (embedding threshold)
 */
export interface Embedding {
  /** Embedding vector (128-dim or 512-dim) */
  vector: Float32Array;
  /** Model identifier, e.g. 'mobilefacenet-128' or 'geometry' */
  model: string;
}

/**
 * Single enrollment capture for one pose angle.
 * @see demo_local_fast.py lines 1287-1293 (enroll_poses)
 */
export interface EnrollmentCapture {
  /** Pose name: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' */
  pose: string;
  /** Face embedding for this capture */
  embedding: Embedding;
  /** Quality score at capture time */
  qualityScore: number;
  /** Base64 JPEG for server submission */
  imageData: string;
}

/**
 * Complete enrollment result after all poses captured.
 * @see demo_local_fast.py — enrollment completion
 */
export interface EnrollmentResult {
  /** Enrolled person's name */
  name: string;
  /** All captured poses with embeddings */
  captures: EnrollmentCapture[];
  /** Whether the liveness puzzle was passed */
  puzzlePassed: boolean;
}

/**
 * Face verification result.
 * @see demo_local_fast.py line 966 (embedding_threshold = 0.5)
 */
export interface VerificationResult {
  /** Whether a match was found */
  matched: boolean;
  /** Matched person's name, or null */
  name: string | null;
  /** Cosine similarity 0-1 */
  similarity: number;
  /** Similarity threshold used. Default: 0.5 */
  threshold: number;
}

// ===== Card Detection Types =====

/**
 * Card detection result from YOLO model.
 * @see demo_local_fast.py lines 1151 (card detection)
 */
export interface CardDetectionResult {
  /** Whether a card was detected */
  detected: boolean;
  /** Raw class name, e.g. 'tc_kimlik' */
  cardClass: string | null;
  /** Display name, e.g. 'Turkish ID' */
  cardLabel: string | null;
  /** Detection confidence 0-1 */
  confidence: number;
  /** Card bounding box, or null */
  boundingBox: BoundingBox | null;
}

// ===== Frame Result Types =====

/**
 * Per-frame output from FrameProcessor.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b
 */
export interface FrameResult {
  /** All tracked faces in this frame */
  faces: TrackedFace[];
  /** Current FPS */
  fps: number;
  /** Frame timestamp */
  timestamp: number;
}

/**
 * A tracked face with all computed metrics for a single frame.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b
 */
export interface TrackedFace {
  /** Tracker-assigned face ID */
  id: number;
  /** Raw face detection data */
  detection: FaceDetection;
  /** Quality assessment, or null if not computed */
  quality: QualityReport | null;
  /** Passive liveness result, or null if not computed */
  liveness: LivenessResult | null;
  /** Head pose estimation, or null if not computed */
  headPose: HeadPose | null;
  /** Face metrics, or null if not computed */
  metrics: FaceMetrics | null;
}

// ===== Enrollment Types =====

/**
 * Target pose for enrollment capture.
 * @see demo_local_fast.py lines 1287-1293 (self._enroll_poses)
 */
export interface EnrollmentPose {
  /** Pose name */
  name: string;
  /** Target yaw angle in degrees */
  targetYaw: number;
  /** Target pitch angle in degrees */
  targetPitch: number;
  /** Tolerance in degrees */
  tolerance: number;
}

/**
 * Pre-defined enrollment poses matching the Python implementation.
 * @see demo_local_fast.py lines 1287-1293
 */
export const ENROLLMENT_POSES: EnrollmentPose[] = [
  { name: 'STRAIGHT', targetYaw: 0, targetPitch: 0, tolerance: 12 },
  { name: 'LEFT', targetYaw: -25, targetPitch: 0, tolerance: 15 },
  { name: 'RIGHT', targetYaw: 25, targetPitch: 0, tolerance: 15 },
  { name: 'UP', targetYaw: 0, targetPitch: 18, tolerance: 15 },
  { name: 'DOWN', targetYaw: 0, targetPitch: -18, tolerance: 15 },
];

/**
 * Enrollment state machine states.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7 (Enrollment State Machine)
 */
export enum EnrollmentState {
  IDLE = 'IDLE',
  PUZZLE_ACTIVE = 'PUZZLE_ACTIVE',
  CAPTURE_STRAIGHT = 'CAPTURE_STRAIGHT',
  CAPTURE_LEFT = 'CAPTURE_LEFT',
  CAPTURE_RIGHT = 'CAPTURE_RIGHT',
  CAPTURE_UP = 'CAPTURE_UP',
  CAPTURE_DOWN = 'CAPTURE_DOWN',
  SUBMITTING = 'SUBMITTING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

/**
 * Enrollment progress update emitted during enrollment flow.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 7
 */
export interface EnrollmentUpdate {
  /** Current enrollment state */
  state: EnrollmentState;
  /** Whether yaw is within target tolerance */
  yawOk: boolean;
  /** Whether pitch is within target tolerance */
  pitchOk: boolean;
  /** Whether the face position is stable */
  isStable: boolean;
  /** Stability score (lower = more stable) */
  stabilityScore: number;
  /** Hold-to-capture progress 0-100 */
  holdProgress: number;
  /** User-facing guidance message */
  message: string;
}

// ===== Motion History (for Nod/Shake detection) =====

/**
 * Motion history entry for nod/shake challenge detection.
 * @see demo_local_fast.py lines 885-898 (nod/shake detection)
 */
export interface MotionEntry {
  /** Yaw angle at this frame */
  yaw: number;
  /** Pitch angle at this frame */
  pitch: number;
  /** Timestamp of this entry */
  time: number;
}
