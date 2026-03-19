/**
 * useFaceEnrollment — Wraps engine.enrollmentController for multi-angle enrollment.
 *
 * Manages the two-phase enrollment flow: liveness puzzle then 5-pose capture.
 * Exposes controller state via React state with throttled updates.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useFaceEnrollment)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { BiometricEngine } from '../core/BiometricEngine';
import type { EnrollmentCapture, EnrollmentPose } from '../types';
import { EnrollmentState, ENROLLMENT_POSES } from '../types';

/** Throttle interval for state updates during capture (ms). */
const STATE_UPDATE_THROTTLE_MS = 100;

export interface UseFaceEnrollmentReturn {
  start: () => void;
  cancel: () => void;
  state: EnrollmentState;
  currentPose: EnrollmentPose | null;
  step: number;
  totalSteps: number;
  isStable: boolean;
  holdProgress: number;
  captures: EnrollmentCapture[];
}

export function useFaceEnrollment(
  engine: BiometricEngine | null,
): UseFaceEnrollmentReturn {
  const [state, setState] = useState<EnrollmentState>(EnrollmentState.IDLE);
  const [currentPose, setCurrentPose] = useState<EnrollmentPose | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [captures, setCaptures] = useState<EnrollmentCapture[]>([]);

  const lastUpdateRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Wire up EnrollmentController callbacks
  useEffect(() => {
    if (!engine) return;

    const controller = engine.enrollmentController;

    controller.onStateChange = (newState: EnrollmentState) => {
      setState(newState);
      setCurrentPose(controller.getCurrentPose());
    };

    controller.onCapture = () => {
      setCaptures(controller.getCaptures());
    };

    controller.onComplete = () => {
      setState(EnrollmentState.SUBMITTING);
      setCaptures(controller.getCaptures());
    };

    controller.onFailed = () => {
      setState(EnrollmentState.FAILED);
    };

    // Poll hold progress and stability via rAF while capturing
    const pollState = () => {
      const now = performance.now();
      if (now - lastUpdateRef.current >= STATE_UPDATE_THROTTLE_MS) {
        lastUpdateRef.current = now;
        setIsStable(controller.isStable());
        setHoldProgress(controller.getHoldProgress());
        setCurrentPose(controller.getCurrentPose());
      }
      rafRef.current = requestAnimationFrame(pollState);
    };

    rafRef.current = requestAnimationFrame(pollState);

    return () => {
      controller.onStateChange = null;
      controller.onCapture = null;
      controller.onComplete = null;
      controller.onFailed = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [engine]);

  const start = useCallback(() => {
    if (!engine) return;
    engine.enrollmentController.start();
    setCaptures([]);
    setHoldProgress(0);
    setIsStable(false);
  }, [engine]);

  const cancel = useCallback(() => {
    if (!engine) return;
    engine.enrollmentController.cancel();
    setState(EnrollmentState.IDLE);
    setCaptures([]);
    setHoldProgress(0);
    setIsStable(false);
    setCurrentPose(null);
  }, [engine]);

  // Derive step from captures length
  const currentStep = captures.length;

  return {
    start,
    cancel,
    state,
    currentPose,
    step: currentStep,
    totalSteps: ENROLLMENT_POSES.length,
    isStable,
    holdProgress,
    captures,
  };
}
