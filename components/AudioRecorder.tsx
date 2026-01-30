'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, StopCircle, RotateCcw, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { encodeWAV } from '@/lib/audioUtils';
import { RecordingQualityIndicator } from './RecordingQualityIndicator';
import { LiveQualityIndicator } from './LiveQualityIndicator';
import { useLanguage } from '@/lib/i18n';
import { getRecordingPrompt } from '@/lib/i18n/prompts';
import { Language } from '@/lib/i18n/types';
import {
  calculateLiveQualityMetrics,
  LiveQualityMetrics,
  MetricsSmoothing,
} from '@/lib/audioQuality';
import { analyzeOffline, shouldUseOfflineAnalysis } from '@/lib/analysis/offlineAnalyzer';
import { useNetworkStatus } from '@/lib/sync/hooks';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, language: Language) => void;
  onOfflineAnalysisComplete?: (result: any) => void;
}

export function AudioRecorder({ onRecordingComplete, onOfflineAnalysisComplete }: AudioRecorderProps) {
  const { t, language } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Preparation countdown state (3-2-1 before recording)
  const [preparationCountdown, setPreparationCountdown] = useState(0);
  const [isInPreparation, setIsInPreparation] = useState(false);

  // Live quality metrics state
  const [liveMetrics, setLiveMetrics] = useState<LiveQualityMetrics | null>(null);
  const metricsSmoothing = useRef(new MetricsSmoothing(0.3));
  const qualityUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Get language-specific recording prompt
  const recordingPrompt = getRecordingPrompt(language);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef<boolean>(false); // Use ref for immediate access in audio callback

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (qualityUpdateInterval.current) {
        clearInterval(qualityUpdateInterval.current);
      }
    };
  }, []);

  // Start live quality monitoring when recording starts
  useEffect(() => {
    if (isRecording && analyserRef.current) {
      // Update quality metrics every 100ms
      qualityUpdateInterval.current = setInterval(() => {
        updateLiveQualityMetrics();
      }, 100);

      return () => {
        if (qualityUpdateInterval.current) {
          clearInterval(qualityUpdateInterval.current);
          qualityUpdateInterval.current = null;
        }
      };
    }
  }, [isRecording]);

  // Function to update live quality metrics
  const updateLiveQualityMetrics = () => {
    if (!analyserRef.current) return;

    try {
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);

      // Get time domain data (audio samples)
      analyser.getFloatTimeDomainData(dataArray);

      // Calculate quality metrics
      const metrics = calculateLiveQualityMetrics(dataArray, liveMetrics || undefined);

      setLiveMetrics(metrics);
    } catch (error) {
      console.error('[AudioRecorder] Error updating quality metrics:', error);
    }
  };

  // Preparation countdown timer (3-2-1 before recording)
  useEffect(() => {
    if (isInPreparation && preparationCountdown > 0) {
      const timer = setTimeout(() => {
        setPreparationCountdown(preparationCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isInPreparation && preparationCountdown === 0) {
      // Preparation countdown finished - start actual recording
      console.log('[AudioRecorder] Preparation complete! Starting recording...');

      setIsInPreparation(false);
      isRecordingRef.current = true;
      setIsRecording(true);
      setCountdown(10);
    }
  }, [isInPreparation, preparationCountdown]);

  // Countdown timer
  useEffect(() => {
    if (isRecording && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isRecording && countdown === 0) {
      stopRecording();
    }
  }, [isRecording, countdown]);

  // Waveform drawing trigger - waits for canvas to be mounted and sized
  useEffect(() => {
    if (isRecording && analyserRef.current && canvasRef.current) {
      // Small delay to ensure canvas is mounted and properly sized by Framer Motion
      const timer = setTimeout(() => {
        drawWaveform();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRecording]);

  // Waveform visualization
  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas has valid dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      console.warn('Canvas not ready, dimensions are zero');
      return;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      // Get theme from document for dynamic colors
      const isDark = document.documentElement.classList.contains('dark');

      // Clear canvas with theme-aware background
      ctx.fillStyle = isDark ? 'rgb(30, 41, 59)' : 'rgb(249, 250, 251)'; // slate-800 : gray-50
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform with theme-aware stroke color
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDark ? 'rgb(96, 165, 250)' : 'rgb(37, 99, 235)'; // blue-400 : blue-600
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      // Note: Don't specify sampleRate - let browser use hardware default (usually 48kHz)
      // We'll resample to 16kHz during WAV encoding for Praat compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      streamRef.current = stream;

      // Setup Web Audio API for visualization AND recording
      // Don't specify sampleRate - auto-match microphone's native rate to avoid mismatch
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Setup analyzer for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // Setup audio processing for recording
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      audioChunksRef.current = [];

      // Start preparation countdown (3-2-1)
      isRecordingRef.current = false;  // Keep false during preparation
      setIsInPreparation(true);         // Enter preparation state
      setPreparationCountdown(3);       // 3-2-1 countdown
      setCountdown(10);                 // Pre-set recording countdown
      setPermissionDenied(false);

      processor.onaudioprocess = (event) => {
        // Use ref for immediate check (no async state delay)
        if (!isRecordingRef.current) return;

        // Get audio data
        const inputData = event.inputBuffer.getChannelData(0);

        // Store copy of audio data
        const chunk = new Float32Array(inputData.length);
        chunk.set(inputData);
        audioChunksRef.current.push(chunk);
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      // Waveform visualization will be started by useEffect when isRecording becomes true
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setPermissionDenied(true);
    }
  };

  /**
   * Trim silence from the beginning and end of an audio buffer
   * This fixes the issue where stopping recording early captures trailing silence
   * @param audioBuffer The audio buffer to trim
   * @param threshold Amplitude threshold for detecting silence (0.003 = 0.3%)
   * @returns Trimmed audio buffer
   */
  const trimSilence = (audioBuffer: AudioBuffer, threshold = 0.003): AudioBuffer => {
    if (!audioContextRef.current) return audioBuffer;

    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Add 100ms padding at start and end to avoid cutting off speech
    const paddingSamples = Math.floor(sampleRate * 0.1); // 100ms

    // Find first non-silent sample
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        start = Math.max(0, i - paddingSamples); // Add padding before speech
        break;
      }
    }

    // Find last non-silent sample
    let end = data.length - 1;
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > threshold) {
        end = Math.min(data.length - 1, i + paddingSamples); // Add padding after speech
        break;
      }
    }

    // If entire buffer is silent, return original
    if (start >= end) {
      console.warn('⚠️ Entire audio buffer appears to be silent, keeping original');
      return audioBuffer;
    }

    // Calculate trimmed duration
    const trimmedLength = end - start + 1;
    const trimmedDuration = trimmedLength / sampleRate;
    const originalDuration = audioBuffer.duration;

    // SAFETY CHECK: Don't trim if result would be too short for Praat (minimum 2 seconds)
    if (trimmedDuration < 2.0) {
      console.warn(`⚠️ Trimmed audio would be too short (${trimmedDuration.toFixed(2)}s < 2.0s), keeping original`);
      return audioBuffer;
    }

    // SAFETY CHECK: Don't trim if we're removing less than 200ms (not worth it)
    const removedMs = (originalDuration - trimmedDuration) * 1000;
    if (removedMs < 200) {
      console.log(`✓ No significant silence to trim (only ${removedMs.toFixed(0)}ms), keeping original`);
      return audioBuffer;
    }

    // Create trimmed buffer
    const trimmedBuffer = audioContextRef.current.createBuffer(
      1,
      trimmedLength,
      sampleRate
    );

    trimmedBuffer.getChannelData(0).set(data.slice(start, end + 1));

    console.log(`✂️ Trimmed ${removedMs.toFixed(0)}ms of silence (${originalDuration.toFixed(2)}s → ${trimmedDuration.toFixed(2)}s)`);
    console.log(`   Start offset: ${(start / sampleRate * 1000).toFixed(0)}ms, End trim: ${((data.length - end) / sampleRate * 1000).toFixed(0)}ms`);

    return trimmedBuffer;
  };

  const stopRecording = async () => {
    // If still in preparation countdown, stop gracefully
    if (isInPreparation) {
      setIsInPreparation(false);
      setPreparationCountdown(0);

      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Reset state
      isRecordingRef.current = false;
      setIsRecording(false);
      return;
    }

    if (!isRecording || !audioContextRef.current) return;

    // Stop recording flag immediately
    isRecordingRef.current = false;
    setIsRecording(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      console.log('Starting audio processing...');
      console.log(`Collected ${audioChunksRef.current.length} audio chunks`);

      // Combine all audio chunks
      const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      console.log(`Total audio samples: ${totalLength}`);

      if (totalLength === 0) {
        throw new Error('No audio data recorded. Please try again.');
      }

      const combinedData = new Float32Array(totalLength);

      let offset = 0;
      for (const chunk of audioChunksRef.current) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      console.log('Combined audio chunks successfully');

      // Create AudioBuffer from recorded data
      console.log(`Creating AudioBuffer with sample rate: ${audioContextRef.current.sampleRate}Hz`);
      const audioBuffer = audioContextRef.current.createBuffer(
        1,  // mono
        combinedData.length,
        audioContextRef.current.sampleRate
      );

      audioBuffer.getChannelData(0).set(combinedData);
      console.log(`AudioBuffer created: ${audioBuffer.duration.toFixed(2)}s duration`);

      // ✅ NEW: Trim silence from beginning and end
      const trimmedBuffer = trimSilence(audioBuffer);

      // Encode to WAV (resample from native rate to 16kHz for Praat)
      console.log('Starting WAV encoding and resampling...');
      console.log(`Recording sample rate: ${trimmedBuffer.sampleRate}Hz, Duration: ${trimmedBuffer.duration.toFixed(2)}s`);
      console.log('Resampling to 16kHz for Praat compatibility...');

      const wavBlob = await encodeWAV(trimmedBuffer, 16000);

      console.log(`✅ WAV blob created: ${wavBlob.size} bytes (16kHz)`);

      setAudioBlob(wavBlob);
      setHasRecorded(true);

      // Clean up
      audioChunksRef.current = [];

    } catch (error) {
      console.error('❌ Error encoding audio:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        chunks: audioChunksRef.current.length,
        contextState: audioContextRef.current?.state
      });
      alert(`Failed to encode audio: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const retryRecording = () => {
    setHasRecorded(false);
    setAudioBlob(null);
    setCountdown(10);
    setIsInPreparation(false);
    setPreparationCountdown(0);
    audioChunksRef.current = [];
    isRecordingRef.current = false;
  };

  const handleUseRecording = async () => {
    if (!audioBlob) return;

    // Check if should use offline analysis
    if (!isOnline || shouldUseOfflineAnalysis()) {
      try {
        setIsAnalyzing(true);
        console.log('[AudioRecorder] Using offline analysis (offline mode or preference)');

        const offlineResult = await analyzeOffline(
          audioBlob,
          language,
          undefined // No questionnaire data in basic recorder
        );

        console.log('[AudioRecorder] Offline analysis complete:', offlineResult);

        // If parent provides offline callback, use it
        if (onOfflineAnalysisComplete) {
          onOfflineAnalysisComplete({
            ...offlineResult.triageResult,
            isOfflineAnalysis: true,
            recordingId: offlineResult.recordingId,
            triageResultId: offlineResult.triageResultId,
            analysis_source: 'offline',
          });
        } else {
          // Fallback: still call onRecordingComplete for compatibility
          onRecordingComplete(audioBlob, language);
        }

        setIsAnalyzing(false);
        return;
      } catch (error) {
        console.error('[AudioRecorder] Offline analysis failed:', error);
        setIsAnalyzing(false);
        // Fall through to online analysis if offline fails
      }
    }

    // Original online analysis path
    console.log('[AudioRecorder] Sending WAV audio for online analysis:', audioBlob.size, 'bytes', 'Language:', language);
    onRecordingComplete(audioBlob, language);
  };

  return (
    <Card className="p-6 md:p-8">
      <div className="text-center mb-6">
        <h2 className={`text-2xl md:text-3xl font-semibold mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
          {t('recorder.title')}
        </h2>

        {/* Recording Prompt Box with Clear Label */}
        <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-200 mb-2">
            {t('recorder.sayClearly')}
          </p>
          <p className={`text-xl md:text-2xl font-bold text-blue-900 dark:text-blue-50 ${language === 'ar' ? 'font-arabic' : ''}`}>
            &quot;{recordingPrompt}&quot;
          </p>
        </div>
      </div>

      {/* Waveform Canvas - Only show during recording */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mb-6"
        >
          <div className={`text-center mb-2 ${language === 'ar' ? 'font-arabic' : ''}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'ar' ? 'تصور الموجات الصوتية' : 'Waveform Visualization'}
            </p>
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={100}
            className="w-full h-24 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700"
          />
        </motion.div>
      )}

      {/* Recording State UI */}
      <AnimatePresence mode="wait">
        {!isRecording && !hasRecorded && !isInPreparation && (
          <motion.div
            key="start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {permissionDenied && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 text-sm">
                  ❌ {t('recorder.permissionDenied')}
                </p>
              </div>
            )}

            <Button
              onClick={startRecording}
              size="lg"
              className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <Mic className={`h-6 w-6 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('recorder.startButton')}
            </Button>

            <p className="text-sm text-gray-500 text-center">
              {t('recorder.autoStop')}
            </p>
          </motion.div>
        )}

        {isInPreparation && (
          <motion.div
            key="preparation"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-4"
          >
            {/* Preparation Countdown Animation */}
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
              className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4"
            >
              <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                {preparationCountdown}
              </div>
            </motion.div>

            {/* Preparation Message */}
            <div className="space-y-2">
              <p className={`text-lg font-medium text-blue-600 dark:text-blue-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('recorder.getReady')}
              </p>
              <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('recorder.recordingWillStart')}
              </p>
            </div>

            {/* Stop Button */}
            <Button
              onClick={stopRecording}
              variant="outline"
              size="lg"
              className="w-full"
            >
              <StopCircle className={`h-5 w-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('recorder.stopButton')}
            </Button>
          </motion.div>
        )}

        {isRecording && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-4"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-red-100 mb-4"
            >
              <div className="text-5xl font-bold text-red-600">
                {countdown}
              </div>
            </motion.div>

            <div className="flex items-center justify-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <p className="font-medium text-lg">{t('recorder.recording')}</p>
            </div>

            {/* Real-time audio quality indicator (legacy) */}
            <RecordingQualityIndicator
              analyserNode={analyserRef.current}
              isRecording={isRecording}
            />

            {/* Enhanced Live Quality Indicator */}
            {liveMetrics && (
              <LiveQualityIndicator
                metrics={liveMetrics}
                isRecording={isRecording}
              />
            )}

            <Button
              onClick={stopRecording}
              variant="outline"
              size="lg"
              className="w-full"
            >
              <StopCircle className={`h-5 w-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('recorder.stopButton')}
            </Button>
          </motion.div>
        )}

        {hasRecorded && !isRecording && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-green-700">
                <CheckCircle className="h-6 w-6" />
                <p className="font-medium">{t('recorder.complete')}</p>
              </div>
              {audioBlob && (
                <p className="text-sm text-green-600 text-center mt-2">
                  {t('recorder.audioSize')}: {(audioBlob.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={retryRecording}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <RotateCcw className={`h-5 w-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {t('recorder.retryButton')}
              </Button>

              <Button
                onClick={handleUseRecording}
                size="lg"
                disabled={isAnalyzing}
                className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              >
                <CheckCircle className={`h-5 w-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {isAnalyzing ? (language === 'ar' ? 'جارٍ التحليل...' : 'Analyzing...') : t('recorder.analyzeButton')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          💡 <strong>{t('recorder.tip')}</strong>
        </p>
        <p className="text-xs text-gray-400 text-center mt-2">
          {t('recorder.browserBased')}
        </p>
      </div>
    </Card>
  );
}
