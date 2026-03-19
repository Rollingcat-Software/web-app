/**
 * Biometric Engine — EmbeddingComputer
 *
 * ONNX Runtime Web wrapper for MobileFaceNet face embedding extraction.
 * Dynamically imports onnxruntime-web to avoid bundling ~5MB WASM at build time.
 * Includes a geometry-based fallback for when the ONNX model is unavailable.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5k
 * @see demo_local_fast.py lines 1192-1220 (EmbeddingExtractor)
 */

import type { IEmbeddingComputer } from '../interfaces';
import type { NormalizedLandmark } from '../types';

/**
 * Key landmark indices for geometry-based embedding.
 * Selected to capture face shape: eyes, nose, mouth, chin, eyebrows, contour.
 * 32 landmarks chosen for a balanced representation of facial structure.
 *
 * @see MediaPipe FaceMesh 478-landmark model
 */
const GEOMETRY_LANDMARKS: readonly number[] = [
  // Eyes (8 points)
  33, 133, 362, 263,   // outer/inner corners of both eyes
  159, 145,            // upper/lower of right eye
  386, 374,            // upper/lower of left eye
  // Eyebrows (8 points)
  70, 63, 105, 107,    // left eyebrow
  300, 293, 334, 336,  // right eyebrow
  // Nose (4 points)
  1, 4, 5, 6,          // tip, bridge points
  // Mouth (6 points)
  61, 291,             // corners
  13, 14,              // upper/lower lip center
  78, 308,             // inner corners
  // Contour (6 points)
  10, 152,             // forehead, chin
  234, 454,            // left/right contour
  127, 356,            // jaw points
] as const;

/**
 * Dimension of the geometry-based fallback embedding.
 * Computed from pairwise distances of 32 landmarks: C(32,2) = 496.
 * Padded to 512 for alignment with auth-test's existing approach.
 */
const GEOMETRY_EMBEDDING_DIM = 512;

/**
 * MobileFaceNet input dimensions.
 * @see MobileFaceNet architecture — 112x112 RGB input
 */
const MODEL_INPUT_SIZE = 112;

/**
 * Face embedding extraction via ONNX Runtime Web (MobileFaceNet).
 *
 * Primary mode: loads a MobileFaceNet ONNX model for high-quality 128-dim
 * face embeddings. Falls back to geometry-based embeddings from landmarks
 * when the ONNX model is unavailable or fails to load.
 *
 * The ONNX Runtime Web dependency is loaded via dynamic import to avoid
 * bundling the ~5MB WASM runtime at build time.
 *
 * @example
 * ```typescript
 * const computer = new EmbeddingComputer();
 * await computer.initialize('/models/mobilefacenet.onnx');
 *
 * if (computer.isAvailable()) {
 *   const embedding = await computer.extract(faceImageData);
 *   if (embedding) {
 *     const similarity = EmbeddingComputer.cosineSimilarity(embedding, stored);
 *     console.log(`Match: ${similarity > 0.5}`);
 *   }
 * }
 * ```
 */
export class EmbeddingComputer implements IEmbeddingComputer {
  /** ONNX Runtime InferenceSession instance. Typed as `any` to avoid bundling ort types. */
  private session: any = null;

  /** Whether the model is loaded and ready for inference. */
  private ready: boolean = false;

  /** Error message if initialization failed. */
  private initError: string | null = null;

  /**
   * Initialize ONNX Runtime Web with a MobileFaceNet model.
   *
   * Dynamically imports 'onnxruntime-web' to avoid bundling the ~5MB WASM
   * runtime at build time. The model is loaded from the provided URL
   * (typically a path in the public directory or a CDN URL).
   *
   * Model input:  [1, 3, 112, 112] float32 RGB normalized to [0, 1]
   * Model output: [1, 128] float32 embedding vector
   *
   * @param modelUrl - URL or path to the MobileFaceNet ONNX model file
   * @throws Sets initError on failure (does not throw — caller checks isAvailable)
   *
   * @see demo_local_fast.py lines 1192-1202: EmbeddingExtractor.__init__()
   */
  async initialize(modelUrl: string): Promise<void> {
    try {
      // Dynamic import to avoid bundling ~5MB WASM at build time.
      // onnxruntime-web is an optional peer dependency — not installed at dev time.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — onnxruntime-web is loaded at runtime, not bundled
      const ort = await import('onnxruntime-web');

      // Configure WASM execution provider
      ort.env.wasm.numThreads = 1;

      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.ready = true;
      this.initError = null;
    } catch (err) {
      this.ready = false;
      this.initError = err instanceof Error ? err.message : String(err);
    }
  }

  /**
   * Extract a 128-dim face embedding from an ImageData face crop.
   *
   * Pre-processing pipeline:
   * 1. Resize face to 112x112 using an offscreen canvas (bilinear interpolation)
   * 2. Convert RGBA pixels to RGB float32 normalized to [0, 1]
   * 3. Transpose from HWC to NCHW layout: [1, 3, 112, 112]
   *
   * Post-processing:
   * 1. Read output tensor [1, 128]
   * 2. L2-normalize the embedding vector
   *
   * @param faceImageData - Face region as ImageData (any size, will be resized)
   * @returns 128-dim Float32Array embedding, or null if extraction fails
   *
   * @see demo_local_fast.py lines 1204-1220: EmbeddingExtractor.extract()
   */
  async extract(faceImageData: ImageData): Promise<Float32Array | null> {
    if (!this.ready || !this.session) {
      return null;
    }

    try {
      // Dynamic import for Tensor constructor
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — onnxruntime-web is loaded at runtime, not bundled
      const ort = await import('onnxruntime-web');

      // Step 1: Resize to 112x112 using offscreen canvas
      const resized = this.resizeTo112(faceImageData);
      if (!resized) return null;

      // Step 2-3: Convert to NCHW float32 [1, 3, 112, 112]
      const inputTensor = this.imageDataToNCHW(resized, ort);

      // Step 4: Run inference
      const inputName = this.session.inputNames[0];
      const feeds: Record<string, any> = {};
      feeds[inputName] = inputTensor;
      const results = await this.session.run(feeds);

      // Step 5: Extract output embedding
      const outputName = this.session.outputNames[0];
      const outputData = results[outputName].data as Float32Array;

      // Step 6: L2-normalize
      return EmbeddingComputer.l2Normalize(outputData);
    } catch {
      return null;
    }
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   *
   * cosine_similarity = (a . b) / (||a|| * ||b||)
   *
   * If both vectors are L2-normalized (as our extract() returns), this simplifies
   * to just the dot product. We compute the full formula for safety.
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity in range [-1, 1]. Typical match threshold: 0.5
   *
   * @see demo_local_fast.py lines 966-980: FaceDB.search() — cosine similarity matching
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Compute a geometry-based embedding from facial landmarks.
   *
   * Fallback method when the ONNX neural model is unavailable.
   * Uses pairwise Euclidean distances between 32 key facial landmarks
   * to create a 512-dim feature vector (496 pairwise distances + 16 padding zeros).
   *
   * The landmarks are selected to capture face shape: eyes, eyebrows, nose,
   * mouth, chin, and face contour. The resulting vector is L2-normalized
   * to enable cosine similarity comparison.
   *
   * Quality is lower than neural embeddings but requires no ONNX model download.
   * This matches the auth-test page's existing 512-dim landmark geometry approach.
   *
   * @param landmarks - MediaPipe 478 normalized landmarks (0-1 range for x, y, z)
   * @returns 512-dim Float32Array embedding, L2-normalized
   */
  static geometryEmbedding(landmarks: NormalizedLandmark[]): Float32Array {
    if (!landmarks || landmarks.length < 468) {
      return new Float32Array(GEOMETRY_EMBEDDING_DIM);
    }

    // Extract the 32 key landmarks
    const keyPoints: Array<{ x: number; y: number; z: number }> = [];
    for (const idx of GEOMETRY_LANDMARKS) {
      if (idx < landmarks.length) {
        keyPoints.push(landmarks[idx]);
      } else {
        keyPoints.push({ x: 0, y: 0, z: 0 });
      }
    }

    // Compute all pairwise 3D Euclidean distances
    // C(32, 2) = 496 pairs
    const embedding = new Float32Array(GEOMETRY_EMBEDDING_DIM);
    let dimIdx = 0;

    for (let i = 0; i < keyPoints.length; i++) {
      for (let j = i + 1; j < keyPoints.length; j++) {
        const dx = keyPoints[i].x - keyPoints[j].x;
        const dy = keyPoints[i].y - keyPoints[j].y;
        const dz = keyPoints[i].z - keyPoints[j].z;
        embedding[dimIdx++] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    }

    // Remaining 16 dimensions are zero-padded (496 → 512)
    // L2-normalize the full vector
    return EmbeddingComputer.l2Normalize(embedding);
  }

  /**
   * Release ONNX session resources.
   * Call this when the embedding computer is no longer needed.
   */
  dispose(): void {
    if (this.session) {
      this.session.release?.();
      this.session = null;
    }
    this.ready = false;
  }

  /**
   * Whether the ONNX model is loaded and ready for inference.
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

  // ===== Private Helpers =====

  /**
   * Resize an ImageData to 112x112 using an offscreen canvas.
   * The browser's canvas drawImage handles bilinear interpolation.
   *
   * @param imageData - Source face image at any resolution
   * @returns 112x112 ImageData, or null if canvas context fails
   */
  private resizeTo112(imageData: ImageData): ImageData | null {
    // Create source canvas with original image
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return null;
    srcCtx.putImageData(imageData, 0, 0);

    // Create destination canvas at model input size
    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = MODEL_INPUT_SIZE;
    dstCanvas.height = MODEL_INPUT_SIZE;
    const dstCtx = dstCanvas.getContext('2d');
    if (!dstCtx) return null;

    // Draw with browser bilinear interpolation
    dstCtx.drawImage(srcCanvas, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    return dstCtx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  }

  /**
   * Convert 112x112 ImageData (RGBA HWC) to NCHW float32 tensor.
   *
   * Layout transformation: [112, 112, 4 (RGBA)] → [1, 3 (RGB), 112, 112]
   * Pixel values normalized from [0, 255] to [0.0, 1.0].
   *
   * @param imageData - 112x112 ImageData
   * @param ort - ONNX Runtime module (dynamically imported)
   * @returns ONNX Tensor of shape [1, 3, 112, 112]
   */
  private imageDataToNCHW(imageData: ImageData, ort: any): any {
    const { data } = imageData;
    const pixelCount = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
    const floats = new Float32Array(3 * pixelCount);

    // Channel-first layout: all R values, then all G, then all B
    for (let i = 0; i < pixelCount; i++) {
      const rgbaOffset = i * 4;
      floats[i] = data[rgbaOffset] / 255;                         // R channel
      floats[pixelCount + i] = data[rgbaOffset + 1] / 255;        // G channel
      floats[2 * pixelCount + i] = data[rgbaOffset + 2] / 255;    // B channel
    }

    return new ort.Tensor('float32', floats, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  }

  /**
   * L2-normalize a vector in-place.
   *
   * Divides each element by the L2 norm (Euclidean length) of the vector.
   * Returns a zero vector if the input norm is zero.
   *
   * @param vec - Input vector (modified in-place and returned)
   * @returns The same Float32Array, now unit-length
   */
  private static l2Normalize(vec: Float32Array): Float32Array {
    let normSq = 0;
    for (let i = 0; i < vec.length; i++) {
      normSq += vec[i] * vec[i];
    }

    const norm = Math.sqrt(normSq);
    if (norm === 0) return vec;

    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }

    return vec;
  }
}
