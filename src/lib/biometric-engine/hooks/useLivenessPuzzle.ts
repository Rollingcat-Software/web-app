/**
 * useLivenessPuzzle — Wraps engine.puzzle for active liveness challenges.
 *
 * Provides start/stop control, per-frame updateChallenge, and throttled state updates.
 * Challenge transitions update state immediately; normal progress throttled to 100ms.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useLivenessPuzzle)
 */

import { useState, useCallback, useRef } from 'react';
import type { BiometricEngine } from '../core/BiometricEngine';
import type {
  ChallengeType,
  ChallengeInfo,
  ChallengeCheckResult,
  PuzzleStepResult,
  FaceMetrics,
  NormalizedLandmark,
  HeadPose,
} from '../types';

/** Minimum interval between throttled React state updates (ms). */
const STATE_UPDATE_THROTTLE_MS = 100;

export interface UseLivenessPuzzleReturn {
  start: (challengeTypes?: ChallengeType[], numChallenges?: number) => void;
  stop: () => void;
  updateChallenge: (landmarks: NormalizedLandmark[], headPose: HeadPose) => ChallengeCheckResult | null;
  isActive: boolean;
  isComplete: boolean;
  passed: boolean;
  currentChallenge: ChallengeInfo | null;
  challengeResult: ChallengeCheckResult | null;
  results: PuzzleStepResult[];
  metrics: FaceMetrics | null;
}

export function useLivenessPuzzle(
  engine: BiometricEngine | null,
): UseLivenessPuzzleReturn {
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [passed, setPassed] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<ChallengeInfo | null>(null);
  const [challengeResult, setChallengeResult] = useState<ChallengeCheckResult | null>(null);
  const [results, setResults] = useState<PuzzleStepResult[]>([]);
  const [metrics, setMetrics] = useState<FaceMetrics | null>(null);

  const lastUpdateRef = useRef(0);
  const prevChallengeIdxRef = useRef(-1);

  const start = useCallback(
    (challengeTypes?: ChallengeType[], numChallenges?: number) => {
      if (!engine?.puzzle) return;

      engine.puzzle.start(challengeTypes, numChallenges);
      prevChallengeIdxRef.current = -1;

      setIsActive(true);
      setIsComplete(false);
      setPassed(false);
      setCurrentChallenge(engine.puzzle.getCurrentChallenge());
      setChallengeResult(null);
      setResults([]);
      setMetrics(null);
    },
    [engine],
  );

  const stop = useCallback(() => {
    if (!engine?.puzzle) return;

    engine.puzzle.stop();
    setIsActive(false);
    setIsComplete(true);
    setCurrentChallenge(null);
    setChallengeResult(null);
  }, [engine]);

  const updateChallenge = useCallback(
    (landmarks: NormalizedLandmark[], headPose: HeadPose): ChallengeCheckResult | null => {
      if (!engine?.puzzle || !engine.puzzle.getIsActive()) return null;

      const result = engine.puzzle.checkChallenge(landmarks, headPose.yaw, headPose.pitch);
      const now = performance.now();

      // Compute metrics for debug UI
      const faceMetrics = engine.metricsCalculator.calculateAll(landmarks);

      // Detect challenge transitions (always update immediately on transition)
      const challenge = engine.puzzle.getCurrentChallenge();
      const challengeIdx = challenge?.index ?? -1;
      const transitioned = challengeIdx !== prevChallengeIdxRef.current;
      prevChallengeIdxRef.current = challengeIdx;

      // Check completion
      const complete = engine.puzzle.getIsComplete();
      const puzzlePassed = engine.puzzle.getPassed();

      if (transitioned || complete || now - lastUpdateRef.current >= STATE_UPDATE_THROTTLE_MS) {
        lastUpdateRef.current = now;

        setChallengeResult(result);
        setCurrentChallenge(challenge);
        setMetrics(faceMetrics);

        if (complete) {
          setIsActive(false);
          setIsComplete(true);
          setPassed(puzzlePassed);
          setResults(engine.puzzle.getResults());
        }
      }

      return result;
    },
    [engine],
  );

  return {
    start,
    stop,
    updateChallenge,
    isActive,
    isComplete,
    passed,
    currentChallenge,
    challengeResult,
    results,
    metrics,
  };
}
