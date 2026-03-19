/**
 * Biometric Engine — Shared Constants
 *
 * All threshold values, landmark indices, and configuration constants
 * extracted from demo_local_fast.py. Every value references its Python source line.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 15 (Threshold Reference Table)
 */

// =============================================================================
// PUZZLE CHALLENGE THRESHOLDS
// @see demo_local_fast.py lines 495-503
// =============================================================================

/** Eye aspect ratio threshold for open eye detection. @see demo_local_fast.py line 495 */
export const EAR_THRESHOLD = 0.22;

/** Eye aspect ratio threshold for closed eye detection (BLINK, CLOSE_LEFT, CLOSE_RIGHT). @see demo_local_fast.py line 496 */
export const EAR_CLOSED_THRESHOLD = 0.17;

/** Lip corner raise ratio threshold (SMILE). @see demo_local_fast.py line 497 */
export const SMILE_CORNER_THRESHOLD = 0.05;

/** Mouth width / face height threshold (SMILE). @see demo_local_fast.py line 498 */
export const SMILE_WIDTH_THRESHOLD = 0.60;

/** Mouth aspect ratio threshold (OPEN_MOUTH). @see demo_local_fast.py line 499 */
export const MOUTH_OPEN_THRESHOLD = 0.12;

/** Head yaw threshold in degrees (TURN_LEFT, TURN_RIGHT). @see demo_local_fast.py line 500 */
export const YAW_THRESHOLD = 20;

/** Head pitch threshold in degrees (LOOK_UP, LOOK_DOWN). @see demo_local_fast.py line 501 */
export const PITCH_THRESHOLD = 12;

/** Both eyebrows raise ratio vs baseline (RAISE_BOTH_BROWS). @see demo_local_fast.py line 502 */
export const EYEBROW_RAISE_THRESHOLD = 1.20;

/** Single eyebrow raise ratio vs baseline (RAISE_LEFT/RIGHT_BROW). @see demo_local_fast.py line 503 */
export const SINGLE_BROW_THRESHOLD = 1.25;

/** Min pitch range over motion history for NOD detection (degrees). @see demo_local_fast.py line 890 */
export const NOD_PITCH_RANGE = 25;

/** Min yaw range over motion history for SHAKE_HEAD detection (degrees). @see demo_local_fast.py line 898 */
export const SHAKE_YAW_RANGE = 35;

/** Continuous detection time to pass a challenge (seconds). @see demo_local_fast.py line 515 */
export const HOLD_DURATION = 0.6;

/** Ring buffer size for nod/shake motion history (frames). @see demo_local_fast.py line 519 */
export const MOTION_HISTORY_SIZE = 30;

/** Min frames in motion history before checking nod/shake. @see demo_local_fast.py lines 885, 896 */
export const MOTION_MIN_FRAMES = 20;

// =============================================================================
// QUALITY ASSESSMENT THRESHOLDS
// @see demo_local_fast.py lines 335-366
// =============================================================================

/** Laplacian variance divisor for blur scoring. @see demo_local_fast.py line 335 */
export const BLUR_THRESHOLD = 100.0;

/** Minimum acceptable brightness (0-255 scale). @see demo_local_fast.py line 354 */
export const MIN_BRIGHTNESS = 50;

/** Maximum acceptable brightness (0-255 scale). @see demo_local_fast.py line 354 */
export const MAX_BRIGHTNESS = 200;

/** Minimum face dimension in pixels for size scoring. @see demo_local_fast.py line 350 */
export const MIN_FACE_DIM = 80;

/** Minimum quality score for enrollment capture. @see demo_local_fast.py line 2223 */
export const QUALITY_MIN_SCORE = 65;

// =============================================================================
// PASSIVE LIVENESS THRESHOLDS
// @see demo_local_fast.py lines 379-444
// =============================================================================

/** Overall score threshold for isLive determination. @see demo_local_fast.py line 379 */
export const LIVENESS_THRESHOLD = 50.0;

/** Laplacian variance offset for texture scoring. @see demo_local_fast.py line 398 */
export const TEXTURE_OFFSET = 20;

/** Laplacian variance divisor for texture scoring. @see demo_local_fast.py line 398 */
export const TEXTURE_SCALE = 3;

/** Minimum acceptable saturation for color scoring. @see demo_local_fast.py line 405 */
export const SAT_LOW = 30;

/** Maximum natural saturation before penalty. @see demo_local_fast.py line 405 */
export const SAT_HIGH = 120;

/** Penalty multiplier for oversaturated images (S > 120). @see demo_local_fast.py line 410 */
export const SAT_OVERSATURATED_SCALE = 0.8;

/** Maximum hue for skin tone detection (OpenCV 0-180 scale). @see demo_local_fast.py line 414 */
export const SKIN_HUE_MAX = 25;

/** Wrapped hue threshold for skin tone (OpenCV 0-180 scale). @see demo_local_fast.py line 414 */
export const SKIN_HUE_WRAP = 165;

/** Max Gabor response std before moire penalty. @see demo_local_fast.py line 421 */
export const GABOR_STD_THRESHOLD = 40;

/** Points deducted per bad Gabor kernel for moire detection. @see demo_local_fast.py line 422 */
export const MOIRE_PENALTY = 20;

/** Divisor for local variance scoring. @see demo_local_fast.py line 434 */
export const LOCAL_VAR_SCALE = 10;

/** Liveness score component weights. @see demo_local_fast.py line 439 */
export const LIVENESS_WEIGHTS = {
  texture: 0.25,
  color: 0.25,
  skinTone: 0.15,
  moire: 0.20,
  localVariance: 0.15,
} as const;

// =============================================================================
// FACE DETECTION THRESHOLDS
// =============================================================================

/** MediaPipe detection confidence threshold. @see demo_local_fast.py line 191 */
export const MIN_DETECTION_CONFIDENCE = 0.5;

/** Minimum face bounding box dimension in pixels. @see demo_local_fast.py line 269 */
export const MIN_FACE_SIZE = 30;

/** Min time between landmark detections in ms. @see demo_local_fast.py line 1377 */
export const LANDMARK_CACHE_INTERVAL = 50;

/** Per-face liveness cache TTL in ms. @see demo_local_fast.py line 2358 */
export const LIVENESS_CACHE_INTERVAL = 1000;

/** Per-face verification cache TTL in ms. @see demo_local_fast.py line 1530 */
export const VERIFY_CACHE_INTERVAL = 2000;

// =============================================================================
// ENROLLMENT THRESHOLDS
// @see demo_local_fast.py lines 1287-1300, 2161-2223
// =============================================================================

/** Max face movement in pixels for stable detection. @see demo_local_fast.py line 1300 */
export const STABILITY_THRESHOLD = 15;

/** Min frames to assess face position stability. @see demo_local_fast.py line 2161 */
export const STABILITY_MIN_FRAMES = 5;

/** Face position history length for stability. @see demo_local_fast.py line 1299 */
export const STABILITY_HISTORY_SIZE = 10;

/** Time to hold pose before capture in seconds. @see demo_local_fast.py line 2212 */
export const HOLD_TO_CAPTURE = 0.8;

/** Cosine similarity threshold for face search/match. @see demo_local_fast.py line 966 */
export const EMBEDDING_THRESHOLD = 0.5;

/** Min quality score for enrollment frame. @see demo_local_fast.py line 2223 */
export const ENROLLMENT_QUALITY_MIN = 65;

/** Max stored embeddings per identity. @see demo_local_fast.py line 961 */
export const MAX_EMBEDDINGS_PER_FACE = 5;

// =============================================================================
// HEAD POSE ESTIMATION CONSTANTS
// @see demo_local_fast.py lines 1415-1440
// =============================================================================

/** Multiplier for yaw calculation: (nose_offset / eye_dist) * 60. @see demo_local_fast.py line 1427 */
export const YAW_SCALE = 60;

/** Multiplier for pitch calculation: (nose_offset / face_h) * 60. @see demo_local_fast.py line 1433 */
export const PITCH_SCALE = 60;

/** Output range limits for yaw. @see demo_local_fast.py line 1435 */
export const YAW_CLAMP: [number, number] = [-45, 45];

/** Output range limits for pitch. @see demo_local_fast.py line 1435 */
export const PITCH_CLAMP: [number, number] = [-35, 35];

/** Minimum landmark count for head pose estimation. @see demo_local_fast.py line 1415 */
export const MIN_LANDMARKS_FOR_POSE = 468;

// =============================================================================
// TRACKER CONSTANTS
// @see demo_local_fast.py lines 987-1047
// =============================================================================

/** Frames before a lost track is removed. @see demo_local_fast.py line 990 */
export const MAX_GONE_FRAMES = 15;

/** Max centroid distance for track matching in pixels. @see demo_local_fast.py line 1028 */
export const MAX_MATCH_DISTANCE = 120;

// =============================================================================
// CARD DETECTION CONSTANTS
// @see demo_local_fast.py lines 1069-1151
// =============================================================================

/** Min YOLO detection confidence for cards. @see demo_local_fast.py line 1151 */
export const CARD_CONFIDENCE = 0.35;

/** YOLO inference image size in pixels. @see demo_local_fast.py line 1151 */
export const CARD_INPUT_SIZE = 640;

/** Temporal smoothing window for card detections. @see demo_local_fast.py line 1069 */
export const SMOOTHING_HISTORY = 5;

/** Min detections in smoothing window to confirm card. @see demo_local_fast.py line 1115 */
export const SMOOTHING_MIN_DETECTIONS = 2;

/** Min time between card detections in ms. @see demo_local_fast.py line 1559 */
export const CARD_CACHE_INTERVAL = 150;

/** CLAHE contrast limiting clip limit. @see demo_local_fast.py line 1100 */
export const CLAHE_CLIP_LIMIT = 2.0;

/** CLAHE tile grid size. @see demo_local_fast.py line 1100 */
export const CLAHE_TILE_SIZE: [number, number] = [8, 8];

/** Default padding ratio for face ROI extraction (30%). */
export const DEFAULT_FACE_ROI_PADDING = 0.3;

// =============================================================================
// MEDIAPIPE FACE MESH LANDMARK INDICES
// @see demo_local_fast.py lines 462-473
// =============================================================================

/**
 * MediaPipe LEFT eye landmark indices (anatomical left = user's right in mirrored view).
 * Order: [outer, upper-outer, upper-inner, inner, lower-inner, lower-outer]
 * Used for EAR: (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * @see demo_local_fast.py line 462
 */
export const LEFT_EYE = [362, 385, 387, 263, 373, 380] as const;

/**
 * MediaPipe RIGHT eye landmark indices (anatomical right = user's left in mirrored view).
 * Order: [outer, upper-outer, upper-inner, inner, lower-inner, lower-outer]
 * @see demo_local_fast.py line 463
 */
export const RIGHT_EYE = [33, 160, 158, 133, 153, 144] as const;

/** Upper lip center landmark. @see demo_local_fast.py line 464 */
export const UPPER_LIP = 13;

/** Lower lip center landmark. @see demo_local_fast.py line 465 */
export const LOWER_LIP = 14;

/** Left mouth corner landmark. @see demo_local_fast.py line 466 */
export const MOUTH_LEFT = 61;

/** Right mouth corner landmark. @see demo_local_fast.py line 467 */
export const MOUTH_RIGHT = 291;

/**
 * MediaPipe LEFT eyebrow landmark indices.
 * @see demo_local_fast.py line 468
 */
export const LEFT_EYEBROW = [70, 63, 105, 66, 107] as const;

/**
 * MediaPipe RIGHT eyebrow landmark indices.
 * @see demo_local_fast.py line 469
 */
export const RIGHT_EYEBROW = [300, 293, 334, 296, 336] as const;

/** MediaPipe LEFT eye iris center. @see demo_local_fast.py line 470 */
export const LEFT_IRIS = 468;

/** MediaPipe RIGHT eye iris center. @see demo_local_fast.py line 471 */
export const RIGHT_IRIS = 473;

/** Nose tip landmark. @see demo_local_fast.py line 472 */
export const NOSE_TIP = 1;

/** Chin landmark. @see demo_local_fast.py line 473 */
export const CHIN = 152;

/** Forehead landmark. */
export const FOREHEAD = 10;

/** Face left contour landmark (for head turn). */
export const FACE_LEFT_CONTOUR = 234;

/** Face right contour landmark (for head turn). */
export const FACE_RIGHT_CONTOUR = 454;

// ===== Head Pose Estimation Reference Landmarks =====
// @see demo_local_fast.py lines 1419-1423

/** Head pose: left eye outer corner. @see demo_local_fast.py line 1420 */
export const HEAD_POSE_LEFT_EYE = 33;

/** Head pose: right eye outer corner. @see demo_local_fast.py line 1421 */
export const HEAD_POSE_RIGHT_EYE = 263;

/** Head pose: left mouth corner. @see demo_local_fast.py line 1422 */
export const HEAD_POSE_LEFT_MOUTH = 61;

/** Head pose: right mouth corner. @see demo_local_fast.py line 1423 */
export const HEAD_POSE_RIGHT_MOUTH = 291;

// =============================================================================
// LANDMARK CONNECTION MAPS (for Rendering / Debug Visualization)
// @see demo_local_fast.py lines 1603-1678 (draw_landmarks)
// @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A
// =============================================================================

/** Face contour connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const FACE_CONTOUR: readonly number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,
];

/** Left eye outline connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const LEFT_EYE_OUTLINE: readonly number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33,
];

/** Right eye outline connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const RIGHT_EYE_OUTLINE: readonly number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263,
];

/** Lips outer contour connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const LIPS_OUTER: readonly number[] = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61,
];

/** Nose bridge connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const NOSE: readonly number[] = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];

/** Left eyebrow outline connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const LEFT_EYEBROW_OUTLINE: readonly number[] = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];

/** Right eyebrow outline connection points. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Appendix A */
export const RIGHT_EYEBROW_OUTLINE: readonly number[] = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];

// =============================================================================
// BACKWARD-COMPATIBLE ALIASES
// These aliases preserve compatibility with pre-existing implementation files.
// =============================================================================

/** @deprecated Use BLUR_THRESHOLD instead. */
export const DEFAULT_BLUR_THRESHOLD = BLUR_THRESHOLD;

/** @deprecated Use QUALITY_MIN_SCORE instead. */
export const MIN_ENROLLMENT_QUALITY = QUALITY_MIN_SCORE;

/** @deprecated Use MIN_FACE_DIM instead. */
export const REFERENCE_FACE_DIMENSION = MIN_FACE_DIM;

/** @deprecated Use MAX_GONE_FRAMES instead. */
export const DEFAULT_MAX_GONE = MAX_GONE_FRAMES;

/** @deprecated Use LIVENESS_THRESHOLD instead. */
export const DEFAULT_LIVENESS_THRESHOLD = LIVENESS_THRESHOLD;

/** @deprecated Use EMBEDDING_THRESHOLD instead. */
export const DEFAULT_EMBEDDING_THRESHOLD = EMBEDDING_THRESHOLD;

/** @deprecated Use NOSE_TIP instead. */
export const POSE_NOSE = NOSE_TIP;

/** @deprecated Use HEAD_POSE_LEFT_EYE instead. */
export const POSE_LEFT_EYE_OUTER = HEAD_POSE_LEFT_EYE;

/** @deprecated Use HEAD_POSE_RIGHT_EYE instead. */
export const POSE_RIGHT_EYE_OUTER = HEAD_POSE_RIGHT_EYE;

/** @deprecated Use HEAD_POSE_LEFT_MOUTH instead. */
export const POSE_MOUTH_LEFT = HEAD_POSE_LEFT_MOUTH;

/** @deprecated Use HEAD_POSE_RIGHT_MOUTH instead. */
export const POSE_MOUTH_RIGHT = HEAD_POSE_RIGHT_MOUTH;

/** @deprecated Use LEFT_IRIS instead. */
export const LEFT_EYE_CENTER = LEFT_IRIS;

/** @deprecated Use RIGHT_IRIS instead. */
export const RIGHT_EYE_CENTER = RIGHT_IRIS;

