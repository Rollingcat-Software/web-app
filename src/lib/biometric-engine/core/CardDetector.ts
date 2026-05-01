/**
 * CardDetector — Client-side YOLO card type detection via ONNX Runtime Web.
 *
 * Uses a YOLOv8 model exported to ONNX to detect Turkish ID cards, passports,
 * driver licenses, and student/academic cards directly in the browser.
 * Falls back to a "not available" result when the ONNX model cannot be loaded.
 *
 * Model: yolo-card-nano.onnx (~50 MB FP16)
 * Input: 640×640×3 float32, normalized [0,1], NCHW layout
 * Output: YOLOv8 format [1, 4+C, 8400]
 *
 * Classes: loaded at runtime from `/models/labels.json`. Do NOT hardcode
 * the class order in this file. The YOLO training-time order is NOT
 * alphabetical — it was, until 2026-05-01, the source of a "Yanlış buluyor"
 * production bug where every detection was off-by-N. The canonical mapping
 * (extracted from the ONNX `metadata_props.names` field) is:
 *   {0: 'ehliyet', 1: 'pasaport', 2: 'ogrenci_karti',
 *    3: 'tc_kimlik', 4: 'akademisyen_karti'}
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9
 * @see public/models/labels.json — single source of truth for class order
 * @see public/models/README.md
 */

import type { ICardDetector } from '../interfaces';
import type { BoundingBox, CardDetectionResult } from '../types';
import {
  CARD_CONFIDENCE,
  CARD_HIGH_CONFIDENCE,
  CARD_INPUT_SIZE,
  SMOOTHING_HISTORY,
  SMOOTHING_MIN_DETECTIONS,
} from './constants';

const MODEL_URL = '/models/yolo-card-nano.onnx';
const LABELS_URL = '/models/labels.json';
const IOU_THRESHOLD = 0.45;
const NUM_ANCHORS = 8400;

/**
 * Fallback class order used only if `labels.json` cannot be loaded
 * (e.g. SSR hydration or offline cache miss). This mirrors the canonical
 * training-time order embedded in the ONNX `metadata_props.names` field.
 *
 * Verified 2026-05-01 by reading the raw ONNX bytes — see labels.json.
 *
 * IMPORTANT: this is the WIRE order, NOT alphabetical. Reordering this
 * array silently breaks every detection.
 */
export const FALLBACK_CLASS_NAMES: readonly string[] = [
  'ehliyet',
  'pasaport',
  'ogrenci_karti',
  'tc_kimlik',
  'akademisyen_karti',
] as const;

/**
 * Human-readable labels for each known card class slug. Used as a final
 * cosmetic fallback for `cardLabel`. Production UI should resolve labels
 * via the i18n bundle (`cardDetection.classLabels.<slug>`) rather than
 * relying on these strings.
 */
const CLASS_LABELS: Readonly<Record<string, string>> = {
  tc_kimlik: 'Turkish ID Card',
  ehliyet: 'Driver License',
  pasaport: 'Passport',
  ogrenci_karti: 'Student Card',
  akademisyen_karti: 'Academic Card',
};

/**
 * Internal raw detection box before coordinate transform.
 */
interface RawBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  confidence: number;
  classIdx: number;
}

/**
 * Entry in the temporal smoothing history buffer.
 * @see demo_local_fast.py lines 1069-1115 (temporal smoothing)
 */
interface SmoothingEntry {
  classIdx: number;
  confidence: number;
  box: BoundingBox;
}

/**
 * ID card detection via YOLOv8n ONNX model, running entirely in the browser (WASM).
 *
 * Lifecycle:
 * 1. Construct: `new CardDetector()`
 * 2. Initialize: `await cardDetector.initialize()`  — loads ONNX model
 * 3. Detect:     `await cardDetector.detect(videoEl)` — runs inference each call
 * 4. Dispose:    `cardDetector.dispose()` — releases ONNX session
 *
 * If initialize() fails (model file not found, OOM, etc.), isAvailable() returns false
 * and detect() returns a "not detected" result rather than throwing.
 *
 * Temporal smoothing (useSmoothing=true, the default) reduces flickering by requiring
 * the same class to appear in SMOOTHING_MIN_DETECTIONS of the last SMOOTHING_HISTORY
 * frames before reporting a confirmed detection.
 *
 * @example
 * ```typescript
 * const detector = new CardDetector();
 * await detector.initialize();
 *
 * if (detector.isAvailable()) {
 *   const result = await detector.detect(videoElement);
 *   if (result.detected) {
 *     console.log(`Found: ${result.cardLabel} (${result.confidence.toFixed(2)})`);
 *   }
 * }
 * ```
 */
export class CardDetector implements ICardDetector {
  /** ONNX InferenceSession — typed as `any` to avoid bundling ort types at build time. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;

  /** Whether the ONNX model was successfully loaded and is ready for inference. */
  private ready = false;

  /** Initialization error message, if any. */
  private initError: string | null = null;

  /** Temporal smoothing history buffer. @see demo_local_fast.py line 1069 */
  private smoothingHistory: Array<SmoothingEntry | null> = [];

  /**
   * Class index → name mapping for this model. Loaded from labels.json at
   * initialize() time so adding/retraining the model does not require a
   * code change in this file. Defaults to FALLBACK_CLASS_NAMES if the
   * fetch fails (still uses correct training order).
   */
  private classNames: readonly string[] = FALLBACK_CLASS_NAMES;

  /**
   * Load the YOLO ONNX model and prepare the WASM execution provider.
   *
   * Model input:  [1, 3, 640, 640] float32 NCHW, normalized to [0,1]
   * Model output: [1, 5+C, 8400] float32 YOLOv8 predictions
   *
   * Uses 2 WASM threads (conservative, to avoid cross-origin issues in iframes).
   *
   * @param modelUrl - Path or URL to yolo-card-nano.onnx. Defaults to /models/yolo-card-nano.onnx.
   */
  async initialize(modelUrl = MODEL_URL, labelsUrl = LABELS_URL): Promise<void> {
    try {
      // --- Load class label mapping (canonical training-order names) ---
      // Single source of truth lives in /models/labels.json — extracted from
      // the ONNX metadata_props "names" field. Falls back gracefully on
      // fetch failure to avoid a hard outage in degraded network states.
      try {
        const labelsRes = await fetch(labelsUrl, { cache: 'force-cache' });
        if (labelsRes.ok) {
          const labelsJson = (await labelsRes.json()) as { classes?: unknown };
          const classes = labelsJson.classes;
          if (Array.isArray(classes) && classes.every((c) => typeof c === 'string')) {
            this.classNames = classes as string[];
          } else {
            console.warn(
              '[CardDetector] labels.json.classes is malformed; using fallback order.',
            );
          }
        } else {
          console.warn(
            `[CardDetector] labels.json fetch failed (${labelsRes.status}); using fallback order.`,
          );
        }
      } catch (labelsErr) {
        console.warn(
          '[CardDetector] labels.json fetch error; using fallback order:',
          labelsErr,
        );
      }

      // Dynamic import avoids bundling the ~5MB WASM runtime at build time.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — onnxruntime-web is loaded at runtime
      const ort = await import('onnxruntime-web');

      // See VoiceVAD.ts for the full note — ort.env.wasm.wasmPaths is
      // required or Apache returns index.html for /ort-wasm-*.wasm.
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
      // Use WASM backend — no GPU needed, works in all browsers
      ort.env.wasm.numThreads = 2;

      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.ready = true;
      this.initError = null;
    } catch (err) {
      this.ready = false;
      // eslint-disable-next-line no-restricted-syntax -- engine init error stored for diagnostic; UI layer formats display
      this.initError = err instanceof Error ? err.message : String(err);
      console.warn('[CardDetector] ONNX model not available, detection disabled:', err);
    }
  }

  /**
   * Test-only seam: expose the resolved class-name list so unit tests can
   * pin the ordering against `FALLBACK_CLASS_NAMES` and against a
   * test-provided labels.json. Returns a defensive copy.
   */
  getClassNames(): readonly string[] {
    return this.classNames.slice();
  }

  /**
   * Run card detection on a video frame.
   *
   * Pre-processing:
   * 1. Letterbox-resize source to 640×640 with gray padding, preserving aspect ratio
   * 2. Convert RGBA pixels to RGB float32 normalized [0,1] in NCHW layout
   *
   * Post-processing:
   * 1. Parse YOLOv8 output [1, 5+C, 8400] — transposed anchor-first layout
   * 2. Filter anchors by confidence ≥ CARD_CONFIDENCE
   * 3. Pick highest-confidence anchor (single NMS-free pass — adequate for single-class focus)
   * 4. Transform box from 640×640 padded space back to source pixel coordinates
   * 5. Optionally apply temporal smoothing (useSmoothing=true by default)
   *
   * @param video - Live video element to capture frame from
   * @param useSmoothing - Whether to apply temporal smoothing (default: true)
   * @returns CardDetectionResult; detected=false when no card found or model unavailable
   */
  async detect(video: HTMLVideoElement, useSmoothing = true): Promise<CardDetectionResult> {
    const notDetected: CardDetectionResult = {
      detected: false,
      cardClass: null,
      cardLabel: null,
      confidence: 0,
      boundingBox: null,
    };

    if (!this.ready || !this.session) {
      return notDetected;
    }

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;

    if (srcW === 0 || srcH === 0) {
      return notDetected;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — onnxruntime-web is loaded at runtime
      const ort = await import('onnxruntime-web');

      // --- Step 1: Letterbox frame to 640×640 with gray (128/255) padding ---
      const canvas = document.createElement('canvas');
      canvas.width = CARD_INPUT_SIZE;
      canvas.height = CARD_INPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return notDetected;

      const scale = Math.min(CARD_INPUT_SIZE / srcW, CARD_INPUT_SIZE / srcH);
      const scaledW = Math.round(srcW * scale);
      const scaledH = Math.round(srcH * scale);
      const padX = Math.round((CARD_INPUT_SIZE - scaledW) / 2);
      const padY = Math.round((CARD_INPUT_SIZE - scaledH) / 2);

      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, CARD_INPUT_SIZE, CARD_INPUT_SIZE);
      ctx.drawImage(video, padX, padY, scaledW, scaledH);

      // --- Step 2: Convert to NCHW float32 [1, 3, 640, 640] ---
      const imageData = ctx.getImageData(0, 0, CARD_INPUT_SIZE, CARD_INPUT_SIZE);
      const { data } = imageData;
      const channelSize = CARD_INPUT_SIZE * CARD_INPUT_SIZE;
      const tensor = new Float32Array(3 * channelSize);

      for (let i = 0; i < channelSize; i++) {
        const rgba = i * 4;
        tensor[i] = data[rgba] / 255;                      // R channel
        tensor[channelSize + i] = data[rgba + 1] / 255;    // G channel
        tensor[2 * channelSize + i] = data[rgba + 2] / 255; // B channel
      }

      // --- Step 3: Run ONNX inference ---
      const inputTensor = new ort.Tensor('float32', tensor, [1, 3, CARD_INPUT_SIZE, CARD_INPUT_SIZE]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = this.session as any;
      // YOLOv8 export uses 'images' as the canonical input name
      const inputName: string = session.inputNames?.[0] ?? 'images';
      const feeds: Record<string, unknown> = { [inputName]: inputTensor };
      const outputs = await session.run(feeds);

      // --- Step 4: Parse YOLOv8 output [1, 4+C, 8400] ---
      // Layout (transposed): for anchor a, element at row r is: output[r * NUM_ANCHORS + a]
      // Rows 0-3 = cx, cy, w, h  (in 640×640 padded space)
      // Rows 4..4+C-1 = class confidence scores
      const outputKey = Object.keys(outputs)[0];
      const output = outputs[outputKey].data as Float32Array;
      const numClasses = this.classNames.length;

      const best = this.findBestAnchor(output, numClasses);
      if (!best) {
        this.pushSmoothing(null);
        return useSmoothing ? this.resolveSmoothed() : notDetected;
      }

      // --- Defensive runtime gate ---
      // Refuse to commit a class label below CARD_HIGH_CONFIDENCE — the
      // model is known to confuse tc_kimlik/ehliyet and ogrenci_karti/
      // akademisyen_karti, so a low-confidence top-1 guess is a UX hazard.
      // We still feed the entry into the smoothing buffer so multi-frame
      // agreement can still confirm; we just refuse to publish a single
      // marginal frame as "detected".
      if (best.confidence < CARD_HIGH_CONFIDENCE) {
        this.pushSmoothing(null);
        return useSmoothing ? this.resolveSmoothed() : notDetected;
      }

      // --- Step 5: Transform box from padded 640×640 back to source pixel coordinates ---
      const x1 = (best.cx - best.w / 2 - padX) / scale;
      const y1 = (best.cy - best.h / 2 - padY) / scale;
      const x2 = (best.cx + best.w / 2 - padX) / scale;
      const y2 = (best.cy + best.h / 2 - padY) / scale;

      const boundingBox: BoundingBox = {
        x: Math.max(0, Math.round(x1)),
        y: Math.max(0, Math.round(y1)),
        width: Math.max(0, Math.round(x2 - x1)),
        height: Math.max(0, Math.round(y2 - y1)),
      };

      const entry: SmoothingEntry = {
        classIdx: best.classIdx,
        confidence: best.confidence,
        box: boundingBox,
      };

      this.pushSmoothing(entry);

      if (useSmoothing) {
        return this.resolveSmoothed();
      }

      return this.buildResult(entry);
    } catch (err) {
      console.error('[CardDetector] Inference error:', err);
      return notDetected;
    }
  }

  /** Whether the ONNX model is loaded and ready. */
  isAvailable(): boolean {
    return this.ready;
  }

  /** Get the initialization error message, if any. */
  getError(): string | null {
    return this.initError;
  }

  /** Release the ONNX InferenceSession and all associated resources. */
  dispose(): void {
    if (this.session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.session as any).release?.();
      this.session = null;
    }
    this.ready = false;
    this.smoothingHistory = [];
  }

  // ===== Private Helpers =====

  /**
   * Scan all 8400 anchors and return the highest-confidence one above threshold.
   *
   * YOLOv8 does not require explicit objectness — class scores act directly as confidence.
   * We pick the single best anchor (no multi-box NMS needed for single-object card use case).
   *
   * @param output - Raw model output Float32Array, shape [1, 5+C, 8400] flattened
   * @param numClasses - Number of output classes (5 for this model)
   * @returns Best RawBox, or null if no anchor exceeds CARD_CONFIDENCE
   */
  private findBestAnchor(output: Float32Array, numClasses: number): RawBox | null {
    let bestConf = CARD_CONFIDENCE;
    let bestClassIdx = -1;
    let bestCx = 0;
    let bestCy = 0;
    let bestW = 0;
    let bestH = 0;

    for (let a = 0; a < NUM_ANCHORS; a++) {
      const cx = output[0 * NUM_ANCHORS + a];
      const cy = output[1 * NUM_ANCHORS + a];
      const w  = output[2 * NUM_ANCHORS + a];
      const h  = output[3 * NUM_ANCHORS + a];

      for (let c = 0; c < numClasses; c++) {
        const conf = output[(4 + c) * NUM_ANCHORS + a];
        if (conf > bestConf) {
          bestConf = conf;
          bestClassIdx = c;
          bestCx = cx;
          bestCy = cy;
          bestW = w;
          bestH = h;
        }
      }
    }

    if (bestClassIdx === -1) return null;

    return {
      cx: bestCx,
      cy: bestCy,
      w: bestW,
      h: bestH,
      confidence: bestConf,
      classIdx: bestClassIdx,
    };
  }

  /**
   * Push a new entry into the temporal smoothing buffer.
   * The buffer is capped at SMOOTHING_HISTORY (5) entries.
   *
   * @param entry - Detection to add, or null if no detection this frame
   */
  private pushSmoothing(entry: SmoothingEntry | null): void {
    this.smoothingHistory.push(entry);
    if (this.smoothingHistory.length > SMOOTHING_HISTORY) {
      this.smoothingHistory.shift();
    }
  }

  /**
   * Resolve the smoothed detection from the history buffer.
   *
   * Requires SMOOTHING_MIN_DETECTIONS consistent class detections in the window
   * before reporting a confirmed card. When confirmed, returns the detection with
   * the highest confidence in the window.
   *
   * @returns CardDetectionResult based on the smoothing window
   */
  private resolveSmoothed(): CardDetectionResult {
    const notDetected: CardDetectionResult = {
      detected: false,
      cardClass: null,
      cardLabel: null,
      confidence: 0,
      boundingBox: null,
    };

    const valid = this.smoothingHistory.filter((e): e is SmoothingEntry => e !== null);
    if (valid.length < SMOOTHING_MIN_DETECTIONS) return notDetected;

    // Find the most frequent class in the window
    const classCounts = new Map<number, number>();
    for (const entry of valid) {
      classCounts.set(entry.classIdx, (classCounts.get(entry.classIdx) ?? 0) + 1);
    }

    let dominantClass = -1;
    let dominantCount = 0;
    for (const [classIdx, count] of classCounts) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantClass = classIdx;
      }
    }

    if (dominantCount < SMOOTHING_MIN_DETECTIONS) return notDetected;

    // Return the highest-confidence detection of the dominant class
    const candidates = valid.filter(e => e.classIdx === dominantClass);
    const best = candidates.reduce((prev, cur) =>
      cur.confidence > prev.confidence ? cur : prev,
    );

    return this.buildResult(best);
  }

  /**
   * Convert a SmoothingEntry to the public CardDetectionResult shape.
   *
   * @param entry - Confirmed detection entry
   * @returns CardDetectionResult with all fields populated
   */
  private buildResult(entry: SmoothingEntry): CardDetectionResult {
    const className = this.classNames[entry.classIdx];
    if (!className) {
      // Defensive: model returned an out-of-range class index. Treat as
      // unrecognised rather than displaying garbage.
      return {
        detected: false,
        cardClass: null,
        cardLabel: null,
        confidence: entry.confidence,
        boundingBox: entry.box,
      };
    }
    return {
      detected: true,
      cardClass: className,
      cardLabel: CLASS_LABELS[className] ?? className,
      confidence: entry.confidence,
      boundingBox: entry.box,
    };
  }
}

// Re-export IOU_THRESHOLD for tests / advanced usage
export { IOU_THRESHOLD };
