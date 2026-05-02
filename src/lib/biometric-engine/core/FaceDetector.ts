/**
 * FaceDetector — MediaPipe FaceLandmarker wrapper for browser-side face detection.
 *
 * Wraps @mediapipe/tasks-vision FaceLandmarker (Tasks API, not Solutions API).
 * Returns both bounding box AND 478 landmarks in a single inference pass.
 * Python uses separate detector + FaceMesh; this class combines them.
 *
 * @see demo_local_fast.py lines 144-325 (FastFaceDetector)
 * @see auth-test/app.js lines 462-479 (existing browser MediaPipe init)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5e
 */

import type { IFaceDetector } from '../interfaces';
import type {
  FaceDetection,
  BoundingBox,
  NormalizedLandmark,
  PixelLandmark,
} from '../types';
import { MEDIAPIPE_VISION_BUNDLE_URL, MEDIAPIPE_WASM_URL } from '../../../config/cdn';

/**
 * CDN URL for the MediaPipe Tasks Vision WASM bundle.
 * Using CDN dynamic import to avoid bundling ~5MB of WASM files.
 * Sourced from `src/config/cdn.ts` so the prefetch in `index.html` and
 * this runtime loader stay version-locked (Copilot post-merge round 8).
 * @see auth-test/app.js line 464
 */
const VISION_CDN_URL = MEDIAPIPE_VISION_BUNDLE_URL;

/**
 * CDN URL for the MediaPipe WASM fileset (loaded by FilesetResolver).
 * @see auth-test/app.js line 468
 */
const WASM_CDN_URL = MEDIAPIPE_WASM_URL;

/**
 * Google Storage URL for the FaceLandmarker model.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5e, lines 700-713
 */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class FaceDetector implements IFaceDetector {
  /**
   * MediaPipe FaceLandmarker instance.
   * Typed as `any` because we dynamically import from CDN at runtime,
   * so compile-time types are not available.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private landmarker: any = null;

  /** Whether the landmarker is loaded and ready for detection. */
  private ready: boolean = false;

  /** Initialization error message, if any. */
  private initError: string | null = null;

  /**
   * Initialize the MediaPipe FaceLandmarker.
   *
   * 1. Dynamically import @mediapipe/tasks-vision from CDN
   * 2. Create FilesetResolver for WASM
   * 3. Create FaceLandmarker with GPU delegate (WASM fallback)
   * 4. Set running mode to VIDEO for continuous detection
   *
   * @see demo_local_fast.py lines 166-196 (FastFaceDetector._load_detector)
   * @see auth-test/app.js lines 462-479 (browser MediaPipe init)
   * @throws Rejects with error message on initialization failure
   */
  async initialize(): Promise<void> {
    try {
      // Step 1: Dynamically import MediaPipe Tasks Vision from CDN
      // Using CDN import to avoid bundling ~5MB of WASM files
      // @see auth-test/app.js line 464
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vision: any = await import(/* @vite-ignore */ VISION_CDN_URL);

      const FilesetResolver = vision.FilesetResolver;
      const FaceLandmarker = vision.FaceLandmarker;

      // Step 2: Create FilesetResolver for vision WASM tasks
      // @see auth-test/app.js lines 467-469
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN_URL);

      // Step 3: Create FaceLandmarker with options matching Python config
      // @see demo_local_fast.py lines 189-193 (min_detection_confidence=0.5)
      // @see auth-test/app.js lines 470-479
      // @see BIOMETRIC_ENGINE_ARCHITECTURE.md lines 704-713
      try {
        // Try GPU delegate first (preferred for performance)
        this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 5, // Python: max_num_faces=5
          minFaceDetectionConfidence: 0.5, // Python line 191
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false, // Not needed for detection
          outputFacialTransformationMatrixes: false, // Not needed
        });
      } catch {
        // GPU delegate failed — fallback to CPU/WASM
        // @see demo_local_fast.py line 210 (fallback pattern)
        console.warn(
          '[FaceDetector] GPU delegate unavailable, falling back to CPU',
        );
        this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 5,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      }

      this.ready = true;
      this.initError = null;
    } catch (error: unknown) {
      // @see demo_local_fast.py lines 209-210 (error handling with fallback warning)
      this.ready = false;
      this.initError =
        error instanceof Error ? error.message : String(error);
      console.warn(
        '[FaceDetector] Initialization failed:',
        this.initError,
      );
      throw error;
    }
  }

  /**
   * Detect faces in a video frame and return 478-point landmarks.
   *
   * Uses MediaPipe FaceLandmarker in VIDEO running mode.
   * Returns both detection bounding box AND landmarks in a single pass.
   *
   * For each detected face:
   * 1. Extract 478 normalized landmarks
   * 2. Compute bounding box from landmark min/max (scaled to video dimensions)
   * 3. Convert normalized landmarks to pixel coordinates
   * 4. Return FaceDetection with id=-1 (tracker assigns real IDs later)
   *
   * @see demo_local_fast.py lines 239-325 (FastFaceDetector.detect)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5e
   *
   * @param video - HTMLVideoElement with active camera stream
   * @param timestamp - performance.now() for VIDEO mode temporal tracking
   * @returns Array of FaceDetection with id=-1
   */
  detect(video: HTMLVideoElement, timestamp: number): FaceDetection[] {
    if (!this.ready || !this.landmarker) {
      return [];
    }

    // Call MediaPipe FaceLandmarker.detectForVideo()
    // @see auth-test/app.js — detectFaceLoop()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = this.landmarker.detectForVideo(video, timestamp);

    if (
      !result ||
      !result.faceLandmarks ||
      result.faceLandmarks.length === 0
    ) {
      return [];
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const detections: FaceDetection[] = [];

    // Process each detected face
    // @see demo_local_fast.py lines 249-274 (per-face processing)
    for (let i = 0; i < result.faceLandmarks.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawLandmarks: any[] = result.faceLandmarks[i];

      if (!rawLandmarks || rawLandmarks.length === 0) {
        continue;
      }

      // Extract 478 normalized landmarks
      const landmarks478: NormalizedLandmark[] = rawLandmarks.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lm: any) => ({
          x: lm.x as number,
          y: lm.y as number,
          z: (lm.z ?? 0) as number,
        }),
      );

      // Compute bounding box from landmarks (min/max x,y scaled to video dimensions)
      // @see demo_local_fast.py lines 256-268 (bbox computation from detection)
      const boundingBox = this.computeBoundingBox(
        landmarks478,
        videoWidth,
        videoHeight,
      );

      // Skip faces that are too small (< 30px in either dimension)
      // @see demo_local_fast.py line 269 (if fw > 30 and fh > 30)
      if (boundingBox.width < 30 || boundingBox.height < 30) {
        continue;
      }

      // Compute confidence
      // FaceLandmarker doesn't expose per-face detection score directly.
      // Use faceBlendshapes score if available, otherwise default to 0.95.
      // @see demo_local_fast.py line 273 (confidence from detection.categories[0].score)
      let confidence = 0.95;
      if (
        result.faceBlendshapes &&
        result.faceBlendshapes[i] &&
        result.faceBlendshapes[i].length > 0
      ) {
        confidence = result.faceBlendshapes[i][0].score ?? 0.95;
      }

      // Convert normalized landmarks to pixel coordinates
      // @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5e
      const pixelLandmarks: PixelLandmark[] = landmarks478.map((lm) => ({
        x: lm.x * videoWidth,
        y: lm.y * videoHeight,
      }));

      detections.push({
        id: -1, // Tracker assigns real IDs later
        boundingBox,
        confidence,
        landmarks478,
        pixelLandmarks,
      });
    }

    return detections;
  }

  /**
   * Release MediaPipe FaceLandmarker resources.
   *
   * @see demo_local_fast.py — cleanup / destructor pattern
   */
  dispose(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // Ignore close errors during cleanup
      }
      this.landmarker = null;
    }
    this.ready = false;
  }

  /**
   * Check if the FaceLandmarker is loaded and ready for detection.
   *
   * @returns true if initialize() succeeded and dispose() has not been called
   */
  isAvailable(): boolean {
    return this.ready;
  }

  /**
   * Get the initialization error message, if any.
   *
   * @returns Error message string, or null if initialization succeeded or hasn't been attempted
   */
  getError(): string | null {
    return this.initError;
  }

  /**
   * Compute a bounding box from normalized landmarks, scaled to video dimensions.
   *
   * Finds the min/max x,y across all 478 landmarks and converts to pixel coordinates.
   * Adds a small padding (5%) to avoid cutting off face edges.
   *
   * @see demo_local_fast.py lines 256-268 (bbox clamping to frame bounds)
   *
   * @param landmarks - Array of 478 normalized landmarks
   * @param videoWidth - Video frame width in pixels
   * @param videoHeight - Video frame height in pixels
   * @returns BoundingBox in pixel coordinates
   */
  private computeBoundingBox(
    landmarks: NormalizedLandmark[],
    videoWidth: number,
    videoHeight: number,
  ): BoundingBox {
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;

    for (const lm of landmarks) {
      if (lm.x < minX) minX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y > maxY) maxY = lm.y;
    }

    // Add 5% padding around the face
    const padX = (maxX - minX) * 0.05;
    const padY = (maxY - minY) * 0.05;

    // Clamp to frame bounds (0-1 normalized range)
    // @see demo_local_fast.py lines 263-266 (clamping)
    const x = Math.max(0, minX - padX);
    const y = Math.max(0, minY - padY);
    const right = Math.min(1, maxX + padX);
    const bottom = Math.min(1, maxY + padY);

    return {
      x: Math.round(x * videoWidth),
      y: Math.round(y * videoHeight),
      width: Math.round((right - x) * videoWidth),
      height: Math.round((bottom - y) * videoHeight),
    };
  }
}
