/**
 * @fivucsas/biometric-engine
 *
 * Browser-native biometric engine library.
 * Pure TypeScript with zero framework dependencies.
 *
 * Barrel export — re-exports all types, interfaces, and core utilities.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md
 */

// ===== Type Definitions =====
export type {
  NormalizedLandmark,
  PixelLandmark,
  BoundingBox,
  FaceDetection,
  QualityReport,
  QualityIssue,
  QualityThresholds,
  LivenessResult,
  LivenessConfig,
  ChallengeDefinition,
  ChallengeInfo,
  ChallengeCheckResult,
  PuzzleStepResult,
  PuzzleResult,
  HeadPose,
  EyeMetrics,
  MouthMetrics,
  EyebrowMetrics,
  SmileMetrics,
  EyebrowBaseline,
  FaceMetrics,
  Embedding,
  EnrollmentCapture,
  EnrollmentResult,
  EnrollmentUpdate,
  VerificationResult,
  CardDetectionResult,
  FrameResult,
  TrackedFace,
  EnrollmentPose,
  MotionEntry,
} from './types';

export { ChallengeType, EnrollmentState, ENROLLMENT_POSES } from './types';

// ===== Component Interfaces =====
export type {
  IFaceDetector,
  IQualityAssessor,
  IHeadPoseEstimator,
  IFaceTracker,
  IFaceMetricsCalculator,
  IPassiveLivenessDetector,
  IChallengeDetector,
  IBiometricPuzzle,
  IEmbeddingComputer,
  ICardDetector,
  IVoiceProcessor,
  IBiometricEngineConfig,
} from './interfaces';

// ===== Core Classes =====
export { BiometricEngine, BiometricEngineBuilder } from './core/BiometricEngine';
export { FrameProcessor } from './core/FrameProcessor';
export type { FrameProcessorDeps } from './core/FrameProcessor';
export { EnrollmentController } from './core/EnrollmentController';
export { FaceDetector } from './core/FaceDetector';
export { QualityAssessor } from './core/QualityAssessor';
export { HeadPoseEstimator } from './core/HeadPoseEstimator';
export { FaceTracker } from './core/FaceTracker';
export { FaceMetricsCalculator } from './core/FaceMetricsCalculator';
export { PassiveLivenessDetector } from './core/PassiveLivenessDetector';
export { EmbeddingComputer } from './core/EmbeddingComputer';

// ===== Challenge Detectors (Strategy Pattern) =====
export {
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
} from './core/challenges';

// ===== Core Utilities =====
export {
  toGrayscale,
  computeLaplacianVariance,
  rgbToHsv,
  computeMeanHSV,
  generateGaborKernel,
  GABOR_KERNELS,
  applyGaborFilter,
  computeMean,
  computeVariance,
  computeStd,
  extractFaceROI,
} from './core/image-utils';

// ===== Constants =====
export {
  // Puzzle thresholds
  EAR_THRESHOLD,
  EAR_CLOSED_THRESHOLD,
  SMILE_CORNER_THRESHOLD,
  SMILE_WIDTH_THRESHOLD,
  MOUTH_OPEN_THRESHOLD,
  YAW_THRESHOLD,
  PITCH_THRESHOLD,
  EYEBROW_RAISE_THRESHOLD,
  SINGLE_BROW_THRESHOLD,
  NOD_PITCH_RANGE,
  SHAKE_YAW_RANGE,
  HOLD_DURATION,
  MOTION_HISTORY_SIZE,
  MOTION_MIN_FRAMES,
  // Quality thresholds
  BLUR_THRESHOLD,
  MIN_BRIGHTNESS,
  MAX_BRIGHTNESS,
  MIN_FACE_DIM,
  QUALITY_MIN_SCORE,
  // Passive liveness thresholds
  LIVENESS_THRESHOLD,
  TEXTURE_OFFSET,
  TEXTURE_SCALE,
  SAT_LOW,
  SAT_HIGH,
  SAT_OVERSATURATED_SCALE,
  SKIN_HUE_MAX,
  SKIN_HUE_WRAP,
  GABOR_STD_THRESHOLD,
  MOIRE_PENALTY,
  LOCAL_VAR_SCALE,
  LIVENESS_WEIGHTS,
  // Face detection thresholds
  MIN_DETECTION_CONFIDENCE,
  MIN_FACE_SIZE,
  LANDMARK_CACHE_INTERVAL,
  LIVENESS_CACHE_INTERVAL,
  VERIFY_CACHE_INTERVAL,
  // Enrollment thresholds
  STABILITY_THRESHOLD,
  STABILITY_MIN_FRAMES,
  STABILITY_HISTORY_SIZE,
  HOLD_TO_CAPTURE,
  EMBEDDING_THRESHOLD,
  ENROLLMENT_QUALITY_MIN,
  MAX_EMBEDDINGS_PER_FACE,
  // Head pose constants
  YAW_SCALE,
  PITCH_SCALE,
  YAW_CLAMP,
  PITCH_CLAMP,
  MIN_LANDMARKS_FOR_POSE,
  // Tracker constants
  MAX_GONE_FRAMES,
  MAX_MATCH_DISTANCE,
  // Card detection constants
  CARD_CONFIDENCE,
  CARD_INPUT_SIZE,
  SMOOTHING_HISTORY,
  SMOOTHING_MIN_DETECTIONS,
  CARD_CACHE_INTERVAL,
  CLAHE_CLIP_LIMIT,
  CLAHE_TILE_SIZE,
  DEFAULT_FACE_ROI_PADDING,
  // Landmark indices
  LEFT_EYE,
  RIGHT_EYE,
  UPPER_LIP,
  LOWER_LIP,
  MOUTH_LEFT,
  MOUTH_RIGHT,
  LEFT_EYEBROW,
  RIGHT_EYEBROW,
  LEFT_IRIS,
  RIGHT_IRIS,
  NOSE_TIP,
  CHIN,
  FOREHEAD,
  FACE_LEFT_CONTOUR,
  FACE_RIGHT_CONTOUR,
  HEAD_POSE_LEFT_EYE,
  HEAD_POSE_RIGHT_EYE,
  HEAD_POSE_LEFT_MOUTH,
  HEAD_POSE_RIGHT_MOUTH,
  // Landmark connection maps
  FACE_CONTOUR,
  LEFT_EYE_OUTLINE,
  RIGHT_EYE_OUTLINE,
  LIPS_OUTER,
  NOSE,
  LEFT_EYEBROW_OUTLINE,
  RIGHT_EYEBROW_OUTLINE,
} from './core/constants';

// ===== React Hooks =====
export {
  useBiometricEngine,
  useFaceDetection,
  useLivenessPuzzle,
  useFaceEnrollment,
  useVoiceRecorder,
  useCardDetection,
} from './hooks';

export type {
  UseBiometricEngineReturn,
  UseFaceDetectionReturn,
  UseLivenessPuzzleReturn,
  UseFaceEnrollmentReturn,
  UseVoiceRecorderReturn,
  UseCardDetectionReturn,
} from './hooks';
