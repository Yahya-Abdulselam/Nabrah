/**
 * Language-Specific Acoustic Thresholds for Nabrah
 *
 * Thresholds are adjusted based on research for different languages
 * Arabic speech has different characteristics than English:
 * - Slower speech rate (2-2.5 syl/s vs 3-4 syl/s)
 * - Different phonetic systems (emphatic consonants, pharyngeal sounds)
 * - Potentially different jitter/shimmer baselines
 */

import { Language } from './i18n/types';

export interface ThresholdSet {
  jitter_high: number;              // Frequency instability threshold (%)
  shimmer_high: number;             // YELLOW: Amplitude instability threshold (%)
                                    // Note: RED threshold (>10%) is hardcoded in triageLogic.ts
  hnr_low_red: number;              // RED: HNR below this (dB)
  hnr_low_yellow: number;           // YELLOW: HNR below this (dB)
  pause_high: number;               // RED: Pause ratio above this (%)
  pause_yellow: number;             // YELLOW: Pause ratio above this (%)
  speech_rate_low_red: number;      // RED: Speech rate below this (syl/s)
  speech_rate_low_yellow: number;   // YELLOW: Speech rate below this (syl/s)
  voice_breaks_threshold: number;   // Threshold for voice breaks (count)
}

// Legacy type alias for backward compatibility
export type AcousticThresholds = ThresholdSet;

/**
 * RECALIBRATED thresholds for dysarthria detection (2026-01-30 - HIGH SENSITIVITY)
 *
 * Major recalibration to prioritize sensitivity (catching pathology) over specificity.
 * Previous thresholds were over-calibrated to avoid false positives, resulting in
 * false negatives for severe pathological cases (e.g., spastic dysarthria scoring YELLOW).
 *
 * Key Changes from Previous Version:
 * - Shimmer: Tiered thresholds (YELLOW: 6-10%, RED: >10%)
 *   Previous: Single RED threshold at 15%
 *   Rationale: Gradual severity spectrum, distinguishes prosody from pathology
 * - HNR RED: 3.0 dB → 5.0 dB (severe dysphonia threshold)
 * - HNR YELLOW: 6.0 dB → 8.0 dB (clinical: <7 dB pathological)
 * - Pause Ratio RED: 50% → 40% (respiratory distress indicator)
 * - Pause Ratio YELLOW: 45% → 30% (increased pauses)
 * - Speech Rate RED: 0.8 sps → 2.0 sps (dysarthria-sensitive threshold)
 * - Speech Rate YELLOW: 1.3 sps → 2.8 sps (slower than typical)
 * - Jitter YELLOW: 3.5% → 2.0% (dysarthria detection)
 * - Voice Breaks: 5 → 2 (pathological if present)
 *
 * Philosophy: HIGH SENSITIVITY
 * In emergency triage, false negatives (missing strokes/dysarthria) are more dangerous
 * than false positives (unnecessary doctor visits). These thresholds err on the side of
 * caution, accepting some false YELLOW flags to ensure severe pathology is detected.
 *
 * Rationale:
 * - Emergency triage should prioritize sensitivity over specificity
 * - SNR weighting reduces flag severity in poor audio (mitigates false positives)
 * - Multi-flag requirement prevents single noisy measurement → RED
 * - Whisper confidence provides independent validation of speech quality
 * - Users can re-record if they get unexpected results
 *
 * Research References:
 * - Jitter: https://www.fon.hum.uva.nl/praat/manual/Voice_2__Jitter.html
 * - Shimmer: https://www.fon.hum.uva.nl/praat/manual/Voice_3__Shimmer.html
 * - HNR: https://fonetika.ff.cuni.cz/wp-content/uploads/sites/104/2019/07/TylSka19-voice.pdf
 * - Pause Ratio: https://pmc.ncbi.nlm.nih.gov/articles/PMC5530595/
 * - Speech Rate: https://www.sciencedirect.com/science/article/abs/pii/S0094730X99000108
 * - Voice Breaks: https://www.fon.hum.uva.nl/praat/manual/Voice_1__Voice_breaks.html
 */
export const THRESHOLDS: Record<Language, ThresholdSet> = {
  en: {
    jitter_high: 2.0,                 // YELLOW: > 2.0% (dysarthria-sensitive threshold)
    shimmer_high: 6.0,                // YELLOW: > 6.0% (moderate instability, RED at >10% in triageLogic.ts)
    hnr_low_red: 5.0,                 // RED: < 5.0 dB (severe dysphonia)
    hnr_low_yellow: 8.0,              // YELLOW: < 8.0 dB (clinical: <7 dB pathological)
    pause_high: 40.0,                 // RED: > 40% (respiratory distress indicator)
    pause_yellow: 30.0,               // YELLOW: > 30% (increased pauses)
    speech_rate_low_red: 2.0,         // RED: < 2.0 sps (severely slow for dysarthria)
    speech_rate_low_yellow: 2.8,      // YELLOW: < 2.8 sps (slower than typical)
    voice_breaks_threshold: 2,        // Threshold: > 2 breaks (pathological if present)
  },
  ar: {
    jitter_high: 2.0,                 // Same as English (acoustic measure)
    shimmer_high: 6.0,                // Same as English (Praat pathology threshold)
    hnr_low_red: 5.0,                 // Same as English (severe dysphonia)
    hnr_low_yellow: 8.0,              // Same as English (clinical threshold)
    pause_high: 40.0,                 // Same as English (respiratory indicator)
    pause_yellow: 30.0,               // YELLOW: > 30% (increased pauses)
    speech_rate_low_red: 1.5,         // RED: < 1.5 sps (Arabic slower baseline, severe)
    speech_rate_low_yellow: 2.0,      // YELLOW: < 2.0 sps (Arabic slower baseline)
    voice_breaks_threshold: 2,        // Same as English
  },
};

/**
 * Get thresholds for a specific language
 * Falls back to English if language not found
 */
export function getThresholds(language: Language): ThresholdSet {
  return THRESHOLDS[language] || THRESHOLDS.en;
}

/**
 * Get threshold value for a specific feature and language
 */
export function getThreshold(
  language: Language,
  feature: keyof ThresholdSet
): number {
  const thresholds = getThresholds(language);
  return thresholds[feature];
}

/**
 * Check if a feature value exceeds threshold
 * For inverse features (HNR, speech_rate), returns true if value is BELOW threshold
 */
export function exceedsThreshold(
  language: Language,
  feature: keyof ThresholdSet,
  value: number
): boolean {
  const threshold = getThreshold(language, feature);

  // Inverse features (lower is worse)
  const inverseFeatures: (keyof ThresholdSet)[] = [
    'hnr_low_red',
    'hnr_low_yellow',
    'speech_rate_low_red',
    'speech_rate_low_yellow'
  ];

  if (inverseFeatures.includes(feature)) {
    return value < threshold;
  }

  // Normal features (higher is worse)
  return value > threshold;
}
