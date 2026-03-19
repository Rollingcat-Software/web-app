/**
 * useBiometricEngine — Manages BiometricEngine singleton lifecycle.
 *
 * Initializes the engine on mount, disposes on unmount.
 * Returns null engine until MediaPipe models are loaded.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useBiometricEngine)
 */

import { useState, useEffect, useRef } from 'react';
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

export function useBiometricEngine(
  config?: Partial<IBiometricEngineConfig>,
): UseBiometricEngineReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<BiometricEngine | null>(null);

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
          setError(err instanceof Error ? err.message : 'Engine initialization failed');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (engineRef.current) {
        // Only destroy singleton if we created it via getInstance
        if (!config) {
          BiometricEngine.destroy();
        } else {
          engineRef.current.dispose();
        }
        engineRef.current = null;
      }
      setIsReady(false);
    };
  }, []);

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
