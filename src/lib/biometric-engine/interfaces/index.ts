/**
 * Biometric Engine — Interface Definitions
 *
 * All component interfaces follow the I-prefix convention (Liskov Substitution).
 * Every implementation must honor these contracts.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5 (interfaces block)
 */

import type {
  CardDetectionResult,
  ChallengeCheckResult,
  ChallengeInfo,
  ChallengeType,
  EyebrowBaseline,
  EyebrowMetrics,
  FaceDetection,
  FaceMetrics,
  HeadPose,
  LivenessResult,
  NormalizedLandmark,
  PixelLandmark,
  PuzzleStepResult,
  QualityReport,
  SmileMetrics,
} from '../types';

// ===== Core Component Interfaces =====

/**
 * Face detection using MediaPipe FaceLandmarker.
 * @see demo_local_fast.py lines 220-330 (FastFaceDetector)
 */
export interface IFaceDetector {
  initialize(): Promise<void>;
  dispose(): void;
  detect(video: HTMLVideoElement, timestamp: number): FaceDetection[];
  isAvailable(): boolean;
  getError(): string | null;
}

/**
 * Face image quality assessment (blur, size, brightness).
 * @see demo_local_fast.py lines 332-366 (FastQualityAssessor)
 */
export interface IQualityAssessor {
  assess(faceImageData: ImageData): QualityReport;
  isAvailable(): boolean;
}

/**
 * Passive liveness detection via texture/color analysis.
 * @see demo_local_fast.py lines 369-444 (FastLivenessDetector)
 */
export interface IPassiveLivenessDetector {
  check(faceImageData: ImageData): LivenessResult;
  isAvailable(): boolean;
}

/**
 * Head pose estimation from facial landmarks.
 * @see demo_local_fast.py lines 1415-1440 (estimate_head_pose)
 */
export interface IHeadPoseEstimator {
  estimate(landmarks: PixelLandmark[], frameSize: { width: number; height: number }): HeadPose;
  isAvailable(): boolean;
}

/**
 * Centroid-based multi-face tracker with stable IDs.
 * @see demo_local_fast.py lines 987-1047 (FaceTracker)
 */
export interface IFaceTracker {
  update(detections: FaceDetection[]): Map<number, FaceDetection>;
  isAvailable(): boolean;
}

/**
 * Active liveness puzzle with 14 challenge types.
 * @see demo_local_fast.py lines 451-921 (BiometricPuzzle)
 */
export interface IBiometricPuzzle {
  start(challengeTypes?: ChallengeType[], numChallenges?: number): void;
  stop(): void;
  getCurrentChallenge(): ChallengeInfo | null;
  checkChallenge(
    landmarks: NormalizedLandmark[],
    yaw: number,
    pitch: number,
  ): ChallengeCheckResult;
  getIsActive(): boolean;
  getIsComplete(): boolean;
  getPassed(): boolean;
  getResults(): PuzzleStepResult[];
  isAvailable(): boolean;
}

/**
 * Face embedding extraction via ONNX Runtime Web.
 * @see demo_local_fast.py lines 1192-1220 (EmbeddingExtractor)
 */
export interface IEmbeddingComputer {
  initialize(modelUrl: string): Promise<void>;
  dispose(): void;
  extract(faceImageData: ImageData): Promise<Float32Array | null>;
  isAvailable(): boolean;
}

/**
 * ID card detection via YOLO ONNX model.
 * @see demo_local_fast.py lines 1151 (card detection)
 */
export interface ICardDetector {
  initialize(modelUrl: string): Promise<void>;
  dispose(): void;
  detect(video: HTMLVideoElement, useSmoothing?: boolean): Promise<CardDetectionResult>;
  isAvailable(): boolean;
}

/**
 * Voice recording processor.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5m
 */
export interface IVoiceProcessor {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  dispose(): void;
  isAvailable(): boolean;
}

/**
 * Face metrics calculator for EAR, MAR, smile, and eyebrow detection.
 * @see demo_local_fast.py lines 462-471
 */
export interface IFaceMetricsCalculator {
  calculateEAR(landmarks: NormalizedLandmark[], eyeIndices: number[]): number;
  calculateMAR(landmarks: NormalizedLandmark[]): number;
  calculateSmile(landmarks: NormalizedLandmark[]): SmileMetrics;
  calculateEyebrowRaise(landmarks: NormalizedLandmark[], baseline?: EyebrowBaseline): EyebrowMetrics;
  calculateAll(landmarks: NormalizedLandmark[], baseline?: EyebrowBaseline): FaceMetrics;
}

// ===== Challenge Detector Interface (Strategy Pattern) =====

/**
 * Single challenge detector for the Strategy pattern.
 * Each challenge type has its own detector implementation.
 * New challenges are added by implementing this interface and registering (Open/Closed).
 * @see demo_local_fast.py lines 451-921 (BiometricPuzzle challenge handlers)
 */
export interface IChallengeDetector {
  /** The challenge type this detector handles. */
  readonly type: ChallengeType;

  /** Detect whether the challenge condition is currently met. */
  detect(metrics: FaceMetrics, headPose: HeadPose): boolean;

  /** Get a user-facing feedback message for this challenge. */
  getMessage(metrics: FaceMetrics, headPose: HeadPose): string;
}

// ===== Configuration Interface =====

/**
 * Configuration for BiometricEngine builder pattern.
 * All components are optional — only inject what you need.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a (Builder)
 */
export interface IBiometricEngineConfig {
  faceDetector?: IFaceDetector;
  qualityAssessor?: IQualityAssessor;
  livenessDetector?: IPassiveLivenessDetector;
  headPoseEstimator?: IHeadPoseEstimator;
  faceTracker?: IFaceTracker;
  puzzle?: IBiometricPuzzle;
  embeddingComputer?: IEmbeddingComputer;
  cardDetector?: ICardDetector;
  voiceProcessor?: IVoiceProcessor;
  metricsCalculator?: IFaceMetricsCalculator;
}
