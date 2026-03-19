/**
 * Biometric Engine — FaceTracker
 *
 * Browser-native port of FaceTracker from demo_local_fast.py (lines 987-1047).
 * Simple centroid-based multi-face tracker that assigns stable IDs to detected faces
 * across video frames using greedy nearest-neighbor matching.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5j
 * @see demo_local_fast.py lines 987-1047
 */

import type { IFaceTracker } from '../interfaces';
import type { FaceDetection } from '../types';
import { DEFAULT_MAX_GONE, MAX_MATCH_DISTANCE } from './constants';

/**
 * Internal track state for a single tracked face.
 */
interface TrackEntry {
  /** Last known centroid position [cx, cy] in pixels */
  centroid: [number, number];
  /** Number of consecutive frames without a matching detection */
  gone: number;
  /** Last matched detection */
  detection: FaceDetection;
}

/**
 * Centroid-based multi-face tracker with stable ID assignment.
 *
 * Direct port of Python FaceTracker (demo_local_fast.py lines 987-1047).
 * Uses greedy nearest-neighbor matching (not Hungarian algorithm) for simplicity
 * and speed. Each tracked face gets a monotonically increasing ID that persists
 * across frames as long as the face remains detected.
 *
 * @example
 * ```typescript
 * const tracker = new FaceTracker();
 *
 * // In frame loop:
 * const detections = faceDetector.detect(video, timestamp);
 * const tracked = tracker.update(detections);
 *
 * for (const [trackId, detection] of tracked) {
 *   console.log(`Face #${trackId} at (${detection.boundingBox.x}, ${detection.boundingBox.y})`);
 * }
 * ```
 */
export class FaceTracker implements IFaceTracker {
  private nextId: number = 0;
  private tracks: Map<number, TrackEntry> = new Map();
  private maxGone: number;

  /**
   * Create a FaceTracker instance.
   *
   * @param maxGone - Maximum number of frames a track survives without a detection
   *   before being removed. Default: 15 frames.
   *
   * @see demo_local_fast.py line 990: def __init__(self, max_gone: int = 15)
   */
  constructor(maxGone: number = DEFAULT_MAX_GONE) {
    this.maxGone = maxGone;
  }

  /**
   * FaceTracker is always available (no async initialization needed).
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Update tracks with new detections from the current frame.
   *
   * Algorithm (matches Python exactly):
   * 1. If no detections: increment `gone` counter for all tracks,
   *    remove tracks where `gone > maxGone`. Return empty map.
   * 2. Compute centroid (cx, cy) for each detection.
   * 3. If no existing tracks: create a new track per detection.
   * 4. For each existing track, find the nearest unmatched detection:
   *    - Distance = Euclidean distance between centroids
   *    - Must be < MAX_MATCH_DISTANCE (120 pixels) to match
   *    - Greedy assignment (first-come-first-served)
   * 5. Unmatched detections become new tracks.
   * 6. Unmatched tracks increment `gone`, removed if > maxGone.
   *
   * @param detections - Face detections from the current frame
   * @returns Map of trackId to FaceDetection for currently active tracks
   *
   * @see demo_local_fast.py lines 995-1047: FaceTracker.update()
   */
  update(detections: FaceDetection[]): Map<number, FaceDetection> {
    // Step 1: No detections — age out all tracks
    // @see demo_local_fast.py lines 996-1001
    if (detections.length === 0) {
      for (const [tid, track] of this.tracks) {
        track.gone += 1;
        if (track.gone > this.maxGone) {
          this.tracks.delete(tid);
        }
      }
      return new Map();
    }

    // Step 2: Compute centroids for all detections
    // @see demo_local_fast.py lines 1003-1008
    const centroids: Array<[number, number]> = detections.map((d) => [
      d.boundingBox.x + d.boundingBox.width / 2,
      d.boundingBox.y + d.boundingBox.height / 2,
    ]);

    // Step 3: No existing tracks — create all new
    // @see demo_local_fast.py lines 1010-1016
    if (this.tracks.size === 0) {
      const result = new Map<number, FaceDetection>();
      for (let i = 0; i < detections.length; i++) {
        this.tracks.set(this.nextId, {
          centroid: centroids[i],
          gone: 0,
          detection: detections[i],
        });
        result.set(this.nextId, detections[i]);
        this.nextId += 1;
      }
      return result;
    }

    // Step 4: Match existing tracks to nearest unmatched detections
    // @see demo_local_fast.py lines 1018-1039
    const used = new Set<number>();
    const result = new Map<number, FaceDetection>();

    for (const [tid, track] of this.tracks) {
      const tc = track.centroid;
      let bestJ = -1;
      let bestD = Infinity;

      for (let j = 0; j < centroids.length; j++) {
        if (!used.has(j)) {
          const nc = centroids[j];
          const d = Math.sqrt(
            (tc[0] - nc[0]) * (tc[0] - nc[0]) + (tc[1] - nc[1]) * (tc[1] - nc[1]),
          );
          if (d < bestD && d < MAX_MATCH_DISTANCE) {
            bestD = d;
            bestJ = j;
          }
        }
      }

      if (bestJ >= 0) {
        // Matched: update track
        track.centroid = centroids[bestJ];
        track.gone = 0;
        track.detection = detections[bestJ];
        result.set(tid, detections[bestJ]);
        used.add(bestJ);
      } else {
        // Unmatched track: increment gone, possibly remove
        // @see demo_local_fast.py lines 1036-1039
        track.gone += 1;
        if (track.gone > this.maxGone) {
          this.tracks.delete(tid);
        }
      }
    }

    // Step 5: Unmatched detections become new tracks
    // @see demo_local_fast.py lines 1041-1045
    for (let j = 0; j < detections.length; j++) {
      if (!used.has(j)) {
        this.tracks.set(this.nextId, {
          centroid: centroids[j],
          gone: 0,
          detection: detections[j],
        });
        result.set(this.nextId, detections[j]);
        this.nextId += 1;
      }
    }

    return result;
  }

  /**
   * Reset all tracking state.
   *
   * Clears all active tracks and resets the ID counter to 0.
   * Call this when switching cameras or restarting a session.
   */
  reset(): void {
    this.tracks.clear();
    this.nextId = 0;
  }
}
