/**
 * Biometric Engine — EmbeddingComputer
 *
 * Produces 512-dim log-only embedding from MediaPipe landmark geometry (decision D2).
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
 * Dimension of the geometry-based embedding.
 * Computed from pairwise distances of 32 landmarks: C(32,2) = 496.
 * Padded to 512 for alignment with the auth-test page's existing approach.
 */
const GEOMETRY_EMBEDDING_DIM = 512;

/**
 * Face embedding extraction from MediaPipe landmark geometry.
 *
 * Landmark-geometry is the **sole** client embedding source per decision D2.
 * The resulting 512-dim vector is log-only telemetry — the server never trusts
 * it for auth. Server-side DeepFace Facenet512 remains the sole trusted
 * embedding for authentication decisions.
 *
 * The neural MobileFaceNet ONNX path was deprecated on 2026-04-18: it added
 * ~4.9 MB download + ONNX Runtime startup overhead for zero functional value
 * (client embedding is log-only, and MediaPipe pre-filter already runs
 * independently for quality, liveness, and face detection).
 *
 * @example
 * ```typescript
 * const vec = EmbeddingComputer.geometryEmbedding(landmarks);
 * const similarity = EmbeddingComputer.cosineSimilarity(vec, stored);
 * ```
 */
export class EmbeddingComputer implements IEmbeddingComputer {
  /** Always ready — no async model load required. */
  private ready: boolean = true;

  /** Cached landmarks from the most recent frame, consumed by {@link extract}. */
  private latestLandmarks: NormalizedLandmark[] | null = null;

  /**
   * No-op initializer preserved for interface compatibility.
   *
   * Landmark geometry requires no ONNX model, so there is nothing to load.
   * The method accepts (and ignores) a URL argument so existing callers do
   * not need to change their contract.
   *
   * @param _modelUrl - Ignored. Retained only for {@link IEmbeddingComputer} compatibility.
   */
  async initialize(_modelUrl?: string): Promise<void> {
    this.ready = true;
  }

  /**
   * Provide the latest MediaPipe landmarks so that {@link extract} — which
   * receives an {@link ImageData} — can produce an embedding from geometry.
   *
   * Callers already compute landmarks for quality / liveness / puzzle logic;
   * pushing them here is a cheap reference assignment (no copy).
   */
  setLandmarks(landmarks: NormalizedLandmark[] | null): void {
    this.latestLandmarks = landmarks;
  }

  /**
   * Extract a 512-dim landmark-geometry embedding.
   *
   * The {@link ImageData} argument is accepted for backward compatibility
   * with the interface but is not used — the embedding is derived entirely
   * from the landmarks fed via {@link setLandmarks}. If no landmarks are
   * available, returns `null` so the caller treats it as "no client embedding
   * this frame" (the server will compute its own, trusted embedding).
   *
   * @param _faceImageData - Ignored. Retained for interface compatibility.
   * @returns 512-dim Float32Array embedding, or null when landmarks are unavailable.
   */
  async extract(_faceImageData: ImageData): Promise<Float32Array | null> {
    if (!this.latestLandmarks || this.latestLandmarks.length < 468) {
      return null;
    }
    return EmbeddingComputer.geometryEmbedding(this.latestLandmarks);
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
   * Uses pairwise Euclidean distances between 32 key facial landmarks to
   * create a 512-dim feature vector (496 pairwise distances + 16 padding
   * zeros). The landmarks are selected to capture face shape: eyes,
   * eyebrows, nose, mouth, chin, and face contour. The resulting vector
   * is L2-normalized to enable cosine similarity comparison.
   *
   * This is the sole client embedding path; the output is log-only
   * telemetry (D2) — auth decisions stay on the server.
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
   * Release any resources. No-op for the geometry-only implementation.
   */
  dispose(): void {
    this.latestLandmarks = null;
    this.ready = false;
  }

  /**
   * Whether the computer is ready. Always true for geometry-only mode; a
   * `false` value would indicate `dispose()` has been called.
   */
  isAvailable(): boolean {
    return this.ready;
  }

  /**
   * Initialization cannot fail in geometry-only mode.
   *
   * @returns null — no error is ever set.
   */
  getError(): string | null {
    return null;
  }

  // ===== Private Helpers =====

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
