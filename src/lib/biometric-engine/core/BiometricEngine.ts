/**
 * BiometricEngine — Orchestrator with DI builder pattern.
 *
 * Singleton that wires all biometric sub-components together.
 * Responsibility: configuration, lifecycle management, and component wiring only (SRP).
 * Does NOT own the frame loop (FrameProcessor) or enrollment flow (EnrollmentController).
 *
 * All dependencies are injected via interfaces (DIP). The Builder provides
 * convenient construction with defaults using concrete implementations.
 *
 * @see demo_local_fast.py lines 1227-1301 (FastBiometricDemo.__init__)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a
 */

import type {
  IFaceDetector,
  IQualityAssessor,
  IPassiveLivenessDetector,
  IHeadPoseEstimator,
  IFaceTracker,
  IBiometricPuzzle,
  IEmbeddingComputer,
  ICardDetector,
  IVoiceProcessor,
  IFaceMetricsCalculator,
  IBiometricEngineConfig,
} from '../interfaces';
import { FrameProcessor } from './FrameProcessor';
import { EnrollmentController } from './EnrollmentController';

// Default implementations (concrete classes)
import { FaceDetector } from './FaceDetector';
import { QualityAssessor } from './QualityAssessor';
import { HeadPoseEstimator } from './HeadPoseEstimator';
import { FaceTracker } from './FaceTracker';
import { FaceMetricsCalculator } from './FaceMetricsCalculator';
import { PassiveLivenessDetector } from './PassiveLivenessDetector';

/**
 * BiometricEngine is the top-level orchestrator for all biometric operations.
 *
 * It holds references to all sub-components and creates the FrameProcessor
 * and EnrollmentController with the injected (or default) dependencies.
 *
 * Usage:
 * ```typescript
 * // Singleton with defaults
 * const engine = BiometricEngine.getInstance();
 * await engine.initialize();
 *
 * // Or via builder for custom wiring
 * const engine = new BiometricEngineBuilder()
 *   .withFaceDetector(myCustomDetector)
 *   .buildWithDefaults();
 * await engine.initialize();
 * ```
 *
 * @see demo_local_fast.py lines 1227-1301 (FastBiometricDemo)
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a
 */
export class BiometricEngine {
  /** Singleton instance. */
  private static instance: BiometricEngine | null = null;

  // --- Injected sub-components (interfaces, DIP) ---

  /** Face detection using MediaPipe FaceLandmarker. @see demo_local_fast.py line 1250 */
  readonly faceDetector: IFaceDetector;

  /** Face image quality assessment. @see demo_local_fast.py line 1251 */
  readonly qualityAssessor: IQualityAssessor;

  /** Passive liveness detection. @see demo_local_fast.py line 1252 */
  readonly livenessDetector: IPassiveLivenessDetector | null;

  /** Head pose estimation from landmarks. */
  readonly headPoseEstimator: IHeadPoseEstimator;

  /** Multi-face tracker with stable IDs. @see demo_local_fast.py line 1253 */
  readonly faceTracker: IFaceTracker;

  /** Active liveness puzzle (14 challenges). */
  readonly puzzle: IBiometricPuzzle | null;

  /** Face embedding extraction. @see demo_local_fast.py line 1256 */
  readonly embeddingComputer: IEmbeddingComputer | null;

  /** ID card detection. */
  readonly cardDetector: ICardDetector | null;

  /** Voice recording processor. */
  readonly voiceProcessor: IVoiceProcessor | null;

  /** Shared face metrics calculator (DRY). */
  readonly metricsCalculator: IFaceMetricsCalculator;

  // --- Composed sub-systems (SRP) ---

  /** Per-frame detection loop. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5b */
  readonly frameProcessor: FrameProcessor;

  /** Multi-angle enrollment state machine. @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5c */
  readonly enrollmentController: EnrollmentController;

  // --- State ---

  /** Whether the engine has been initialized (models loaded). */
  private _ready: boolean = false;

  /**
   * Private constructor — use getInstance(), create(), or BiometricEngineBuilder.
   *
   * @param config - Partial config; missing components use null (not defaults).
   *                 Use BiometricEngineBuilder.buildWithDefaults() for auto-defaults.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a (constructor)
   */
  private constructor(config: IBiometricEngineConfig) {
    // Wire up injected components (DIP: accept interfaces)
    this.faceDetector = config.faceDetector!;
    this.qualityAssessor = config.qualityAssessor!;
    this.headPoseEstimator = config.headPoseEstimator!;
    this.faceTracker = config.faceTracker!;
    this.metricsCalculator = config.metricsCalculator!;
    this.livenessDetector = config.livenessDetector ?? null;
    this.puzzle = config.puzzle ?? null;
    this.embeddingComputer = config.embeddingComputer ?? null;
    this.cardDetector = config.cardDetector ?? null;
    this.voiceProcessor = config.voiceProcessor ?? null;

    // Create FrameProcessor with injected deps (SRP: it only runs the loop)
    this.frameProcessor = new FrameProcessor({
      faceDetector: this.faceDetector,
      qualityAssessor: this.qualityAssessor,
      headPoseEstimator: this.headPoseEstimator,
      faceTracker: this.faceTracker,
      metricsCalculator: this.metricsCalculator,
      livenessDetector: this.livenessDetector ?? undefined,
    });

    // Create EnrollmentController (SRP: it only manages enrollment state)
    this.enrollmentController = new EnrollmentController();
  }

  /**
   * Get the singleton instance, creating it with defaults if needed.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a (Singleton)
   */
  static getInstance(): BiometricEngine {
    if (!BiometricEngine.instance) {
      BiometricEngine.instance = new BiometricEngineBuilder().buildWithDefaults();
    }
    return BiometricEngine.instance;
  }

  /**
   * Create a new BiometricEngine instance with the given partial config.
   * Missing required components are filled with defaults.
   * Does NOT set the singleton — use getInstance() for that.
   *
   * @param config - Partial config; missing P0 components use defaults.
   */
  static create(config: Partial<IBiometricEngineConfig>): BiometricEngine {
    const builder = new BiometricEngineBuilder();

    if (config.faceDetector) builder.withFaceDetector(config.faceDetector);
    if (config.qualityAssessor) builder.withQualityAssessor(config.qualityAssessor);
    if (config.headPoseEstimator) builder.withHeadPoseEstimator(config.headPoseEstimator);
    if (config.faceTracker) builder.withFaceTracker(config.faceTracker);
    if (config.metricsCalculator) builder.withMetricsCalculator(config.metricsCalculator);
    if (config.livenessDetector) builder.withLivenessDetector(config.livenessDetector);
    if (config.puzzle) builder.withPuzzle(config.puzzle);
    if (config.embeddingComputer) builder.withEmbeddingComputer(config.embeddingComputer);
    if (config.cardDetector) builder.withCardDetector(config.cardDetector);
    if (config.voiceProcessor) builder.withVoiceProcessor(config.voiceProcessor);

    return builder.buildWithDefaults();
  }

  /**
   * Destroy the singleton instance and release all resources.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a (destroy)
   */
  static destroy(): void {
    if (BiometricEngine.instance) {
      BiometricEngine.instance.dispose();
      BiometricEngine.instance = null;
    }
  }

  /**
   * Initialize the engine: load MediaPipe models and any other async resources.
   * Must be called before starting the frame processor.
   *
   * Initialization errors are caught per-component. A failing component sets
   * isAvailable() = false; other components continue.
   *
   * @see demo_local_fast.py lines 1249-1260 (component initialization)
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 8 (Error Handling)
   */
  async initialize(): Promise<void> {
    if (this._ready) return;

    // Initialize face detector (P0 — required)
    try {
      await this.faceDetector.initialize();
    } catch (err) {
      console.error('[BiometricEngine] FaceDetector initialization failed:', err);
      // Engine is degraded but not dead — isReady stays false
    }

    // Initialize optional async components (P2 — graceful skip on failure)
    if (this.embeddingComputer) {
      try {
        // Model URL would be configured via the builder
        // For now, skip if no URL is configured
      } catch (err) {
        console.error('[BiometricEngine] EmbeddingComputer initialization failed:', err);
      }
    }

    if (this.cardDetector) {
      try {
        // Same as embedding — requires explicit model URL
      } catch (err) {
        console.error('[BiometricEngine] CardDetector initialization failed:', err);
      }
    }

    this._ready = this.faceDetector.isAvailable();
  }

  /**
   * Release all resources: stop frame processor, dispose components.
   *
   * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a (dispose)
   */
  dispose(): void {
    this.frameProcessor.stop();
    this.enrollmentController.cancel();

    this.faceDetector.dispose();
    this.embeddingComputer?.dispose();
    this.cardDetector?.dispose();
    this.voiceProcessor?.dispose();

    this._ready = false;
  }

  /**
   * Whether the engine is initialized and ready for use.
   * True when at minimum the face detector is available.
   */
  isReady(): boolean {
    return this._ready;
  }
}

/**
 * Builder for constructing a BiometricEngine with custom or default components.
 *
 * Follows the Builder pattern from the architecture doc.
 * Use withXxx() methods to inject custom implementations,
 * then build() for exact config or buildWithDefaults() to fill gaps.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 5a (Builder Pattern)
 */
export class BiometricEngineBuilder {
  private config: IBiometricEngineConfig = {};

  /** Inject a custom face detector. */
  withFaceDetector(detector: IFaceDetector): this {
    this.config.faceDetector = detector;
    return this;
  }

  /** Inject a custom quality assessor. */
  withQualityAssessor(assessor: IQualityAssessor): this {
    this.config.qualityAssessor = assessor;
    return this;
  }

  /** Inject a custom passive liveness detector. */
  withLivenessDetector(detector: IPassiveLivenessDetector): this {
    this.config.livenessDetector = detector;
    return this;
  }

  /** Inject a custom head pose estimator. */
  withHeadPoseEstimator(estimator: IHeadPoseEstimator): this {
    this.config.headPoseEstimator = estimator;
    return this;
  }

  /** Inject a custom face tracker. */
  withFaceTracker(tracker: IFaceTracker): this {
    this.config.faceTracker = tracker;
    return this;
  }

  /** Inject a custom biometric puzzle. */
  withPuzzle(puzzle: IBiometricPuzzle): this {
    this.config.puzzle = puzzle;
    return this;
  }

  /** Inject a custom embedding computer. */
  withEmbeddingComputer(computer: IEmbeddingComputer): this {
    this.config.embeddingComputer = computer;
    return this;
  }

  /** Inject a custom card detector. */
  withCardDetector(detector: ICardDetector): this {
    this.config.cardDetector = detector;
    return this;
  }

  /** Inject a custom voice processor. */
  withVoiceProcessor(processor: IVoiceProcessor): this {
    this.config.voiceProcessor = processor;
    return this;
  }

  /** Inject a custom metrics calculator. */
  withMetricsCalculator(calculator: IFaceMetricsCalculator): this {
    this.config.metricsCalculator = calculator;
    return this;
  }

  /**
   * Build a BiometricEngine with exactly the configured components.
   * Throws if required P0 components are missing.
   *
   * Required: faceDetector, qualityAssessor, headPoseEstimator, faceTracker, metricsCalculator.
   */
  build(): BiometricEngine {
    if (!this.config.faceDetector) {
      throw new Error('[BiometricEngineBuilder] faceDetector is required');
    }
    if (!this.config.qualityAssessor) {
      throw new Error('[BiometricEngineBuilder] qualityAssessor is required');
    }
    if (!this.config.headPoseEstimator) {
      throw new Error('[BiometricEngineBuilder] headPoseEstimator is required');
    }
    if (!this.config.faceTracker) {
      throw new Error('[BiometricEngineBuilder] faceTracker is required');
    }
    if (!this.config.metricsCalculator) {
      throw new Error('[BiometricEngineBuilder] metricsCalculator is required');
    }

    // Use the private constructor via a cast — BiometricEngine.create() is the public API
    return new (BiometricEngine as unknown as { new (config: IBiometricEngineConfig): BiometricEngine })(
      this.config,
    );
  }

  /**
   * Build a BiometricEngine, filling missing P0 components with default implementations.
   * Optional P1/P2 components (puzzle, embeddingComputer, cardDetector, voiceProcessor)
   * remain null if not explicitly set.
   *
   * @see demo_local_fast.py lines 1249-1256 (default component initialization)
   */
  buildWithDefaults(): BiometricEngine {
    // Fill P0 defaults
    if (!this.config.faceDetector) {
      this.config.faceDetector = new FaceDetector();
    }
    if (!this.config.qualityAssessor) {
      this.config.qualityAssessor = new QualityAssessor();
    }
    if (!this.config.headPoseEstimator) {
      this.config.headPoseEstimator = new HeadPoseEstimator();
    }
    if (!this.config.faceTracker) {
      this.config.faceTracker = new FaceTracker();
    }
    if (!this.config.metricsCalculator) {
      this.config.metricsCalculator = new FaceMetricsCalculator();
    }
    if (!this.config.livenessDetector) {
      this.config.livenessDetector = new PassiveLivenessDetector();
    }

    return this.build();
  }
}
