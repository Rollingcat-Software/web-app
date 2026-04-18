/**
 * useVoiceRecorder — Web Audio API recording with real-time waveform and WAV conversion.
 *
 * Records audio via MediaRecorder (WebM), provides real-time waveform via AnalyserNode,
 * and auto-converts to WAV 16kHz mono on stop via the shared
 * {@link encodeToWav16kMono} helper so client-side Silero VAD can gate the
 * upload before it reaches the server.
 *
 * @see src/features/auth/utils/audioToWav16k.ts — conversion helper.
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useVoiceRecorder)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatApiError } from '@utils/formatApiError';
import { encodeToWav16kMono } from '@/features/auth/utils/audioToWav16k';

/** AnalyserNode FFT size for waveform. */
const FFT_SIZE = 256;
/** Waveform update interval (ms). */
const WAVEFORM_INTERVAL_MS = 50;

export interface UseVoiceRecorderReturn {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRecording: boolean;
  duration: number;
  waveform: Uint8Array | null;
  blob: Blob | null;
  wav16k: Blob | null;
  error: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const { t: translate } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<Uint8Array | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [wav16k, setWav16k] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, []);

  const stopInternal = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (waveformTimerRef.current) {
      clearInterval(waveformTimerRef.current);
      waveformTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  };

  const start = useCallback(async () => {
    try {
      setError(null);
      setBlob(null);
      setWav16k(null);
      setDuration(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup analyser for waveform
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // 100ms timeslice
      startTimeRef.current = performance.now();
      setIsRecording(true);

      // Duration timer
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((performance.now() - startTimeRef.current) / 1000));
      }, 500);

      // Waveform timer
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      waveformTimerRef.current = setInterval(() => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(freqData);
          setWaveform(new Uint8Array(freqData));
        }
      }, WAVEFORM_INTERVAL_MS);
    } catch (err) {
      setError(formatApiError(err, translate));
    }
  }, [translate]);

  const stop = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = async () => {
        setIsRecording(false);

        // Build WebM blob
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(webmBlob);

        // Convert WebM → 16kHz mono PCM WAV so Silero VAD can gate the
        // upload. Shared with the enrollment flow for consistency.
        try {
          const wavBlob = await encodeToWav16kMono(webmBlob);
          setWav16k(wavBlob);
        } catch (err) {
          setError(formatApiError(err, translate));
        }

        stopInternal();
        resolve();
      };

      recorder.stop();
    });
  }, [translate]);

  return { start, stop, isRecording, duration, waveform, blob, wav16k, error };
}
