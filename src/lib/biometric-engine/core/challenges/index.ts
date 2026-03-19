/**
 * Challenge Detectors — Strategy Pattern barrel export.
 *
 * Each detector implements IChallengeDetector for one ChallengeType.
 * New challenges are added by creating a new detector file and exporting here (OCP).
 *
 * @see demo_local_fast.py lines 451-921 (BiometricPuzzle challenge handlers)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5h
 */

export { BlinkDetector } from './BlinkDetector';
export { CloseLeftDetector } from './CloseLeftDetector';
export { CloseRightDetector } from './CloseRightDetector';
export { SmileDetector } from './SmileDetector';
export { OpenMouthDetector } from './OpenMouthDetector';
export { TurnLeftDetector } from './TurnLeftDetector';
export { TurnRightDetector } from './TurnRightDetector';
export { LookUpDetector } from './LookUpDetector';
export { LookDownDetector } from './LookDownDetector';
export { RaiseBothBrowsDetector } from './RaiseBothBrowsDetector';
export { RaiseLeftBrowDetector } from './RaiseLeftBrowDetector';
export { RaiseRightBrowDetector } from './RaiseRightBrowDetector';
export { NodDetector } from './NodDetector';
export { ShakeHeadDetector } from './ShakeHeadDetector';
