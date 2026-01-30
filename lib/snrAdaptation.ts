/**
 * SNR-Adaptive Triage System (Option A: Feature Correction + Quality Gating)
 *
 * DESIGN PHILOSOPHY:
 * ==================
 * Noise corrupts measurements, NOT pathology boundaries.
 * Therefore:
 * 1. Correct features in backend (remove measurement bias)
 * 2. Keep thresholds STABLE in frontend (clinical cutoffs stay meaningful)
 * 3. Apply quality gating (block or warn on very poor audio)
 * 4. Reduce confidence (warn user about reliability)
 * 5. Minimal point weighting (NOT aggressive threshold relaxation)
 *
 * This prevents "double compensation" that can hide real emergencies in noisy environments.
 *
 * Research-backed approach:
 * - Deliyski et al. (2005): Jitter/shimmer reliability degrades with SNR
 * - Maryn et al. (2009): HNR sensitivity to noise
 * - Titze (1995): Pause detection affected by noise floor
 *
 * WHAT WE DON'T DO (Avoided Pitfalls):
 * =====================================
 * ❌ No aggressive threshold relaxation (10-20% increases)
 * ❌ No stacking of multiple compensations
 * ❌ No confident GREEN results in garbage audio
 * ❌ No moving pathology boundaries based on room noise
 *
 * WHAT WE DO (Option A Strategy):
 * ================================
 * ✅ Backend corrects features (with safety clamps)
 * ✅ Frontend keeps thresholds stable
 * ✅ Quality-limited mode for SNR < 10 dB
 * ✅ Confidence penalty for noisy audio
 * ✅ Feature reliability weighting (minimal, conservative)
 */

import { ThresholdSet } from './thresholds';

/**
 * SNR quality bins
 */
export type SNRBin = 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';

export interface SNRBinRange {
  min: number; // dB
  max: number; // dB
  description: string;
}

export const SNR_BINS: Record<SNRBin, SNRBinRange> = {
  excellent: {
    min: 20,
    max: Infinity,
    description: 'Clean recording - standard thresholds, full confidence',
  },
  good: {
    min: 15,
    max: 20,
    description: 'Minor noise - standard thresholds, slight confidence reduction',
  },
  acceptable: {
    min: 12,
    max: 15,
    description: 'Moderate noise - standard thresholds, noticeable confidence reduction',
  },
  poor: {
    min: 10,
    max: 12,
    description: 'High noise - standard thresholds, significant confidence penalty',
  },
  critical: {
    min: 0,
    max: 10,
    description: 'Quality-limited mode - results unreliable, recommend re-recording',
  },
};

/**
 * Determine SNR bin from measured SNR value
 */
export function getSNRBin(snr_db: number): SNRBin {
  if (snr_db >= SNR_BINS.excellent.min) return 'excellent';
  if (snr_db >= SNR_BINS.good.min) return 'good';
  if (snr_db >= SNR_BINS.acceptable.min) return 'acceptable';
  if (snr_db >= SNR_BINS.poor.min) return 'poor';
  return 'critical';
}

/**
 * Feature reliability weights by SNR bin
 *
 * CONSERVATIVE APPROACH:
 * - Only noise-sensitive features (jitter/shimmer) get downweighted
 * - Pause ratio gets minimal downweighting (VAD complexity)
 * - HNR/speech_rate/voice_breaks stay at 1.0 (robust to noise)
 * - Weights are MILD (0.85/0.70, not 0.5 like before)
 */
export interface FeatureWeights {
  jitter: number;
  shimmer: number;
  hnr: number;
  pause_ratio: number;
  speech_rate: number;
  voice_breaks: number;
  whisper: number;  // Whisper confidence - robust to audio quality
}

export const FEATURE_WEIGHTS: Record<SNRBin, FeatureWeights> = {
  excellent: {
    jitter: 1.0,      // Full reliability
    shimmer: 1.0,
    hnr: 1.0,
    pause_ratio: 1.0,
    speech_rate: 1.0,
    voice_breaks: 1.0,
    whisper: 1.0,     // Full weight for Whisper transcription
  },
  good: {
    jitter: 1.0,      // Clean, full weight
    shimmer: 1.0,
    hnr: 1.0,
    pause_ratio: 1.0,
    speech_rate: 1.0,
    voice_breaks: 1.0,
    whisper: 1.0,     // Full weight
  },
  acceptable: {
    jitter: 0.85,     // Minor downweight (backend already corrected)
    shimmer: 0.85,
    hnr: 1.0,         // HNR robust
    pause_ratio: 0.95, // Minimal (VAD mostly stable)
    speech_rate: 1.0, // Noise-independent
    voice_breaks: 1.0, // Binary, stable
    whisper: 1.0,     // Whisper robust to minor noise
  },
  poor: {
    jitter: 0.70,     // Moderate downweight
    shimmer: 0.70,
    hnr: 1.0,         // Still reliable (measures noise itself)
    pause_ratio: 0.85, // Slight reduction
    speech_rate: 1.0,
    voice_breaks: 1.0,
    whisper: 0.9,     // Slight downweight (ASR may struggle)
  },
  critical: {
    jitter: 0.50,     // Heavy downweight (quality-limited mode)
    shimmer: 0.50,
    hnr: 1.0,
    pause_ratio: 0.70,
    speech_rate: 1.0,
    voice_breaks: 1.0,
    whisper: 0.8,     // Moderate downweight (ASR quality-limited)
  },
};

/**
 * Get adaptive thresholds based on SNR (OPTION A: MINIMAL ADJUSTMENT)
 *
 * CRITICAL CHANGE: We NO LONGER relax thresholds aggressively.
 * Backend already corrected features, so thresholds stay mostly stable.
 *
 * Only exception: Very small "uncertainty band" in critical SNR (<10 dB)
 * to acknowledge measurement error, not to forgive pathology.
 */
export function getAdaptiveThresholds(
  snr_db: number,
  baseThresholds: ThresholdSet
): ThresholdSet {
  const bin = getSNRBin(snr_db);

  // Excellent/good/acceptable/poor: NO threshold changes
  // Backend correction handles bias, thresholds stay meaningful
  if (bin !== 'critical') {
    return baseThresholds;
  }

  // Critical SNR (<10 dB): Add small "uncertainty band" only
  // This is NOT "forgiving noise" - it's acknowledging measurement limits
  return {
    jitter_high: baseThresholds.jitter_high * 1.05,      // +5% (was +20%)
    shimmer_high: baseThresholds.shimmer_high * 1.05,    // +5% (was +20%)
    hnr_low_red: baseThresholds.hnr_low_red * 0.95,      // -5% (was -20%)
    hnr_low_yellow: baseThresholds.hnr_low_yellow * 0.95,
    pause_high: baseThresholds.pause_high * 1.05,        // +5% (was +20%)
    speech_rate_low_red: baseThresholds.speech_rate_low_red,
    speech_rate_low_yellow: baseThresholds.speech_rate_low_yellow,
    voice_breaks_threshold: baseThresholds.voice_breaks_threshold,
  };
}

/**
 * Get feature reliability weight for a specific feature at given SNR
 */
export function getFeatureWeight(snr_db: number, featureName: keyof FeatureWeights): number {
  const bin = getSNRBin(snr_db);
  return FEATURE_WEIGHTS[bin][featureName];
}

/**
 * Calculate weighted points for a triggered feature flag
 *
 * Applies SNR-based weight to reduce false positives
 * (But only as a secondary measure - primary correction happens in backend)
 */
export function calculateWeightedPoints(
  basePoints: number,
  snr_db: number,
  featureName: keyof FeatureWeights
): number {
  const weight = getFeatureWeight(snr_db, featureName);
  const weightedPoints = basePoints * weight;

  // Round to nearest integer
  return Math.round(weightedPoints);
}

/**
 * SNR-based confidence modifier
 *
 * CONSERVATIVE PENALTIES:
 * - Excellent: +5% (clean recording boost)
 * - Good: 0% (standard)
 * - Acceptable: -10% (noticeable penalty)
 * - Poor: -20% (significant penalty)
 * - Critical: -35% (quality-limited, recommend re-record)
 */
export function getSNRConfidenceModifier(snr_db: number): number {
  const bin = getSNRBin(snr_db);

  switch (bin) {
    case 'excellent':
      return +5;   // Pristine, boost confidence
    case 'good':
      return 0;    // Standard
    case 'acceptable':
      return -10;  // Noticeable penalty
    case 'poor':
      return -20;  // Significant penalty
    case 'critical':
      return -35;  // Heavy penalty (quality-limited mode)
    default:
      return 0;
  }
}

/**
 * Quality gating: Should analysis be blocked?
 *
 * CRITICAL SAFETY GATE:
 * - SNR < 8 dB: Too noisy, force re-record
 * - VAD < 15%: Insufficient speech, force re-record
 *
 * Note: We allow SNR 8-10 dB with heavy warnings (emergency situations)
 */
export function shouldBlockAnalysis(snr_db: number, vad_pct: number): boolean {
  return snr_db < 8 || vad_pct < 15;
}

/**
 * Quality-limited mode: Is this a low-confidence result?
 *
 * Used to enforce stricter rules in poor audio:
 * - No confident GREEN unless multiple robust features agree
 * - Show prominent "Low quality audio" warning
 * - Cap confidence at 60% max
 */
export function isQualityLimited(snr_db: number, vad_pct: number): boolean {
  return snr_db < 10 || vad_pct < 25;
}

/**
 * Get user-facing explanation for SNR adjustments
 */
export function getThresholdAdjustmentExplanation(snr_db: number): string {
  const bin = getSNRBin(snr_db);

  switch (bin) {
    case 'excellent':
      return `Excellent audio quality (SNR: ${Math.round(snr_db)} dB). Features corrected for optimal accuracy.`;

    case 'good':
      return `Good audio quality (SNR: ${Math.round(snr_db)} dB). Standard analysis applied.`;

    case 'acceptable':
      return `Moderate background noise detected (SNR: ${Math.round(snr_db)} dB). ` +
             'Features corrected for noise bias. Jitter/shimmer weighted at 85% reliability. ' +
             'Confidence reduced by 10%.';

    case 'poor':
      return `Significant background noise detected (SNR: ${Math.round(snr_db)} dB). ` +
             'Features corrected for noise bias. Jitter/shimmer weighted at 70% reliability. ' +
             'Confidence reduced by 20%. Consider re-recording in quieter environment.';

    case 'critical':
      return `⚠️ QUALITY-LIMITED RESULT (SNR: ${Math.round(snr_db)} dB). ` +
             'Audio quality is poor - results may be unreliable. ' +
             'Jitter/shimmer heavily downweighted (50% reliability). ' +
             'Confidence capped at 60%. STRONGLY recommend re-recording in quieter environment.';

    default:
      return 'Analysis adjusted for recording quality.';
  }
}

/**
 * Get detailed feature reliability report
 */
export interface FeatureReliabilityReport {
  feature: string;
  weight: number;
  reliability: 'high' | 'moderate' | 'low';
  explanation: string;
}

export function getFeatureReliabilityReport(snr_db: number): FeatureReliabilityReport[] {
  const bin = getSNRBin(snr_db);
  const weights = FEATURE_WEIGHTS[bin];

  const report: FeatureReliabilityReport[] = [
    {
      feature: 'Jitter (voice stability)',
      weight: weights.jitter,
      reliability: weights.jitter >= 0.9 ? 'high' : weights.jitter >= 0.6 ? 'moderate' : 'low',
      explanation: weights.jitter < 1.0
        ? `Noise can inflate jitter. Backend applied bias correction; frontend weight: ${Math.round(weights.jitter * 100)}%.`
        : 'Fully reliable in clean recording conditions.',
    },
    {
      feature: 'Shimmer (amplitude stability)',
      weight: weights.shimmer,
      reliability: weights.shimmer >= 0.9 ? 'high' : weights.shimmer >= 0.6 ? 'moderate' : 'low',
      explanation: weights.shimmer < 1.0
        ? `Highly sensitive to noise. Backend applied bias correction; frontend weight: ${Math.round(weights.shimmer * 100)}%.`
        : 'Fully reliable in clean recording conditions.',
    },
    {
      feature: 'HNR (voice clarity)',
      weight: weights.hnr,
      reliability: 'high',
      explanation: 'Robust metric that measures signal-to-noise. Backend corrected; always reliable.',
    },
    {
      feature: 'Speech Rate',
      weight: weights.speech_rate,
      reliability: 'high',
      explanation: 'Syllable counting is noise-independent. No correction needed.',
    },
    {
      feature: 'Pause Ratio',
      weight: weights.pause_ratio,
      reliability: weights.pause_ratio >= 0.9 ? 'high' : 'moderate',
      explanation: weights.pause_ratio < 1.0
        ? `Silence detection slightly affected by noise. Minimal correction applied; weight: ${Math.round(weights.pause_ratio * 100)}%.`
        : 'Reliable respiratory/breathing pattern indicator.',
    },
    {
      feature: 'Voice Breaks',
      weight: weights.voice_breaks,
      reliability: 'high',
      explanation: 'Binary pitch tracking is stable. No correction needed.',
    },
  ];

  return report;
}

/**
 * Format SNR for display
 */
export function formatSNR(snr_db: number): {
  value: string;
  bin: SNRBin;
  color: string;
  label: string;
} {
  const bin = getSNRBin(snr_db);

  const colorMap: Record<SNRBin, string> = {
    excellent: 'text-green-600',
    good: 'text-green-600',
    acceptable: 'text-yellow-600',
    poor: 'text-orange-600',
    critical: 'text-red-600',
  };

  const labelMap: Record<SNRBin, string> = {
    excellent: 'Excellent',
    good: 'Good',
    acceptable: 'Acceptable',
    poor: 'Poor',
    critical: 'Critical',
  };

  return {
    value: `${Math.round(snr_db)} dB`,
    bin,
    color: colorMap[bin],
    label: labelMap[bin],
  };
}

/**
 * Validate SNR value (ensure within expected range)
 */
export function validateSNR(snr_db: number): number {
  // Clamp to 0-50 dB (typical range for speech recordings)
  return Math.max(0, Math.min(50, snr_db));
}

/**
 * Get adaptive noise attenuation based on SNR
 *
 * Returns the amount of noise reduction to apply (in dB) based on the
 * estimated signal-to-noise ratio.
 *
 * @param snr_db - Signal-to-noise ratio in decibels
 * @returns Noise attenuation in dB (6-12 dB range)
 */
export function getAdaptiveNoiseAttenuation(snr_db: number): number {
  const bin = getSNRBin(snr_db);

  switch (bin) {
    case 'excellent':
      return 6;  // Minimal noise reduction for clean audio
    case 'good':
      return 7;  // Light noise reduction
    case 'acceptable':
      return 9;  // Moderate noise reduction
    case 'poor':
      return 11; // Heavy noise reduction
    case 'critical':
      return 12; // Maximum noise reduction
    default:
      return 9;  // Default to moderate
  }
}

/**
 * Get quality-limited mode constraints
 *
 * When SNR < 10 dB, enforce stricter rules:
 * - Max confidence: 60%
 * - Require multiple robust features for GREEN
 * - Show prominent warning
 */
export function getQualityLimitedConstraints(snr_db: number): {
  maxConfidence: number;
  requireMultipleFlags: boolean;
  showProminentWarning: boolean;
} {
  if (snr_db < 10) {
    return {
      maxConfidence: 60,
      requireMultipleFlags: true,
      showProminentWarning: true,
    };
  }

  if (snr_db < 12) {
    return {
      maxConfidence: 75,
      requireMultipleFlags: false,
      showProminentWarning: true,
    };
  }

  return {
    maxConfidence: 95,
    requireMultipleFlags: false,
    showProminentWarning: false,
  };
}
