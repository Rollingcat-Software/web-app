/**
 * Auth-Test Page Adapter — exposes the biometric engine as a global
 * window.FIVUCSAS namespace for vanilla JS consumption.
 *
 * This file is the entry point for the IIFE bundle built via:
 *   npm run build:adapter
 *
 * The resulting biometric-engine.iife.js is loaded by auth-test/index.html
 * before app.js, making all engine classes available as:
 *   window.FIVUCSAS.BiometricEngine
 *   window.FIVUCSAS.FaceDetector
 *   etc.
 *
 * NOTE: React hooks are intentionally excluded — auth-test is vanilla JS.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 10
 */

// ===== Core Classes =====
import { BiometricEngine, BiometricEngineBuilder } from '../core/BiometricEngine';
import { FaceDetector } from '../core/FaceDetector';
import { QualityAssessor } from '../core/QualityAssessor';
import { HeadPoseEstimator } from '../core/HeadPoseEstimator';
import { FaceTracker } from '../core/FaceTracker';
import { FaceMetricsCalculator } from '../core/FaceMetricsCalculator';
import { BiometricPuzzle } from '../core/BiometricPuzzle';
import { FrameProcessor } from '../core/FrameProcessor';
import { EnrollmentController } from '../core/EnrollmentController';
import { PassiveLivenessDetector } from '../core/PassiveLivenessDetector';
import { EmbeddingComputer } from '../core/EmbeddingComputer';

// ===== Challenge Detectors =====
import * as challenges from '../core/challenges';

// ===== Types & Enums =====
import { ChallengeType, EnrollmentState, ENROLLMENT_POSES } from '../types';

// ===== Constants =====
import * as constants from '../core/constants';

// ===== Image Utilities =====
import * as imageUtils from '../core/image-utils';

// ===== Expose on window for vanilla JS =====
const FIVUCSAS = {
  // Core classes
  BiometricEngine,
  BiometricEngineBuilder,
  FaceDetector,
  QualityAssessor,
  HeadPoseEstimator,
  FaceTracker,
  FaceMetricsCalculator,
  BiometricPuzzle,
  FrameProcessor,
  EnrollmentController,
  PassiveLivenessDetector,
  EmbeddingComputer,

  // Enums
  ChallengeType,
  EnrollmentState,
  ENROLLMENT_POSES,

  // Challenge detectors (strategy pattern implementations)
  challenges,

  // Constants (thresholds, landmark indices, etc.)
  constants,

  // Image utility functions
  imageUtils,

  // Adapter version — for compatibility checks
  __adapterVersion: '1.0.0',
};

(window as any).FIVUCSAS = FIVUCSAS;

// Adapter loaded - no console output in production

export default FIVUCSAS;
