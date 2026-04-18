/**
 * Module-level singleton for BlazeFaceDetector.
 *
 * Ensures the detector is loaded exactly once per browser tab regardless of
 * how many components mount `useBlazeFace` and survives React StrictMode's
 * double-invocation of effects as well as `useEffect` dependency-triggered
 * re-runs.
 *
 * @see CLIENT_SIDE_ML_PLAN.md Phase 4.2.1
 */

import { BlazeFaceDetector } from './BlazeFaceDetector';

let _instance: BlazeFaceDetector | null = null;
let _loadPromise: Promise<BlazeFaceDetector> | null = null;

export function getBlazeFace(): Promise<BlazeFaceDetector> {
  if (_instance && _instance.isReady()) {
    return Promise.resolve(_instance);
  }
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const detector = new BlazeFaceDetector();
      try {
        await detector.initialize();
        _instance = detector;
        return detector;
      } catch (err) {
        _loadPromise = null;
        throw err;
      }
    })();
  }
  return _loadPromise;
}

/**
 * Reset the singleton. Intended for tests only — production code should never
 * tear down the detector because the model is cached by the browser anyway.
 */
export function __resetBlazeFaceForTests(): void {
  if (_instance) {
    _instance.dispose();
  }
  _instance = null;
  _loadPromise = null;
}
