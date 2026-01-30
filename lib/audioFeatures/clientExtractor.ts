// Client-Side Audio Feature Extraction
// Simplified DSP for offline analysis (when Praat/Whisper unavailable)

export interface ClientAudioFeatures {
  // Signal quality metrics (already calculated in browser)
  snr_db: number; // Signal-to-noise ratio
  speech_percentage: number; // Voice activity detection (0-100%)
  rms_energy: number; // Root mean square energy

  // Client-side DSP features
  zero_crossing_rate: number; // Proxy for hoarseness (0-1)
  spectral_centroid: number; // Voice quality indicator (Hz)
  pause_count: number; // Number of pauses detected
  estimated_speech_rate: number; // Approximate syllables per second

  // Audio quality flags
  clipping_detected: boolean; // Amplitude saturation
  low_snr: boolean; // SNR < 10 dB
  insufficient_speech: boolean; // Speech < 40%

  // Processing metadata
  processing_time_ms: number;
}

// Main extraction function
export async function extractClientFeatures(
  audioBuffer: AudioBuffer
): Promise<ClientAudioFeatures> {
  const startTime = performance.now();

  console.log('[ClientExtractor] Starting feature extraction...');
  console.log('[ClientExtractor] Sample rate:', audioBuffer.sampleRate);
  console.log('[ClientExtractor] Duration:', audioBuffer.duration, 'seconds');

  // Get audio data from first channel (mono)
  const audioData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Calculate features
  const rmsEnergy = calculateRMS(audioData);
  const zeroCrossingRate = calculateZeroCrossingRate(audioData);
  const spectralCentroid = await calculateSpectralCentroid(audioData, sampleRate);
  const { snr, noiseFloor } = estimateSNR(audioData, rmsEnergy);
  const speechPercentage = estimateVAD(audioData, noiseFloor);
  const pauseCount = countPauses(audioData, sampleRate, noiseFloor);
  const estimatedSpeechRate = estimateSpeechRate(pauseCount, audioBuffer.duration);
  const clippingDetected = detectClipping(audioData);

  const processingTime = performance.now() - startTime;

  const features: ClientAudioFeatures = {
    snr_db: snr,
    speech_percentage: speechPercentage,
    rms_energy: rmsEnergy,
    zero_crossing_rate: zeroCrossingRate,
    spectral_centroid: spectralCentroid,
    pause_count: pauseCount,
    estimated_speech_rate: estimatedSpeechRate,
    clipping_detected: clippingDetected,
    low_snr: snr < 10,
    insufficient_speech: speechPercentage < 40,
    processing_time_ms: processingTime,
  };

  console.log('[ClientExtractor] Features extracted:', features);
  return features;
}

// Calculate Root Mean Square (RMS) energy
function calculateRMS(audioData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  return Math.sqrt(sum / audioData.length);
}

// Calculate Zero Crossing Rate (ZCR)
// High ZCR indicates unvoiced/noisy speech (potential hoarseness)
function calculateZeroCrossingRate(audioData: Float32Array): number {
  let crossings = 0;

  for (let i = 1; i < audioData.length; i++) {
    if (
      (audioData[i] >= 0 && audioData[i - 1] < 0) ||
      (audioData[i] < 0 && audioData[i - 1] >= 0)
    ) {
      crossings++;
    }
  }

  return crossings / audioData.length;
}

// Calculate Spectral Centroid using FFT
// Lower centroid = lower voice quality
async function calculateSpectralCentroid(
  audioData: Float32Array,
  sampleRate: number
): Promise<number> {
  // Use 2048-sample window for FFT
  const fftSize = 2048;
  const windowSize = Math.min(fftSize, audioData.length);

  // Create offline audio context for FFT
  const offlineContext = new OfflineAudioContext(1, windowSize, sampleRate);
  const buffer = offlineContext.createBuffer(1, windowSize, sampleRate);
  buffer.copyToChannel(audioData.slice(0, windowSize), 0);

  const source = offlineContext.createBufferSource();
  source.buffer = buffer;

  const analyser = offlineContext.createAnalyser();
  analyser.fftSize = fftSize;

  source.connect(analyser);
  analyser.connect(offlineContext.destination);

  source.start(0);

  // Get frequency data
  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(frequencyData);

  // Calculate spectral centroid
  let weightedSum = 0;
  let totalMagnitude = 0;

  for (let i = 0; i < frequencyData.length; i++) {
    const frequency = (i * sampleRate) / fftSize;
    const magnitude = frequencyData[i];
    weightedSum += frequency * magnitude;
    totalMagnitude += magnitude;
  }

  const centroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
  return centroid;
}

// Estimate Signal-to-Noise Ratio (SNR)
function estimateSNR(
  audioData: Float32Array,
  rmsEnergy: number
): { snr: number; noiseFloor: number } {
  // Estimate noise floor from quietest 10% of samples
  const sortedSamples = Array.from(audioData)
    .map(Math.abs)
    .sort((a, b) => a - b);

  const noiseFloorIndex = Math.floor(sortedSamples.length * 0.1);
  const noiseSamples = sortedSamples.slice(0, noiseFloorIndex);

  let noiseSum = 0;
  for (const sample of noiseSamples) {
    noiseSum += sample * sample;
  }
  const noiseFloor = Math.sqrt(noiseSum / noiseSamples.length);

  // Calculate SNR in dB
  const snr = noiseFloor > 0 ? 20 * Math.log10(rmsEnergy / noiseFloor) : 0;

  return { snr, noiseFloor };
}

// Estimate Voice Activity Detection (VAD) percentage
function estimateVAD(audioData: Float32Array, noiseFloor: number): number {
  // Threshold: 3x noise floor
  const threshold = noiseFloor * 3;

  let speechSamples = 0;
  for (const sample of audioData) {
    if (Math.abs(sample) > threshold) {
      speechSamples++;
    }
  }

  return (speechSamples / audioData.length) * 100;
}

// Count pauses (silence periods)
function countPauses(
  audioData: Float32Array,
  sampleRate: number,
  noiseFloor: number
): number {
  const threshold = noiseFloor * 2.5;
  const minPauseDurationSamples = Math.floor(sampleRate * 0.15); // 150ms minimum

  let pauses = 0;
  let silenceDuration = 0;
  let inSilence = false;

  for (const sample of audioData) {
    const isSilent = Math.abs(sample) < threshold;

    if (isSilent) {
      if (!inSilence) {
        inSilence = true;
        silenceDuration = 1;
      } else {
        silenceDuration++;
      }
    } else {
      if (inSilence && silenceDuration >= minPauseDurationSamples) {
        pauses++;
      }
      inSilence = false;
      silenceDuration = 0;
    }
  }

  // Count final silence if it's long enough
  if (inSilence && silenceDuration >= minPauseDurationSamples) {
    pauses++;
  }

  return pauses;
}

// Estimate speech rate (syllables per second)
// Approximation based on pause count and duration
function estimateSpeechRate(pauseCount: number, duration: number): number {
  // Rough heuristic: syllable count ≈ (pause_count + 1) * 3
  // Average syllable burst between pauses
  const estimatedSyllables = (pauseCount + 1) * 3;
  const speechRate = estimatedSyllables / duration;

  // Clamp to reasonable range (1-10 syllables/sec)
  return Math.max(1, Math.min(10, speechRate));
}

// Detect audio clipping (amplitude saturation)
function detectClipping(audioData: Float32Array): boolean {
  const clippingThreshold = 0.99; // 99% of max amplitude
  let clippedSamples = 0;

  for (const sample of audioData) {
    if (Math.abs(sample) > clippingThreshold) {
      clippedSamples++;
    }
  }

  // Consider clipped if more than 1% of samples are at max amplitude
  const clippingPercentage = (clippedSamples / audioData.length) * 100;
  return clippingPercentage > 1;
}

// Advanced feature: Pitch estimation using autocorrelation (optional)
export function estimatePitch(
  audioData: Float32Array,
  sampleRate: number
): number | null {
  const minPeriod = Math.floor(sampleRate / 500); // 500 Hz max
  const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min

  // Autocorrelation
  let bestCorrelation = 0;
  let bestPeriod = 0;

  for (let period = minPeriod; period < maxPeriod; period++) {
    let correlation = 0;
    for (let i = 0; i < audioData.length - period; i++) {
      correlation += audioData[i] * audioData[i + period];
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  if (bestPeriod === 0) return null;

  const fundamentalFrequency = sampleRate / bestPeriod;
  return fundamentalFrequency;
}

// Helper: Convert AudioBuffer to Float32Array (for compatibility)
export function audioBufferToFloat32Array(audioBuffer: AudioBuffer): Float32Array {
  return audioBuffer.getChannelData(0);
}

// Helper: Convert Blob to AudioBuffer
export async function blobToAudioBuffer(
  blob: Blob
): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}
