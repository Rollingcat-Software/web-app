/**
 * useCardDetection — Wraps engine.cardDetector for ID card detection.
 *
 * Uses client-side ONNX model if available, falls back to server YOLO API.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useCardDetection)
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatApiError } from '@utils/formatApiError';
import type { BiometricEngine } from '../core/BiometricEngine';
import type { CardDetectionResult } from '../types';

/** Server YOLO API fallback URL. */
const CARD_DETECTION_API = '/api/v1/biometric/card/detect';

export interface UseCardDetectionReturn {
  detect: (video: HTMLVideoElement) => Promise<void>;
  isDetecting: boolean;
  isModelLoaded: boolean;
  result: CardDetectionResult | null;
  error: string | null;
}

export function useCardDetection(
  engine: BiometricEngine | null,
): UseCardDetectionReturn {
  const { t } = useTranslation();
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<CardDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectingRef = useRef(false);

  const isModelLoaded = engine?.cardDetector?.isAvailable() ?? false;

  const detect = useCallback(
    async (video: HTMLVideoElement) => {
      if (detectingRef.current) return;
      detectingRef.current = true;
      setIsDetecting(true);
      setError(null);

      try {
        // Prefer client-side ONNX model
        if (engine?.cardDetector?.isAvailable()) {
          const detection = await engine.cardDetector.detect(video);
          setResult(detection);
        } else {
          // Fallback: capture frame and send to server
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || video.width;
          canvas.height = video.videoHeight || video.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Cannot create canvas context');

          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1];

          const response = await fetch(CARD_DETECTION_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
          });

          if (!response.ok) {
            throw new Error(`Card detection API returned ${response.status}`);
          }

          const data = await response.json();
          setResult({
            detected: data.detected ?? false,
            cardClass: data.cardClass ?? null,
            cardLabel: data.cardLabel ?? null,
            confidence: data.confidence ?? 0,
            boundingBox: data.boundingBox ?? null,
          });
        }
      } catch (err) {
        setError(formatApiError(err, t));
        setResult(null);
      } finally {
        detectingRef.current = false;
        setIsDetecting(false);
      }
    },
    [engine],
  );

  return { detect, isDetecting, isModelLoaded, result, error };
}
