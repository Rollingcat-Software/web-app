/**
 * useBlazeFace — React hook for lazy-loading and running BlazeFace face detection.
 *
 * Loads the TensorFlow.js model on first use and caches it for the component lifetime.
 * Falls back gracefully if the model fails to load (e.g., no WebGL support).
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BlazeFaceDetector, type BlazeFaceResult } from './BlazeFaceDetector';

export interface UseBlazeFaceReturn {
  /** Run face detection on a video element. Returns null if model not ready. */
  detect: (video: HTMLVideoElement) => Promise<BlazeFaceResult | null>;
  /** Whether the model is currently loading. */
  isLoading: boolean;
  /** Whether the model is loaded and ready for inference. */
  isReady: boolean;
  /** Error message if initialization failed. */
  error: string | null;
  /** Average inference time over the last N frames (ms). */
  avgInferenceMs: number;
}

/** Number of inference time samples to average. */
const TIMING_WINDOW = 30;

/**
 * Hook that lazily initializes BlazeFace on mount and provides a detect function.
 *
 * @param enabled - Set to false to skip initialization (e.g., when using MediaPipe instead).
 */
export function useBlazeFace(enabled = true): UseBlazeFaceReturn {
  const detectorRef = useRef<BlazeFaceDetector | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rolling window of inference times for performance monitoring
  const timingsRef = useRef<number[]>([]);
  const [avgInferenceMs, setAvgInferenceMs] = useState(0);

  // Initialize the model
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const detector = new BlazeFaceDetector();
    detectorRef.current = detector;

    setIsLoading(true);
    setError(null);
    setIsReady(false);

    detector
      .initialize()
      .then(() => {
        if (cancelled) {
          detector.dispose();
          return;
        }
        setIsReady(true);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      detector.dispose();
      detectorRef.current = null;
      setIsReady(false);
      setIsLoading(false);
      timingsRef.current = [];
    };
  }, [enabled]);

  const detect = useCallback(
    async (video: HTMLVideoElement): Promise<BlazeFaceResult | null> => {
      const detector = detectorRef.current;
      if (!detector || !detector.isReady()) return null;

      const result = await detector.detect(video);

      // Update rolling timing window
      const timings = timingsRef.current;
      timings.push(result.inferenceTimeMs);
      if (timings.length > TIMING_WINDOW) {
        timings.shift();
      }
      const avg =
        timings.reduce((sum, t) => sum + t, 0) / timings.length;
      setAvgInferenceMs(Math.round(avg * 10) / 10);

      return result;
    },
    [],
  );

  return { detect, isLoading, isReady, error, avgInferenceMs };
}
