/**
 * useBlazeFace — React hook for lazy-loading and running BlazeFace face detection.
 *
 * Uses a module-level singleton so the TensorFlow.js model is loaded exactly
 * once per tab regardless of component mount/unmount cycles, React StrictMode
 * double-invoke, or useEffect dependency changes.
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatApiError } from '@utils/formatApiError';
import type { BlazeFaceDetector, BlazeFaceResult } from './BlazeFaceDetector';
import { getBlazeFace } from './blazeFaceSingleton';

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

const TIMING_WINDOW = 30;

export function useBlazeFace(enabled = true): UseBlazeFaceReturn {
  const { t } = useTranslation();
  const detectorRef = useRef<BlazeFaceDetector | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timingsRef = useRef<number[]>([]);
  const [avgInferenceMs, setAvgInferenceMs] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getBlazeFace()
      .then((detector) => {
        if (cancelled) return;
        detectorRef.current = detector;
        setIsReady(true);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(formatApiError(err, t));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      detectorRef.current = null;
      timingsRef.current = [];
    };
  }, [enabled, t]);

  const detect = useCallback(
    async (video: HTMLVideoElement): Promise<BlazeFaceResult | null> => {
      const detector = detectorRef.current;
      if (!detector || !detector.isReady()) return null;

      const result = await detector.detect(video);

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
