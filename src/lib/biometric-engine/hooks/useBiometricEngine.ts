/**
 * useBiometricEngine — Manages BiometricEngine singleton lifecycle.
 *
 * Initializes the engine on mount, disposes on unmount.
 * Returns null engine until MediaPipe models are loaded.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useBiometricEngine)
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatApiError } from '@utils/formatApiError';
import { BiometricEngine } from '../core/BiometricEngine';
import type { IBiometricEngineConfig } from '../interfaces';

export interface UseBiometricEngineReturn {
  engine: BiometricEngine | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  availability: {
    faceDetector: boolean;
    qualityAssessor: boolean;
    livenessDetector: boolean;
    embeddingComputer: boolean;
    cardDetector: boolean;
    voiceProcessor: boolean;
  };
}

/**
 * Options controlling the engine hook's lifecycle.
 */
export interface UseBiometricEngineOptions {
  /**
   * When `true`, the shared singleton is destroyed on unmount. Default `false`.
   *
   * The FaceLandmarker (MediaPipe Graph + WebGL context) is expensive to
   * create and is intended to be a long-lived, process-wide singleton — the
   * same way the server keeps ONE process-wide ONNX session. The biometric-
   * puzzles flow mounts a fresh `<FacePuzzle>` for EACH challenge inside the
   * runner modal; destroying the singleton on every unmount tore down and
   * re-created the FaceLandmarker per challenge ("Graph successfully started
   * running" / "destroyed WebGL context" spam, ~1s stall + leaked contexts).
   *
   * Leaving this `false` (the default for the singleton path) keeps ONE
   * FaceLandmarker alive and REUSES it across challenges. Callers that own a
   * bespoke per-component engine (via `config`) always dispose on unmount.
   */
  destroyOnUnmount?: boolean;
}

export function useBiometricEngine(
  config?: Partial<IBiometricEngineConfig>,
  options?: UseBiometricEngineOptions,
): UseBiometricEngineReturn {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<BiometricEngine | null>(null);
  // Mirror the unmount policy into a ref so the init-once effect's cleanup
  // reads the current value without depending on (and re-running for) options.
  const destroyOnUnmountRef = useRef(options?.destroyOnUnmount ?? false);
  destroyOnUnmountRef.current = options?.destroyOnUnmount ?? false;

  useEffect(() => {
    let disposed = false;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const engine = config
          ? BiometricEngine.create(config)
          : BiometricEngine.getInstance();

        engineRef.current = engine;
        await engine.initialize();

        if (!disposed) {
          setIsReady(engine.isReady());
          setIsLoading(false);
        }
      } catch (err) {
        if (!disposed) {
          setError(formatApiError(err, t));
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (engineRef.current) {
        if (config) {
          // A bespoke per-component engine — always dispose, it is ours.
          engineRef.current.dispose();
        } else if (destroyOnUnmountRef.current) {
          // Singleton + caller opted in to teardown on unmount.
          BiometricEngine.destroy();
        }
        // Otherwise (singleton, default): leave the shared FaceLandmarker
        // alive so the next mount REUSES it instead of re-creating the
        // MediaPipe Graph + WebGL context. See UseBiometricEngineOptions.
        engineRef.current = null;
      }
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init-once: `config` is a module-scope options object that callers pass by reference every render; re-running would re-initialise MediaPipe each render. `t` is only used inside the catch for a formatter — locale changes don't need to re-init the engine.

  const engine = engineRef.current;

  return {
    engine: isReady ? engine : null,
    isReady,
    isLoading,
    error,
    availability: {
      faceDetector: engine?.faceDetector?.isAvailable() ?? false,
      qualityAssessor: engine?.qualityAssessor?.isAvailable() ?? false,
      livenessDetector: engine?.livenessDetector?.isAvailable() ?? false,
      embeddingComputer: engine?.embeddingComputer?.isAvailable() ?? false,
      cardDetector: engine?.cardDetector?.isAvailable() ?? false,
      voiceProcessor: engine?.voiceProcessor?.isAvailable() ?? false,
    },
  };
}
