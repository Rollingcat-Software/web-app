/**
 * useHandGestureDetection — React hook for the gesture liveness flow.
 *
 * Mirrors `useFaceDetection` in shape and lifecycle:
 *   - owns a single HandGestureDetector instance per mount
 *   - runs a rAF loop while `active` is true and the `<video>` is ready
 *   - drains detection results into React state (throttled)
 *   - tears down the detector + pending frames on unmount / deactivation
 *
 * No frames leave the browser — the hook only exposes 21 landmarks + a
 * lightweight anti-spoof telemetry snapshot, which the consumer forwards
 * to the server via the existing HTTP client.
 *
 * @see ../core/HandGestureDetector
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HandGestureDetector,
  type AntiSpoofTelemetry,
  type GestureChallengeType,
  type HandLandmark,
} from '../core/HandGestureDetector';

/** Minimum interval between React state updates (ms). */
const STATE_UPDATE_THROTTLE_MS = 100;

export interface UseHandGestureDetectionReturn {
  /** True when the current frame contains a detected hand. */
  detected: boolean;
  /** Client-side advisory classification (server re-verifies). */
  gesture: GestureChallengeType | null;
  /** Confidence of the client-side classification in the range 0–1. */
  confidence: number;
  /** i18n key for the current UX hint (always resolves via `t()`). */
  hint: string;
  /** 21 MediaPipe landmarks for the most recent detection (or null). */
  landmarks: HandLandmark[] | null;
  /** Passive anti-spoof telemetry to forward to the server. */
  antiSpoof: AntiSpoofTelemetry;
  /** True when the MediaPipe runtime + model are fully loaded. */
  initialized: boolean;
  /** True when init() threw (CDN blocked, unsupported browser, etc.). */
  initFailed: boolean;
  /** Latest rAF measurement of detector throughput (frames per second). */
  fps: number;
}

const INITIAL_TELEMETRY: AntiSpoofTelemetry = {
  tremorVariance: 0,
  brightnessStdDev: 0,
  frameRate: 0,
};

const INITIAL_STATE: UseHandGestureDetectionReturn = {
  detected: false,
  gesture: null,
  confidence: 0,
  hint: 'liveness.gesture.hint.prepare',
  landmarks: null,
  antiSpoof: INITIAL_TELEMETRY,
  initialized: false,
  initFailed: false,
  fps: 0,
};

export function useHandGestureDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  expectedGesture: GestureChallengeType | null,
  recordOperation?: (name: string, durationMs: number) => void,
): UseHandGestureDetectionReturn {
  const detectorRef = useRef<HandGestureDetector | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastUpdateRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const [state, setState] = useState<UseHandGestureDetectionReturn>(INITIAL_STATE);

  // Tell the detector which challenge is active so its advisory label is
  // useful for the UX.
  useEffect(() => {
    detectorRef.current?.setExpected(expectedGesture);
  }, [expectedGesture]);

  // Initialise / tear down the detector when `active` flips.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const detector = new HandGestureDetector();
    detectorRef.current = detector;
    detector.setExpected(expectedGesture);

    (async () => {
      try {
        await detector.init();
        if (cancelled) {
          detector.dispose();
          return;
        }
        setState((prev) => ({ ...prev, initialized: true, initFailed: false }));
      } catch (err) {
        console.warn('[useHandGestureDetection] init failed', err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, initFailed: true }));
        }
      }
    })();

    return () => {
      cancelled = true;
      detector.dispose();
      if (detectorRef.current === detector) {
        detectorRef.current = null;
      }
    };
    // `expectedGesture` change is pushed via the dedicated effect above — we
    // do not want to rebuild the detector on every challenge rotation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Capture the current <video> frame into an offscreen canvas → ImageData.
  const grabImageData = useCallback((): ImageData | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    if (canvas.width !== vw) canvas.width = vw;
    if (canvas.height !== vh) canvas.height = vh;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, vw, vh);
    try {
      return ctx.getImageData(0, 0, vw, vh);
    } catch {
      return null;
    }
  }, [videoRef]);

  // Detection loop — kicked off once the detector is initialized.
  useEffect(() => {
    if (!active || !state.initialized) return;

    let running = true;

    const loop = async () => {
      if (!running) return;

      const detector = detectorRef.current;
      const imageData = grabImageData();
      if (!detector || !imageData) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        const result = await detector.detectFrame(imageData);
        recordOperation?.('hand-detect', result.inferenceTimeMs);

        const now = performance.now();
        const dt = lastFrameTimeRef.current
          ? now - lastFrameTimeRef.current
          : 0;
        lastFrameTimeRef.current = now;
        const instantFps = dt > 0 ? 1000 / dt : 0;

        if (now - lastUpdateRef.current >= STATE_UPDATE_THROTTLE_MS) {
          lastUpdateRef.current = now;
          setState((prev) => ({
            ...prev,
            detected: result.detected,
            gesture: result.gesture,
            confidence: result.confidence,
            hint: result.hint,
            landmarks: result.landmarks,
            antiSpoof: result.antiSpoof,
            fps: instantFps,
          }));
        }
      } catch {
        // Per-frame errors are non-fatal — keep looping.
      }

      if (running) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      lastFrameTimeRef.current = 0;
    };
  }, [active, state.initialized, grabImageData, recordOperation]);

  // Reset the visible state when the hook deactivates.
  useEffect(() => {
    if (active) return;
    setState((prev) => ({
      ...INITIAL_STATE,
      initialized: prev.initialized,
      initFailed: prev.initFailed,
    }));
  }, [active]);

  return state;
}
