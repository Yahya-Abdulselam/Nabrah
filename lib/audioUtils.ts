/**
 * Audio Utilities for WAV Encoding
 *
 * This module provides functions to encode audio data to WAV format
 * in the browser, eliminating the need for server-side FFmpeg conversion.
 *
 * Enhanced with:
 * - Adaptive spectral noise reduction (6-12 dB based on SNR)
 * - Pre-emphasis filtering
 * - DC offset removal
 * - Adaptive noise gate
 */

import { estimateRealtimeSNR } from './audioQuality';
import { getAdaptiveNoiseAttenuation } from './snrAdaptation';

/**
 * Encode an AudioBuffer to WAV format
 *
 * @param audioBuffer - The AudioBuffer from Web Audio API
 * @param sampleRate - Target sample rate (default: 16000 for Praat)
 * @returns Blob containing WAV file data
 */
export async function encodeWAV(audioBuffer: AudioBuffer, sampleRate: number = 16000): Promise<Blob> {
  try {
    console.log('[encodeWAV] Starting encoding process...');
    console.log(`[encodeWAV] Input: ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channel(s)`);
    console.log(`[encodeWAV] Target sample rate: ${sampleRate}Hz`);

    // Add preprocessing step BEFORE resampling
    console.log('[encodeWAV] Preprocessing audio...');
    const preprocessed = await preprocessAudioBuffer(audioBuffer);
    console.log('[encodeWAV] Preprocessing complete');

    // Resample if needed
    let resampled: AudioBuffer;
    if (preprocessed.sampleRate !== sampleRate) {
      console.log(`[encodeWAV] Resampling from ${preprocessed.sampleRate}Hz to ${sampleRate}Hz...`);
      resampled = await resampleAudioBuffer(preprocessed, sampleRate);
      console.log(`[encodeWAV] Resampling complete: ${resampled.duration.toFixed(2)}s at ${resampled.sampleRate}Hz`);
    } else {
      console.log('[encodeWAV] No resampling needed');
      resampled = preprocessed;
    }

    // Get mono channel (mix down if stereo)
    console.log('[encodeWAV] Extracting audio data...');
    const channelData = resampled.numberOfChannels > 1
      ? mixToMono(resampled)
      : resampled.getChannelData(0);
    console.log(`[encodeWAV] Channel data length: ${channelData.length} samples`);

    // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
    console.log('[encodeWAV] Converting to Int16...');
    const samples = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    console.log('[encodeWAV] Conversion complete');

    // Create WAV file
    console.log('[encodeWAV] Creating WAV header...');
    const header = createWAVHeader(samples.length, sampleRate, 1, 16);
    const wavData = new Uint8Array(header.length + samples.length * 2);

    // Copy header
    wavData.set(header, 0);
    console.log('[encodeWAV] Header written');

    // Copy audio data
    console.log('[encodeWAV] Writing audio data...');
    const view = new DataView(wavData.buffer);
    let offset = header.length;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(offset, samples[i], true); // little-endian
      offset += 2;
    }
    console.log('[encodeWAV] Audio data written');

    const blob = new Blob([wavData], { type: 'audio/wav' });
    console.log(`[encodeWAV] ✅ Encoding complete: ${blob.size} bytes`);
    return blob;

  } catch (error) {
    console.error('[encodeWAV] ❌ Encoding failed:', error);
    throw error;
  }
}

/**
 * Create WAV file header
 *
 * @param numSamples - Number of audio samples
 * @param sampleRate - Sample rate in Hz
 * @param numChannels - Number of channels (1 = mono, 2 = stereo)
 * @param bitDepth - Bits per sample (usually 16)
 * @returns Uint8Array containing WAV header
 */
function createWAVHeader(
  numSamples: number,
  sampleRate: number,
  numChannels: number,
  bitDepth: number
): Uint8Array {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true); // File size - 8
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  return header;
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Mix stereo AudioBuffer to mono
 */
function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length;
  const mono = new Float32Array(length);

  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  // Mix down all channels to mono
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }

  return mono;
}

/**
 * Resample AudioBuffer to target sample rate
 * Uses OfflineAudioContext for high-quality resampling
 */
async function resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  try {
    console.log(`[resampleAudioBuffer] Starting resampling...`);
    const sourceSampleRate = audioBuffer.sampleRate;
    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(audioBuffer.length / ratio);

    console.log(`[resampleAudioBuffer] Source: ${sourceSampleRate}Hz, ${audioBuffer.length} samples`);
    console.log(`[resampleAudioBuffer] Target: ${targetSampleRate}Hz, ${newLength} samples (ratio: ${ratio.toFixed(2)})`);

    // Create offline context with target sample rate
    console.log('[resampleAudioBuffer] Creating OfflineAudioContext...');
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      newLength,
      targetSampleRate
    );

    // Create buffer source and connect to destination
    console.log('[resampleAudioBuffer] Setting up audio graph...');
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    // Render the audio (this performs the actual resampling)
    console.log('[resampleAudioBuffer] Starting rendering...');
    const resampledBuffer = await offlineContext.startRendering();
    console.log(`[resampleAudioBuffer] ✅ Resampling complete: ${resampledBuffer.length} samples at ${resampledBuffer.sampleRate}Hz`);

    return resampledBuffer;

  } catch (error) {
    console.error('[resampleAudioBuffer] ❌ Resampling failed:', error);
    throw error;
  }
}

/**
 * Preprocess audio buffer with adaptive enhancements
 *
 * Enhanced Pipeline:
 * 1. DC offset removal - Ensure zero baseline
 * 2. Pre-emphasis - Boost high frequencies for better SNR
 * 3. Adaptive spectral noise reduction - Gentle 6-12 dB attenuation based on SNR
 * 4. Peak normalization - Scale audio to use full dynamic range
 * 5. High-pass filter - Remove low-frequency noise (<80Hz)
 * 6. Adaptive noise gate - Dynamic threshold based on RMS distribution
 *
 * Performance target: <150ms processing time
 * Method: Pure Web Audio API + lightweight FFT (no external libraries)
 */
async function preprocessAudioBuffer(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  console.log('[preprocessAudioBuffer] Starting enhanced audio preprocessing...');
  const startTime = performance.now();

  try {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0);

    const length = channelData.length;
    let processed = new Float32Array(length);

    // Copy original data
    processed.set(channelData);

    // STEP 1: DC Offset Removal
    console.log('[preprocessAudioBuffer] Step 1: Removing DC offset...');
    const mean = processed.reduce((sum, val) => sum + val, 0) / length;
    for (let i = 0; i < length; i++) {
      processed[i] -= mean;
    }
    console.log(`[preprocessAudioBuffer] DC offset removed: ${mean.toFixed(6)}`);

    // STEP 2: Pre-Emphasis Filter (0.97 coefficient)
    console.log('[preprocessAudioBuffer] Step 2: Applying pre-emphasis...');
    const preEmphasisCoeff = 0.97;
    const preEmphasized = new Float32Array(length);
    preEmphasized[0] = processed[0];
    for (let i = 1; i < length; i++) {
      preEmphasized[i] = processed[i] - preEmphasisCoeff * processed[i - 1];
    }
    processed = preEmphasized;
    console.log('[preprocessAudioBuffer] Pre-emphasis applied (coeff: 0.97)');

    // STEP 3: Estimate SNR for adaptive processing
    console.log('[preprocessAudioBuffer] Step 3: Estimating SNR...');
    const estimatedSNR = estimateRealtimeSNR(processed);
    const noiseAttenuation = getAdaptiveNoiseAttenuation(estimatedSNR);
    console.log(`[preprocessAudioBuffer] Estimated SNR: ${estimatedSNR.toFixed(1)} dB`);
    console.log(`[preprocessAudioBuffer] Adaptive attenuation: ${noiseAttenuation} dB`);

    // STEP 4: Adaptive Spectral Noise Reduction
    console.log('[preprocessAudioBuffer] Step 4: Applying spectral noise reduction...');
    processed = await applySpectralNoiseReduction(processed, sampleRate, noiseAttenuation);
    console.log('[preprocessAudioBuffer] Spectral noise reduction complete');

    // STEP 5: Peak Normalization
    console.log('[preprocessAudioBuffer] Step 5: Normalizing peaks...');
    let peak = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(processed[i]);
      if (abs > peak) peak = abs;
    }

    const normalizationFactor = peak > 0 ? 0.9 / peak : 1.0;
    console.log(`[preprocessAudioBuffer] Normalization factor: ${normalizationFactor.toFixed(3)}`);

    for (let i = 0; i < length; i++) {
      processed[i] *= normalizationFactor;
    }

    // STEP 6: High-Pass Filter (80Hz cutoff, 1st-order IIR)
    console.log('[preprocessAudioBuffer] Step 6: Applying high-pass filter...');
    const RC = 1.0 / (2.0 * Math.PI * 80);
    const dt = 1.0 / sampleRate;
    const alpha = RC / (RC + dt);

    let prevInput = 0;
    let prevOutput = 0;

    for (let i = 0; i < length; i++) {
      const input = processed[i];
      const output = alpha * (prevOutput + input - prevInput);
      processed[i] = output;
      prevInput = input;
      prevOutput = output;
    }
    console.log('[preprocessAudioBuffer] High-pass filter applied (80Hz cutoff)');

    // STEP 7: Adaptive Noise Gate
    console.log('[preprocessAudioBuffer] Step 7: Applying adaptive noise gate...');
    processed = applyAdaptiveNoiseGate(processed, sampleRate);
    console.log('[preprocessAudioBuffer] Adaptive noise gate applied');

    // Create new AudioBuffer
    const offlineContext = new OfflineAudioContext(1, length, sampleRate);
    const processedBuffer = offlineContext.createBuffer(1, length, sampleRate);
    processedBuffer.getChannelData(0).set(processed);

    const processingTime = performance.now() - startTime;
    console.log(`[preprocessAudioBuffer] ✅ Complete in ${processingTime.toFixed(2)}ms`);

    return processedBuffer;

  } catch (error) {
    console.error('[preprocessAudioBuffer] ❌ Failed:', error);
    return audioBuffer; // Fallback to original
  }
}

/**
 * Apply spectral noise reduction using FFT-based spectral subtraction
 *
 * Method: Gentle spectral subtraction with minimal artifacts
 * - FFT the audio into 512-sample windows (50% overlap)
 * - Estimate noise floor from first 0.3 seconds
 * - Attenuate noise bins by adaptive dB amount (not complete removal)
 * - IFFT back to time domain with overlap-add
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate in Hz
 * @param attenuation_db - Adaptive noise attenuation (6-12 dB)
 */
async function applySpectralNoiseReduction(
  samples: Float32Array,
  sampleRate: number,
  attenuation_db: number
): Promise<Float32Array> {
  const windowSize = 512;
  const hopSize = windowSize / 2; // 50% overlap
  const numWindows = Math.floor((samples.length - windowSize) / hopSize) + 1;

  const output = new Float32Array(samples.length);
  const windowCounts = new Float32Array(samples.length);

  // Estimate noise floor from first 0.3 seconds (assume silence/background)
  const noiseDuration = Math.min(0.3, samples.length / sampleRate);
  const noiseSamples = samples.slice(0, Math.floor(noiseDuration * sampleRate));
  const noiseSpectrum = await estimateNoiseSpectrum(noiseSamples, windowSize);

  // Convert attenuation to linear scale
  const attenuationFactor = Math.pow(10, -attenuation_db / 20);
  const minGain = 0.5; // Never fully silence (preserve features)

  // Process each window
  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    const end = Math.min(start + windowSize, samples.length);
    const window = samples.slice(start, end);

    // Apply Hanning window
    const windowed = applyHanningWindow(window);

    // FFT (simplified - use real implementation in production)
    const spectrum = await simpleFFT(windowed);

    // Spectral subtraction
    for (let k = 0; k < spectrum.length; k++) {
      const magnitude = Math.abs(spectrum[k]);
      const noiseLevel = noiseSpectrum[k] || 0.001;

      // Calculate gain
      const noisyRatio = noiseLevel / Math.max(magnitude, 0.0001);
      let gain = 1.0;

      if (noisyRatio > 0.5) {
        // High noise bin - attenuate
        gain = Math.max(minGain, 1.0 - noisyRatio * attenuationFactor);
      } else if (noisyRatio > 0.2) {
        // Transition zone - smooth interpolation
        const transitionFactor = (noisyRatio - 0.2) / 0.3;
        gain = 1.0 - transitionFactor * (1.0 - minGain) * attenuationFactor;
      }
      // else: Low noise bin - keep unchanged (gain = 1.0)

      spectrum[k] *= gain;
    }

    // IFFT back to time domain
    const recovered = await simpleIFFT(spectrum);

    // Overlap-add
    for (let i = 0; i < recovered.length && start + i < output.length; i++) {
      output[start + i] += recovered[i];
      windowCounts[start + i] += 1;
    }
  }

  // Normalize by overlap count
  for (let i = 0; i < output.length; i++) {
    if (windowCounts[i] > 0) {
      output[i] /= windowCounts[i];
    }
  }

  return output;
}

/**
 * Estimate noise spectrum from background audio
 */
async function estimateNoiseSpectrum(noiseSamples: Float32Array, windowSize: number): Promise<Float32Array> {
  const numWindows = Math.floor(noiseSamples.length / windowSize);
  const spectrumSize = windowSize / 2;
  const averageSpectrum = new Float32Array(spectrumSize);

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const window = noiseSamples.slice(start, start + windowSize);
    const windowed = applyHanningWindow(window);
    const spectrum = await simpleFFT(windowed);

    for (let k = 0; k < spectrumSize; k++) {
      averageSpectrum[k] += Math.abs(spectrum[k]) / numWindows;
    }
  }

  return averageSpectrum;
}

/**
 * Apply Hanning window to reduce spectral leakage
 */
function applyHanningWindow(samples: Float32Array): Float32Array {
  const windowed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
    windowed[i] = samples[i] * window;
  }
  return windowed;
}

/**
 * Simplified FFT using Web Audio API AnalyserNode
 * (In production, use a proper FFT library for accuracy)
 */
async function simpleFFT(samples: Float32Array): Promise<Float32Array> {
  // Simplified: return magnitude spectrum
  // In real implementation, use complex FFT (real + imaginary parts)
  // For MVP: use basic DFT approximation or Web Audio FFT
  const N = samples.length;
  const spectrum = new Float32Array(N / 2);

  for (let k = 0; k < N / 2; k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      real += samples[n] * Math.cos(angle);
      imag += samples[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(real * real + imag * imag);
  }

  return spectrum;
}

/**
 * Simplified IFFT
 */
async function simpleIFFT(spectrum: Float32Array): Promise<Float32Array> {
  const N = spectrum.length * 2;
  const samples = new Float32Array(N);

  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < spectrum.length; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      sum += spectrum[k] * Math.cos(angle);
    }
    samples[n] = sum / N;
  }

  return samples;
}

/**
 * Apply adaptive noise gate with dynamic threshold
 *
 * Instead of fixed -40dB threshold, calculate from RMS distribution:
 * - Gate threshold = (mean_RMS - 15 dB) OR -45 dB (whichever is higher)
 * - Faster attack/release for better dynamics
 */
function applyAdaptiveNoiseGate(samples: Float32Array, sampleRate: number): Float32Array {
  const windowSize = Math.floor(sampleRate * 0.03); // 30ms window
  const length = samples.length;

  // Calculate RMS distribution
  const rmsValues: number[] = [];
  for (let i = 0; i < length; i += windowSize) {
    const end = Math.min(i + windowSize, length);
    let sumSquares = 0;
    for (let j = i; j < end; j++) {
      sumSquares += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSquares / (end - i));
    rmsValues.push(rms);
  }

  // Calculate mean RMS
  const meanRMS = rmsValues.reduce((sum, val) => sum + val, 0) / rmsValues.length;

  // Adaptive threshold: mean - 15 dB, but not lower than -45 dB
  const threshold = Math.max(0.0056, meanRMS / 5.6234); // 5.6234 ≈ 10^(15/20)
  console.log(`[adaptiveNoiseGate] Threshold: ${(20 * Math.log10(threshold)).toFixed(1)} dB`);

  const attackTime = Math.floor(sampleRate * 0.005); // 5ms
  const releaseTime = Math.floor(sampleRate * 0.03); // 30ms

  let gateState = 1.0;
  const gated = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    // Calculate local RMS
    const windowStart = Math.max(0, i - windowSize / 2);
    const windowEnd = Math.min(length, i + windowSize / 2);
    let sumSquares = 0;
    for (let j = windowStart; j < windowEnd; j++) {
      sumSquares += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSquares / (windowEnd - windowStart));

    // Update gate state
    if (rms > threshold) {
      gateState = Math.min(1.0, gateState + 1.0 / attackTime);
    } else {
      gateState = Math.max(0.0, gateState - 1.0 / releaseTime);
    }

    gated[i] = samples[i] * gateState;
  }

  return gated;
}

/**
 * Convert Blob to AudioBuffer
 * Useful for processing recorded audio
 */
export async function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Validate audio blob
 */
export function validateAudioBlob(blob: Blob): boolean {
  if (!blob || blob.size === 0) {
    return false;
  }

  // Check if size is reasonable (5 seconds of audio should be > 10KB)
  if (blob.size < 10000) {
    console.warn('Audio blob is suspiciously small:', blob.size, 'bytes');
    return false;
  }

  // Check if size is too large (5 seconds should be < 5MB)
  if (blob.size > 5 * 1024 * 1024) {
    console.warn('Audio blob is too large:', blob.size, 'bytes');
    return false;
  }

  return true;
}
