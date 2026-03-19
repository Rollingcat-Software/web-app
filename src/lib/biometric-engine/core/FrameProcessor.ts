/**
 * FrameProcessor — Per-frame detection loop for the biometric engine.
 *
 * Runs a requestAnimationFrame loop that orchestrates face detection, tracking,
 * quality assessment, head pose estimation, and metrics calculation. Emits
 * a FrameResult per frame via callback. Does NOT own any sub-components;
 * they are injected via constructor (DIP).
 *
 * Quality assessment is throttled to every 500ms to avoid performance impact.
 * Head pose and metrics are computed every frame for responsiveness.
 *
 * @see demo_local_fast.py lines 1227-1301 (FastBiometricDemo detection loop)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b
 */

import type {
  IFaceDetector,
  IQualityAssessor,
  IHeadPoseEstimator,
  IFaceTracker,
  IFaceMetricsCalculator,
  IPassiveLivenessDetector,
} from '../interfaces';
import type {
  FrameResult,
  TrackedFace,
  FaceDetection,
  QualityReport,
} from '../types';
import { extractFaceROI } from './image-utils';
import { DEFAULT_FACE_ROI_PADDING } from './constants';

/**
 * Dependencies required by FrameProcessor.
 * All are interfaces, not concrete implementations (DIP).
 */
export interface FrameProcessorDeps {
  faceDetector: IFaceDetector;
  qualityAssessor: IQualityAssessor;
  headPoseEstimator: IHeadPoseEstimator;
  faceTracker: IFaceTracker;
  metricsCalculator: IFaceMetricsCalculator;
  livenessDetector?: IPassiveLivenessDetector;
}

/** Quality assessment throttle interval in milliseconds. */
const QUALITY_THROTTLE_MS = 500;

/**
 * FrameProcessor runs the per-frame detection loop and emits FrameResult.
 *
 * Responsibility: detection loop orchestration only (SRP).
 * Does not manage lifecycle of sub-components.
 *
 * @see demo_local_fast.py lines 1545-1630 (run_enroll mode frame processing)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b
 */
export class FrameProcessor {
  private faceDetector: IFaceDetector;
  private qualityAssessor: IQualityAssessor;
  private headPoseEstimator: IHeadPoseEstimator;
  private faceTracker: IFaceTracker;
  private metricsCalculator: IFaceMetricsCalculator;
  private livenessDetector: IPassiveLivenessDetector | undefined;

  /** requestAnimationFrame handle, or null when stopped. */
  private animFrameId: number | null = null;

  /** Total frames processed since last FPS reset. */
  private frameCount: number = 0;

  /** Timestamp (ms) of the last FPS calculation window start. */
  private fpsStart: number = 0;

  /** Current computed FPS. @see demo_local_fast.py lines 1245-1246 */
  private _fps: number = 0;

  /** Whether the loop is currently running. */
  private _running: boolean = false;

  /**
   * Per-face quality cache: maps face tracker ID to last quality report + timestamp.
   * Quality is throttled to every QUALITY_THROTTLE_MS to save CPU.
   * @see demo_local_fast.py lines 1265-1268 (caching intervals)
   */
  private qualityCache: Map<number, { report: QualityReport; time: number }> =
    new Map();

  constructor(deps: FrameProcessorDeps) {
    this.faceDetector = deps.faceDetector;
    this.qualityAssessor = deps.qualityAssessor;
    this.headPoseEstimator = deps.headPoseEstimator;
    this.faceTracker = deps.faceTracker;
    this.metricsCalculator = deps.metricsCalculator;
    this.livenessDetector = deps.livenessDetector;
  }

  /**
   * Start the continuous detection loop using requestAnimationFrame.
   * Each frame calls processFrame() and emits the result via onFrame callback.
   *
   * @param video - The HTMLVideoElement to process frames from.
   * @param onFrame - Callback invoked each frame with the detection result.
   *
   * @see demo_local_fast.py line 1507 (main loop start)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b (start/stop API)
   */
  start(
    video: HTMLVideoElement,
    onFrame: (result: FrameResult) => void,
  ): void {
    if (this._running) return;

    this._running = true;
    this.frameCount = 0;
    this.fpsStart = performance.now();
    this.qualityCache.clear();

    const loop = (): void => {
      if (!this._running) return;

      const result = this.processFrame(video);
      onFrame(result);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stop the detection loop and cancel the pending animation frame.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b
   */
  stop(): void {
    this._running = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.qualityCache.clear();
  }

  /**
   * Whether the detection loop is currently running.
   */
  isRunning(): boolean {
    return this._running;
  }

  /**
   * Current frames per second.
   * @see demo_local_fast.py lines 1245-1246 (frame_times deque)
   */
  getFps(): number {
    return this._fps;
  }

  /**
   * Process a single video frame. Can be called manually or by the rAF loop.
   *
   * Pipeline per frame:
   * 1. FaceDetector.detect(video, timestamp)           ~15-25ms
   * 2. FaceTracker.update(detections)                   ~1ms
   * 3. For each tracked face:
   *    a. FaceMetricsCalculator.calculateAll(landmarks)  ~1ms
   *    b. HeadPoseEstimator.estimate(pixelLandmarks)     ~2ms
   *    c. QualityAssessor.assess(faceROI) — throttled    ~5-10ms
   *    d. PassiveLivenessDetector.check(faceROI) — opt   ~3-5ms
   * 4. Compute FPS
   * 5. Return FrameResult
   *
   * @see demo_local_fast.py lines 1545-1630 (per-frame processing)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 2 (Data Flow diagram)
   *
   * @param video - The HTMLVideoElement to extract the current frame from.
   * @returns FrameResult with all tracked faces and their computed metrics.
   */
  processFrame(video: HTMLVideoElement): FrameResult {
    const now = performance.now();
    const timestamp = now;

    // --- Step 1: Face detection ---
    let detections: FaceDetection[] = [];
    if (this.faceDetector.isAvailable()) {
      try {
        detections = this.faceDetector.detect(video, timestamp);
      } catch {
        // Graceful degradation: detection failure yields empty frame
        detections = [];
      }
    }

    // --- Step 2: Face tracking (assigns stable IDs) ---
    let trackedMap: Map<number, FaceDetection>;
    if (this.faceTracker.isAvailable()) {
      trackedMap = this.faceTracker.update(detections);
    } else {
      // Fallback: use raw detections with their existing IDs
      trackedMap = new Map(detections.map((d) => [d.id, d]));
    }

    // --- Step 3: Per-face metrics, quality, head pose ---
    const faces: TrackedFace[] = [];

    for (const [id, detection] of trackedMap) {
      const tracked: TrackedFace = {
        id,
        detection,
        quality: null,
        liveness: null,
        headPose: null,
        metrics: null,
      };

      const landmarks = detection.landmarks478;
      const pixelLandmarks = detection.pixelLandmarks;
      const hasLandmarks = landmarks && landmarks.length > 0;

      // 3a. Face metrics (every frame) — EAR, MAR, smile, eyebrow
      if (hasLandmarks) {
        try {
          tracked.metrics = this.metricsCalculator.calculateAll(landmarks);
        } catch {
          tracked.metrics = null;
        }
      }

      // 3b. Head pose estimation (every frame)
      if (
        pixelLandmarks &&
        pixelLandmarks.length > 0 &&
        this.headPoseEstimator.isAvailable()
      ) {
        try {
          tracked.headPose = this.headPoseEstimator.estimate(pixelLandmarks, {
            width: video.videoWidth || video.width,
            height: video.videoHeight || video.height,
          });
        } catch {
          tracked.headPose = null;
        }
      }

      // 3c. Quality assessment (throttled to every 500ms)
      if (this.qualityAssessor.isAvailable()) {
        const cached = this.qualityCache.get(id);
        if (cached && now - cached.time < QUALITY_THROTTLE_MS) {
          tracked.quality = cached.report;
        } else {
          try {
            const faceROI = extractFaceROI(
              video,
              detection.boundingBox,
              DEFAULT_FACE_ROI_PADDING,
            );
            if (faceROI) {
              const report = this.qualityAssessor.assess(faceROI);
              tracked.quality = report;
              this.qualityCache.set(id, { report, time: now });
            }
          } catch {
            tracked.quality = cached?.report ?? null;
          }
        }
      }

      // 3d. Passive liveness detection (optional, throttled with quality)
      if (this.livenessDetector?.isAvailable()) {
        try {
          const faceROI = extractFaceROI(
            video,
            detection.boundingBox,
            DEFAULT_FACE_ROI_PADDING,
          );
          if (faceROI) {
            tracked.liveness = this.livenessDetector.check(faceROI);
          }
        } catch {
          tracked.liveness = null;
        }
      }

      faces.push(tracked);
    }

    // --- Step 4: FPS computation ---
    this.updateFps(now);

    // --- Step 5: Emit result ---
    return {
      faces,
      fps: this._fps,
      timestamp,
    };
  }

  /**
   * Update FPS counter. Resets every second.
   * @see demo_local_fast.py lines 1245-1246 (frame_times deque)
   */
  private updateFps(now: number): void {
    this.frameCount++;

    const elapsed = now - this.fpsStart;
    if (elapsed >= 1000) {
      this._fps = Math.round((this.frameCount / elapsed) * 1000);
      this.frameCount = 0;
      this.fpsStart = now;
    }
  }
}
