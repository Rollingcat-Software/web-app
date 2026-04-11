/**
 * useVoiceRecorder — Web Audio API recording with real-time waveform and WAV conversion.
 *
 * Records audio via MediaRecorder (WebM), provides real-time waveform via AnalyserNode,
 * and auto-converts to WAV 16kHz mono on stop.
 *
 * @see BIOMETRIC_ENGINE_ARCHITECTURE.md Section 9 (useVoiceRecorder)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatApiError } from '@utils/formatApiError';

/** WAV sample rate for server submission. */
const TARGET_SAMPLE_RATE = 16000;
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

/**
 * Convert an AudioBuffer to WAV 16kHz mono Blob.
 */
function audioBufferToWav16k(buffer: AudioBuffer): Blob {
  // Downmix to mono
  const mono = buffer.numberOfChannels === 1
    ? buffer.getChannelData(0)
    : mixToMono(buffer);

  // Resample to 16kHz
  const ratio = TARGET_SAMPLE_RATE / buffer.sampleRate;
  const outputLength = Math.floor(mono.length * ratio);
  const resampled = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i / ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, mono.length - 1);
    const frac = srcIdx - lo;
    resampled[i] = mono[lo] * (1 - frac) + mono[hi] * frac;
  }

  // Encode WAV
  const dataLength = resampled.length * 2; // 16-bit PCM
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < resampled.length; i++) {
    const sample = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const mono = new Float32Array(length);
  const channels = buffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channels;
    }
  }
  return mono;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
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
  }, []);

  const stop = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = async () => {
        setIsRecording(false);

        // Build WebM blob
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(webmBlob);

        // Convert to WAV 16kHz
        try {
          const arrayBuffer = await webmBlob.arrayBuffer();
          const offlineCtx = new AudioContext();
          const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
          const wavBlob = audioBufferToWav16k(audioBuffer);
          setWav16k(wavBlob);
          await offlineCtx.close();
        } catch (err) {
          setError(formatApiError(err, translate));
        }

        stopInternal();
        resolve();
      };

      recorder.stop();
    });
  }, []);

  return { start, stop, isRecording, duration, waveform, blob, wav16k, error };
}
