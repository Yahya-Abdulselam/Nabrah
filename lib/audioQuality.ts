/**
 * Real-Time Audio Quality Metrics
 *
 * Lightweight functions for live audio quality monitoring during recording.
 * Designed for real-time performance (< 1ms execution on mobile devices).
 *
 * Metrics:
 * - SNR (Signal-to-Noise Ratio): Estimated from amplitude distribution
 * - Voice Activity Detection: Zero-crossing rate + short-term energy
 * - Clipping Detection: Peak amplitude monitoring
 * - RMS Level: Volume monitoring
 */

export interface LiveQualityMetrics {
  rms_db: number;           // RMS level in dB (for volume meter)
  snr_estimate_db: number;  // Estimated SNR (lightweight, not FFT-based)
  voice_activity_pct: number; // % of time with voice detected
  clipping_pct: number;     // % of samples clipped
  quality_level: 'excellent' | 'good' | 'acceptable' | 'poor';
  recommendations: string[];
}

export interface QualityThresholds {
  snr: {
    excellent: number;  // >= 25 dB
    good: number;       // >= 20 dB
    acceptable: number; // >= 15 dB
    poor: number;       // < 15 dB
  };
  vad: {
    excellent: number;  // >= 70%
    good: number;       // >= 60%
    acceptable: number; // >= 40%
    poor: number;       // < 40%
  };
  clipping: {
    none: number;       // < 0.1%
    minor: number;      // < 1%
    significant: number; // >= 1%
  };
  rms: {
    good: number;       // > -20 dB
    low: number;        // > -30 dB
    veryLow: number;    // > -45 dB
  };
}

export const QUALITY_THRESHOLDS: QualityThresholds = {
  snr: {
    excellent: 25,
    good: 20,
    acceptable: 15,
    poor: 15,
  },
  vad: {
    excellent: 70,
    good: 60,
    acceptable: 40,
    poor: 40,
  },
  clipping: {
    none: 0.1,
    minor: 1.0,
    significant: 1.0,
  },
  rms: {
    good: -20,
    low: -30,
    veryLow: -45,
  },
};

/**
 * Calculate RMS (Root Mean Square) level in dB
 * Used for volume monitoring and SNR estimation
 */
export function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / samples.length);

  // Convert to dB (avoid log(0))
  return rms > 0 ? 20 * Math.log10(rms) : -100;
}

/**
 * Estimate SNR in real-time (lightweight, no FFT)
 *
 * Method: Percentile-based signal/noise separation
 * - Signal: 70th percentile of RMS (speech peaks)
 * - Noise: 30th percentile of RMS (background/pauses)
 *
 * Performance: ~1ms for 4096 samples
 */
export function estimateRealtimeSNR(samples: Float32Array): number {
  // Calculate short-term RMS for each 256-sample window
  const windowSize = 256;
  const numWindows = Math.floor(samples.length / windowSize);
  const rmsValues: number[] = [];

  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const end = start + windowSize;
    const window = samples.slice(start, end);

    let sum = 0;
    for (let j = 0; j < window.length; j++) {
      sum += window[j] * window[j];
    }
    rmsValues.push(Math.sqrt(sum / window.length));
  }

  // Sort RMS values to find percentiles
  rmsValues.sort((a, b) => a - b);

  // Signal: 70th percentile (speech peaks)
  const signalIdx = Math.floor(numWindows * 0.70);
  const signalRMS = rmsValues[signalIdx] || 0.01;

  // Noise: 30th percentile (background/pauses)
  const noiseIdx = Math.floor(numWindows * 0.30);
  const noiseRMS = rmsValues[noiseIdx] || 0.001;

  // Calculate SNR in dB
  const snr = 20 * Math.log10(signalRMS / Math.max(noiseRMS, 0.0001));

  // Clamp to reasonable range (0-50 dB)
  return Math.max(0, Math.min(50, snr));
}

/**
 * Detect voice activity using zero-crossing rate and short-term energy
 *
 * Voice characteristics:
 * - Moderate zero-crossing rate (50-150 crossings per 4096 samples)
 * - Higher short-term energy (> -30 dB)
 *
 * Performance: ~0.5ms for 4096 samples
 */
export function estimateVoiceActivity(samples: Float32Array): number {
  const windowSize = 512;
  const numWindows = Math.floor(samples.length / windowSize);
  let voicedWindows = 0;

  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const end = start + windowSize;
    const window = samples.slice(start, end);

    // Calculate zero-crossing rate (ZCR)
    let zeroCrossings = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0 && window[j - 1] < 0) ||
          (window[j] < 0 && window[j - 1] >= 0)) {
        zeroCrossings++;
      }
    }

    // Calculate short-term energy (STE)
    let energy = 0;
    for (let j = 0; j < window.length; j++) {
      energy += window[j] * window[j];
    }
    const ste_db = energy > 0 ? 10 * Math.log10(energy / window.length) : -100;

    // Voice detected if moderate ZCR and sufficient energy
    const hasVoice = zeroCrossings > 20 && zeroCrossings < 200 && ste_db > -35;
    if (hasVoice) {
      voicedWindows++;
    }
  }

  // Return percentage of voiced windows
  return numWindows > 0 ? (voicedWindows / numWindows) * 100 : 0;
}

/**
 * Detect audio clipping (peak distortion)
 *
 * Clipping occurs when audio exceeds recording range.
 * Threshold: abs(sample) > 0.98 (leave 2% headroom)
 */
export function detectClipping(samples: Float32Array): number {
  const clippingThreshold = 0.98;
  let clippedSamples = 0;

  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > clippingThreshold) {
      clippedSamples++;
    }
  }

  return samples.length > 0 ? (clippedSamples / samples.length) * 100 : 0;
}

/**
 * Calculate comprehensive real-time quality metrics
 *
 * Called every 100ms during recording with latest audio buffer.
 * Combines all quality indicators into single assessment.
 */
export function calculateLiveQualityMetrics(
  samples: Float32Array,
  previousMetrics?: LiveQualityMetrics
): LiveQualityMetrics {
  // Calculate raw metrics
  const rms_db = calculateRMS(samples);
  const snr_raw = estimateRealtimeSNR(samples);
  const voice_activity_pct = estimateVoiceActivity(samples);
  const clipping_pct = detectClipping(samples);

  // Apply exponential smoothing if we have previous metrics (reduce flickering)
  const smoothingFactor = 0.3; // 30% new, 70% old
  const snr_estimate_db = previousMetrics
    ? smoothingFactor * snr_raw + (1 - smoothingFactor) * previousMetrics.snr_estimate_db
    : snr_raw;

  // Determine overall quality level
  const quality_level = determineQualityLevel(snr_estimate_db, voice_activity_pct, clipping_pct);

  // Generate recommendations
  const recommendations = generateRecommendations(
    rms_db,
    snr_estimate_db,
    voice_activity_pct,
    clipping_pct
  );

  return {
    rms_db,
    snr_estimate_db,
    voice_activity_pct,
    clipping_pct,
    quality_level,
    recommendations,
  };
}

/**
 * Determine overall quality level from metrics
 */
function determineQualityLevel(
  snr_db: number,
  vad_pct: number,
  clipping_pct: number
): 'excellent' | 'good' | 'acceptable' | 'poor' {
  const { snr, vad, clipping } = QUALITY_THRESHOLDS;

  // Any clipping is concerning
  if (clipping_pct >= clipping.significant) {
    return 'poor';
  }

  // Check SNR and VAD combination
  if (snr_db >= snr.excellent && vad_pct >= vad.excellent) {
    return 'excellent';
  }

  if (snr_db >= snr.good && vad_pct >= vad.good) {
    return 'good';
  }

  if (snr_db >= snr.acceptable && vad_pct >= vad.acceptable) {
    return 'acceptable';
  }

  return 'poor';
}

/**
 * Generate user-friendly recommendations based on quality metrics
 */
function generateRecommendations(
  rms_db: number,
  snr_db: number,
  vad_pct: number,
  clipping_pct: number
): string[] {
  const recommendations: string[] = [];
  const { snr, vad, clipping, rms } = QUALITY_THRESHOLDS;

  // Volume issues
  if (rms_db < rms.veryLow) {
    recommendations.push('Speak louder or move closer to microphone');
  } else if (rms_db < rms.low) {
    recommendations.push('Try speaking slightly louder');
  }

  // Clipping issues
  if (clipping_pct >= clipping.significant) {
    recommendations.push('Move microphone slightly farther - audio is distorting');
  } else if (clipping_pct >= clipping.minor) {
    recommendations.push('Lower volume slightly to avoid distortion');
  }

  // SNR issues
  if (snr_db < snr.poor) {
    recommendations.push('Reduce background noise or move to quieter location');
  } else if (snr_db < snr.acceptable) {
    recommendations.push('Background noise detected - quieter environment recommended');
  }

  // Voice activity issues
  if (vad_pct < vad.poor) {
    recommendations.push('Not enough speech detected - speak clearly during recording');
  } else if (vad_pct < vad.acceptable) {
    recommendations.push('Speak more continuously - follow the prompt closely');
  }

  // If everything is good
  if (recommendations.length === 0) {
    recommendations.push('Recording quality is excellent - continue speaking');
  }

  return recommendations;
}

/**
 * Exponential moving average for smooth metric transitions
 */
export class MetricsSmoothing {
  private alpha: number;
  private smoothedValues: Map<string, number>;

  constructor(smoothingFactor: number = 0.3) {
    this.alpha = smoothingFactor;
    this.smoothedValues = new Map();
  }

  smooth(key: string, newValue: number): number {
    const oldValue = this.smoothedValues.get(key) ?? newValue;
    const smoothed = this.alpha * newValue + (1 - this.alpha) * oldValue;
    this.smoothedValues.set(key, smoothed);
    return smoothed;
  }

  reset(): void {
    this.smoothedValues.clear();
  }
}

/**
 * Format metrics for display
 */
export function formatQualityMetrics(metrics: LiveQualityMetrics): {
  snr: string;
  vad: string;
  clipping: string;
  volume: string;
  status: string;
} {
  return {
    snr: `${Math.round(metrics.snr_estimate_db)} dB`,
    vad: `${Math.round(metrics.voice_activity_pct)}%`,
    clipping: metrics.clipping_pct < 0.1
      ? 'None'
      : metrics.clipping_pct < 1.0
      ? 'Minor'
      : 'Significant',
    volume: metrics.rms_db > -20
      ? 'Good'
      : metrics.rms_db > -30
      ? 'Low'
      : 'Very Low',
    status: metrics.quality_level.charAt(0).toUpperCase() + metrics.quality_level.slice(1),
  };
}

/**
 * Get color coding for quality level
 */
export function getQualityColor(level: 'excellent' | 'good' | 'acceptable' | 'poor'): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (level) {
    case 'excellent':
    case 'good':
      return {
        bg: 'bg-green-50',
        border: 'border-green-500',
        text: 'text-green-900',
        icon: 'text-green-600',
      };
    case 'acceptable':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-500',
        text: 'text-yellow-900',
        icon: 'text-yellow-600',
      };
    case 'poor':
      return {
        bg: 'bg-red-50',
        border: 'border-red-500',
        text: 'text-red-900',
        icon: 'text-red-600',
      };
  }
}
