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

export function useBiometricEngine(
  config?: Partial<IBiometricEngineConfig>,
): UseBiometricEngineReturn {
  const { t } = useTranslation();
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
          setError(formatApiError(err, t));
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
