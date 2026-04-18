/**
 * BlazeFaceDetector — TensorFlow.js BlazeFace wrapper for on-device face detection.
 *
 * Lightweight alternative to MediaPipe (~1.2MB model vs ~5MB WASM bundle).
 * Returns bounding boxes + 6 keypoints (eyes, ears, nose, mouth).
 * Target: <50ms inference on mid-range devices.
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 * @see https://github.com/nicolo-ribaudo/tensorflow-models/tree/master/blazeface
 */

import type * as blazeface from '@tensorflow-models/blazeface';

/** Single face detection result from BlazeFace. */
export interface BlazeFaceDetection {
  /** Bounding box in pixel coordinates [topLeftX, topLeftY, bottomRightX, bottomRightY]. */
  topLeft: [number, number];
  bottomRight: [number, number];
  /** 6 facial landmarks: right eye, left eye, nose, mouth, right ear, left ear. */
  landmarks: Array<[number, number]>;
  /** Detection probability 0-1. */
  probability: number;
}

/** Normalized bounding box (0-1 range, relative to video dimensions). */
export interface NormalizedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Full detection result with both pixel and normalized coordinates. */
export interface BlazeFaceResult {
  /** Whether at least one face was detected. */
  detected: boolean;
  /** All detected faces. */
  faces: Array<{
    /** Bounding box in normalized coordinates (0-1). */
    boundingBox: NormalizedBoundingBox;
    /** 6 landmarks in normalized coordinates. */
    landmarks: Array<{ x: number; y: number }>;
    /** Detection confidence 0-1. */
    confidence: number;
  }>;
  /** Inference time in milliseconds. */
  inferenceTimeMs: number;
}

/**
 * BlazeFaceDetector wraps @tensorflow-models/blazeface with model caching
 * and performance measurement.
 *
 * Usage:
 *   const detector = new BlazeFaceDetector();
 *   await detector.initialize();
 *   const result = await detector.detect(videoElement);
 *   detector.dispose();
 */
export class BlazeFaceDetector {
  private model: blazeface.BlazeFaceModel | null = null;
  private ready = false;
  private initError: string | null = null;
  private _lastInferenceMs = 0;

  /**
   * Initialize TensorFlow.js backend and load the BlazeFace model.
   * The model is ~1.2MB and cached by the browser after first download.
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic imports to enable tree-shaking and lazy loading.
      // WebGL backend must be imported before any TF operations.
      const tf = await import('@tensorflow/tfjs-core');
      await import('@tensorflow/tfjs-backend-webgl');

      // Set WebGL backend for GPU acceleration
      await tf.setBackend('webgl');
      await tf.ready();

      const blazefaceModule = await import('@tensorflow-models/blazeface');
      this.model = await blazefaceModule.load({
        maxFaces: 5,
      });

      this.ready = true;
      this.initError = null;
    } catch (error: unknown) {
      this.ready = false;
      this.initError =
        error instanceof Error ? error.message : String(error);
      console.warn('[BlazeFace] Initialization failed:', this.initError);
      throw error;
    }
  }

  /**
   * Detect faces in a video frame.
   *
   * @param video - HTMLVideoElement with an active camera stream.
   * @returns Detection result with normalized bounding boxes, landmarks, and timing.
   */
  async detect(video: HTMLVideoElement): Promise<BlazeFaceResult> {
    if (!this.ready || !this.model) {
      return { detected: false, faces: [], inferenceTimeMs: 0 };
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
      return { detected: false, faces: [], inferenceTimeMs: 0 };
    }

    const t0 = performance.now();

    // BlazeFace returns predictions with topLeft, bottomRight, landmarks, probability
    const predictions = await this.model.estimateFaces(video, false);

    const inferenceTimeMs = performance.now() - t0;
    this._lastInferenceMs = inferenceTimeMs;

    if (!predictions || predictions.length === 0) {
      return { detected: false, faces: [], inferenceTimeMs };
    }

    const faces = predictions.map((pred) => {
      // Extract coordinates -- BlazeFace returns number[][] or Tensor
      const topLeft = pred.topLeft as unknown as number[];
      const bottomRight = pred.bottomRight as unknown as number[];
      const rawLandmarks = pred.landmarks as unknown as number[][];
      const probability =
        pred.probability instanceof Float32Array
          ? pred.probability[0]
          : (pred.probability as unknown as number[])[0];

      // Normalize to 0-1 range
      const x = topLeft[0] / videoWidth;
      const y = topLeft[1] / videoHeight;
      const width = (bottomRight[0] - topLeft[0]) / videoWidth;
      const height = (bottomRight[1] - topLeft[1]) / videoHeight;

      const landmarks = rawLandmarks.map((lm: number[]) => ({
        x: lm[0] / videoWidth,
        y: lm[1] / videoHeight,
      }));

      return {
        boundingBox: { x, y, width, height },
        landmarks,
        confidence: probability,
      };
    });

    return { detected: true, faces, inferenceTimeMs };
  }

  /**
   * Release all TensorFlow.js tensors and model resources.
   */
  dispose(): void {
    if (this.model) {
      // BlazeFace model does not have an explicit dispose, but we null the reference
      // so it can be GC'd. TF.js tensors are managed automatically.
      this.model = null;
    }
    this.ready = false;
  }

  /** Whether the model is loaded and ready for detection. */
  isReady(): boolean {
    return this.ready;
  }

  /** Initialization error message, or null if init succeeded. */
  getError(): string | null {
    return this.initError;
  }

  /** Last inference time in milliseconds. */
  getLastInferenceMs(): number {
    return this._lastInferenceMs;
  }
}
