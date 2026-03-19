/**
 * useFaceDetection — Runs the FrameProcessor detection loop and exposes results.
 *
 * Starts engine.frameProcessor.start() when active, stops on deactivation/unmount.
 * Throttles React state updates to every 100ms to avoid re-render storms.
 * Returns the primary face (largest by bounding box area).
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useFaceDetection)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BiometricEngine } from '../core/BiometricEngine';
import type {
  TrackedFace,
  HeadPose,
  QualityReport,
  FaceMetrics,
  FrameResult,
} from '../types';

/** Minimum interval between React state updates (ms). */
const STATE_UPDATE_THROTTLE_MS = 100;

export interface UseFaceDetectionReturn {
  faces: TrackedFace[];
  primaryFace: TrackedFace | null;
  headPose: HeadPose | null;
  quality: QualityReport | null;
  metrics: FaceMetrics | null;
  fps: number;
}

/**
 * Find the primary face — the one with the largest bounding box area.
 */
function findPrimaryFace(faces: TrackedFace[]): TrackedFace | null {
  if (faces.length === 0) return null;
  if (faces.length === 1) return faces[0];

  return faces.reduce((largest, face) => {
    const areaA = largest.detection.boundingBox.width * largest.detection.boundingBox.height;
    const areaB = face.detection.boundingBox.width * face.detection.boundingBox.height;
    return areaB > areaA ? face : largest;
  });
}

export function useFaceDetection(
  engine: BiometricEngine | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): UseFaceDetectionReturn {
  const [faces, setFaces] = useState<TrackedFace[]>([]);
  const [primaryFace, setPrimaryFace] = useState<TrackedFace | null>(null);
  const [headPose, setHeadPose] = useState<HeadPose | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [metrics, setMetrics] = useState<FaceMetrics | null>(null);
  const [fps, setFps] = useState(0);

  const lastUpdateRef = useRef(0);
  // Keep latest frame result for consumers who need it synchronously (e.g. puzzle hook)
  const latestResultRef = useRef<FrameResult | null>(null);

  const onFrame = useCallback((result: FrameResult) => {
    latestResultRef.current = result;

    const now = performance.now();
    if (now - lastUpdateRef.current < STATE_UPDATE_THROTTLE_MS) return;
    lastUpdateRef.current = now;

    const primary = findPrimaryFace(result.faces);

    setFaces(result.faces);
    setPrimaryFace(primary);
    setHeadPose(primary?.headPose ?? null);
    setQuality(primary?.quality ?? null);
    setMetrics(primary?.metrics ?? null);
    setFps(result.fps);
  }, []);

  useEffect(() => {
    if (!engine || !active || !videoRef.current) {
      // Stop the processor if conditions aren't met
      engine?.frameProcessor.stop();
      return;
    }

    const video = videoRef.current;
    engine.frameProcessor.start(video, onFrame);

    return () => {
      engine.frameProcessor.stop();
      setFaces([]);
      setPrimaryFace(null);
      setHeadPose(null);
      setQuality(null);
      setMetrics(null);
      setFps(0);
    };
  }, [engine, active, videoRef, onFrame]);

  return { faces, primaryFace, headPose, quality, metrics, fps };
}
