/**
 * HandGestureDetector — Client-side hand-landmark extraction for Gesture Liveness.
 *
 * Phase 2 of the gesture liveness pipeline. Wraps `@mediapipe/tasks-vision`
 * HandLandmarker, lazily loaded on first `init()` so the ~137KB WASM chunk
 * stays off the eager auth bundle.
 *
 * IMPORTANT — per the ML split contract (D1-D4):
 *   - The client extracts the 21 MediaPipe hand landmarks (x, y, z) per frame.
 *   - A light-weight local hint is computed (fingersUp / open-hand / confidence)
 *     purely for UX — it is NEVER trusted by the server.
 *   - The SERVER re-verifies geometry from the landmarks it receives. The
 *     client's gesture classification is advisory only.
 *   - No raw frames leave the device. Landmarks + anti-spoof telemetry only.
 *
 * The detector is framework-agnostic; React wiring lives in
 * `../hooks/useHandGestureDetection.ts`.
 *
 * @see biometric-processor PR #50 for the server-side verifier.
 */

// Type-only imports — the runtime module is loaded lazily inside init().
import type {
  HandLandmarker,
  HandLandmarkerResult,
  NormalizedLandmark as MpNormalizedLandmark,
} from '@mediapipe/tasks-vision';

/**
 * One of the nine server-defined gesture challenge types.
 * Mirrors the enum values produced by
 * `POST /api/v1/liveness/active/gesture/start`.
 */
export type GestureChallengeType =
  | 'FINGER_COUNT'
  | 'SHAPE_TRACE'
  | 'WAVE'
  | 'HAND_FLIP'
  | 'FINGER_TAP'
  | 'PINCH'
  | 'PEEK_A_BOO'
  | 'MATH'
  | 'TRACE_TEMPLATE';

/**
 * Normalized landmark (0–1 range for x/y, relative depth for z).
 * Identical shape to MediaPipe's `NormalizedLandmark` — declared locally so
 * consumers don't need to import from `@mediapipe/tasks-vision`.
 */
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Passive anti-spoof signals derived from the last N frames. The server
 * uses these alongside its own geometry re-verification.
 */
export interface AntiSpoofTelemetry {
  /** Variance of wrist-landmark displacement over the recent window. */
  tremorVariance: number;
  /** Standard deviation of mean frame luminance over the recent window. */
  brightnessStdDev: number;
  /** Measured frames-per-second of the detection loop. */
  frameRate: number;
}

/**
 * Result returned by `detectFrame()`. All fields are optional because the
 * loop tolerates frames where no hand is visible.
 */
export interface HandDetectionResult {
  /** True when at least one hand with >=21 landmarks was detected. */
  detected: boolean;
  /** 21 landmarks for the primary hand, or null when no hand is visible. */
  landmarks: HandLandmark[] | null;
  /** Client-side advisory classification of the currently visible gesture. */
  gesture: GestureChallengeType | null;
  /** Confidence of the client-side classification in the range 0–1. */
  confidence: number;
  /** Localization key used for UX hints (e.g. "liveness.gesture.noHand"). */
  hint: string;
  /** Passive anti-spoof signals to be relayed to the server. */
  antiSpoof: AntiSpoofTelemetry;
  /** How long the MediaPipe call took, in milliseconds. */
  inferenceTimeMs: number;
}

/** Ring-buffer size used for tremor + brightness statistics. */
const TELEMETRY_WINDOW = 30;

/** Minimum fingers-up value we expect for any finger-count challenge. */
const MIN_FINGER_COUNT = 0;
const MAX_FINGER_COUNT = 5;

/**
 * Returns whether a given finger tip is higher on the frame than its PIP joint.
 * (Remember: y grows downward in image coordinates.)
 */
function isFingerExtended(tip: HandLandmark, pip: HandLandmark): boolean {
  return tip.y < pip.y;
}

/**
 * Thumb uses x (horizontal displacement) instead of y because it moves
 * laterally when extended, regardless of hand orientation.
 */
function isThumbExtended(
  tip: HandLandmark,
  mcp: HandLandmark,
  wrist: HandLandmark,
): boolean {
  // Dominant hand or flipped — distance from wrist on the x axis is the
  // most robust cue that the thumb is out from the palm.
  return Math.abs(tip.x - mcp.x) > Math.abs(mcp.x - wrist.x) * 0.6;
}

/**
 * Counts the number of extended fingers from the 21 MediaPipe landmarks.
 * Index mapping: 0 = wrist, 4/8/12/16/20 = finger tips.
 */
function countExtendedFingers(lm: HandLandmark[]): number {
  if (lm.length < 21) return 0;

  const wrist = lm[0];
  let count = 0;

  if (isThumbExtended(lm[4], lm[2], wrist)) count++;
  if (isFingerExtended(lm[8], lm[6])) count++;
  if (isFingerExtended(lm[12], lm[10])) count++;
  if (isFingerExtended(lm[16], lm[14])) count++;
  if (isFingerExtended(lm[20], lm[18])) count++;

  return Math.max(MIN_FINGER_COUNT, Math.min(MAX_FINGER_COUNT, count));
}

/**
 * Euclidean distance between two landmarks in normalized space.
 */
function distance(a: HandLandmark, b: HandLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Very small set of heuristics used to *hint* the user whether they are on
 * the right track. Server remains the source of truth.
 */
function classifyGesture(
  lm: HandLandmark[],
  expected: GestureChallengeType | null,
): { gesture: GestureChallengeType | null; confidence: number } {
  if (lm.length < 21) return { gesture: null, confidence: 0 };

  const fingers = countExtendedFingers(lm);
  const thumbIndex = distance(lm[4], lm[8]);

  // Pinch: thumb + index tips within a small normalized distance.
  if (thumbIndex < 0.05) {
    return { gesture: 'PINCH', confidence: 0.8 };
  }

  // Finger-count style challenges (FINGER_COUNT, MATH, FINGER_TAP default)
  if (
    expected === 'FINGER_COUNT' ||
    expected === 'MATH' ||
    expected === 'FINGER_TAP'
  ) {
    return { gesture: expected, confidence: Math.min(fingers / 5, 1) };
  }

  if (expected) {
    // All other challenges (WAVE, SHAPE_TRACE, HAND_FLIP, PEEK_A_BOO,
    // TRACE_TEMPLATE) need temporal analysis the server handles. We return
    // the expected tag with a neutral confidence so the UI can show "keep
    // going" feedback.
    return { gesture: expected, confidence: 0.5 };
  }

  return { gesture: null, confidence: 0 };
}

/**
 * Rolling-window statistics for passive anti-spoof.
 */
class TelemetryBuffer {
  private wristXs: number[] = [];
  private wristYs: number[] = [];
  private brightness: number[] = [];
  private frameTimes: number[] = [];

  push(lm: HandLandmark[] | null, meanLuma: number): void {
    const now = performance.now();
    this.frameTimes.push(now);
    if (this.frameTimes.length > TELEMETRY_WINDOW) this.frameTimes.shift();

    this.brightness.push(meanLuma);
    if (this.brightness.length > TELEMETRY_WINDOW) this.brightness.shift();

    if (lm && lm.length >= 1) {
      this.wristXs.push(lm[0].x);
      this.wristYs.push(lm[0].y);
      if (this.wristXs.length > TELEMETRY_WINDOW) this.wristXs.shift();
      if (this.wristYs.length > TELEMETRY_WINDOW) this.wristYs.shift();
    }
  }

  snapshot(): AntiSpoofTelemetry {
    const tremorVariance = variance(this.wristXs) + variance(this.wristYs);
    const brightnessStdDev = stddev(this.brightness);

    let frameRate = 0;
    if (this.frameTimes.length >= 2) {
      const spanMs =
        this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
      if (spanMs > 0) {
        frameRate = ((this.frameTimes.length - 1) * 1000) / spanMs;
      }
    }

    return { tremorVariance, brightnessStdDev, frameRate };
  }

  reset(): void {
    this.wristXs = [];
    this.wristYs = [];
    this.brightness = [];
    this.frameTimes = [];
  }
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length
  );
}

function stddev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Estimates mean luminance (Y in BT.601) from an ImageData. Used as the
 * brightness signal for passive anti-spoof.
 */
function meanLuminance(image: ImageData): number {
  const data = image.data;
  // Sample every 16th pixel to keep the cost cheap.
  const stride = 16 * 4;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Client-side hand landmark detector + light advisory classifier.
 *
 * Usage:
 *   const detector = new HandGestureDetector();
 *   await detector.init();
 *   detector.setExpected('FINGER_COUNT');
 *   const result = await detector.detectFrame(imageData);
 *   if (result.detected) {
 *     sendToServer(result.landmarks, result.antiSpoof);
 *   }
 */
export class HandGestureDetector {
  private landmarker: HandLandmarker | null = null;
  private initializing: Promise<void> | null = null;
  private expected: GestureChallengeType | null = null;
  private telemetry = new TelemetryBuffer();
  private disposed = false;

  /**
   * Lazily load the MediaPipe runtime + model. Safe to call multiple times;
   * concurrent callers share the same promise.
   */
  async init(): Promise<void> {
    if (this.landmarker || this.disposed) return;
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      const { HandLandmarker, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      if (this.disposed) return;

      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();

    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  /**
   * Declare the challenge the user is currently being asked to perform.
   * Used solely for UX hinting — server ignores the client gesture label.
   */
  setExpected(gestureType: GestureChallengeType | null): void {
    this.expected = gestureType;
  }

  /**
   * Run one frame through the MediaPipe HandLandmarker. Always resolves —
   * failures are represented by `detected: false`.
   */
  async detectFrame(imageData: ImageData): Promise<HandDetectionResult> {
    if (this.disposed) {
      return this.emptyResult(0);
    }

    if (!this.landmarker) {
      await this.init();
    }

    const luma = meanLuminance(imageData);
    const t0 = performance.now();
    let mpResult: HandLandmarkerResult | null = null;

    try {
      mpResult =
        this.landmarker?.detectForVideo(imageData, t0) ?? null;
    } catch {
      mpResult = null;
    }

    const inferenceTimeMs = performance.now() - t0;

    const lm = extractPrimaryHand(mpResult);
    this.telemetry.push(lm, luma);

    if (!lm) {
      return {
        detected: false,
        landmarks: null,
        gesture: null,
        confidence: 0,
        hint: 'liveness.gesture.hint.noHand',
        antiSpoof: this.telemetry.snapshot(),
        inferenceTimeMs,
      };
    }

    const { gesture, confidence } = classifyGesture(lm, this.expected);

    return {
      detected: true,
      landmarks: lm,
      gesture,
      confidence,
      hint:
        confidence >= 0.75
          ? 'liveness.gesture.hint.hold'
          : 'liveness.gesture.hint.adjust',
      antiSpoof: this.telemetry.snapshot(),
      inferenceTimeMs,
    };
  }

  /**
   * Releases the underlying MediaPipe resources. The instance should be
   * discarded after calling `dispose()`.
   */
  dispose(): void {
    this.disposed = true;
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
    this.telemetry.reset();
  }

  private emptyResult(inferenceTimeMs: number): HandDetectionResult {
    return {
      detected: false,
      landmarks: null,
      gesture: null,
      confidence: 0,
      hint: 'liveness.gesture.hint.noHand',
      antiSpoof: this.telemetry.snapshot(),
      inferenceTimeMs,
    };
  }
}

/**
 * Pulls the 21 landmarks for the first detected hand from a MediaPipe
 * result, or returns null when no hand is present.
 */
function extractPrimaryHand(
  result: HandLandmarkerResult | null,
): HandLandmark[] | null {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return null;
  }
  const first = result.landmarks[0];
  if (!first || first.length < 21) return null;
  return first.map((p: MpNormalizedLandmark) => ({ x: p.x, y: p.y, z: p.z }));
}
