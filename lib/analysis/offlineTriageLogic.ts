// Offline Triage Logic
// Conservative rule-based scoring for client-side features
// Uses relaxed thresholds due to less precise measurements

import type { ClientAudioFeatures } from '../audioFeatures/clientExtractor';
import type { Language } from '../db/schema';
import type { TriageLevel } from '../triageLogic';

export interface OfflineTriageFlag {
  feature: string;
  message: string;
  severity: 'RED' | 'YELLOW';
  value?: number;
  threshold?: number;
}

export interface OfflineTriageResult {
  level: TriageLevel;
  score: number;
  confidence: number;
  message: string;
  action: string;
  flags: OfflineTriageFlag[];
}

/**
 * Offline Thresholds (More Conservative than Online)
 *
 * These are intentionally less sensitive to avoid false positives
 * Client-side DSP is less precise than Praat/Whisper analysis
 */
const OFFLINE_THRESHOLDS = {
  en: {
    // Zero Crossing Rate (proxy for hoarseness)
    // Higher ZCR = more unvoiced/noisy speech
    zcr_high_red: 0.20,    // RED: Very noisy/hoarse voice
    zcr_high_yellow: 0.15,  // YELLOW: Moderately noisy

    // Spectral Centroid (voice quality)
    // Lower centroid = duller voice quality
    centroid_low_red: 800,     // RED: Very low centroid
    centroid_low_yellow: 1000, // YELLOW: Low centroid

    // Pause Count (speech fragmentation)
    // More pauses = more fragmented speech
    pause_count_red: 8,    // RED: Very fragmented (8+ pauses in 5-10 sec)
    pause_count_yellow: 5, // YELLOW: Fragmented

    // Estimated Speech Rate (syllables per second)
    // Slower speech may indicate difficulty
    speech_rate_low_red: 2.0,    // RED: Very slow
    speech_rate_low_yellow: 2.5, // YELLOW: Slow

    // SNR thresholds
    snr_poor: 10,       // Below 10 dB is poor quality
    snr_acceptable: 15, // 15+ dB is acceptable

    // Speech percentage thresholds
    speech_pct_insufficient: 40, // Need at least 40% speech
  },
  ar: {
    // Arabic-specific adjustments
    // (Arabic may have different natural speech patterns)
    zcr_high_red: 0.22,
    zcr_high_yellow: 0.17,
    centroid_low_red: 750,
    centroid_low_yellow: 950,
    pause_count_red: 9,
    pause_count_yellow: 6,
    speech_rate_low_red: 1.8,
    speech_rate_low_yellow: 2.3,
    snr_poor: 10,
    snr_acceptable: 15,
    speech_pct_insufficient: 40,
  },
};

/**
 * Calculate triage level using client-side features
 *
 * Scoring system (same as online):
 * - RED (Emergency): Score >= 10 points
 * - YELLOW (Urgent): Score >= 5 points
 * - GREEN (Normal): Score < 5 points
 *
 * But with more conservative thresholds
 */
export function calculateOfflineTriage(
  features: ClientAudioFeatures,
  language: Language = 'en'
): OfflineTriageResult {
  const thresholds = OFFLINE_THRESHOLDS[language];
  let score = 0;
  const flags: OfflineTriageFlag[] = [];

  console.log('[OfflineTriage] Analyzing features:', features);

  // RED FLAGS (+5 points each)

  // 1. Very high Zero Crossing Rate (hoarseness indicator)
  if (features.zero_crossing_rate > thresholds.zcr_high_red) {
    score += 5;
    flags.push({
      feature: 'zero_crossing_rate',
      message: `Very high voice noise/hoarseness detected (ZCR > ${thresholds.zcr_high_red})`,
      severity: 'RED',
      value: features.zero_crossing_rate,
      threshold: thresholds.zcr_high_red,
    });
  }

  // 2. Very low Spectral Centroid (poor voice quality)
  if (features.spectral_centroid < thresholds.centroid_low_red) {
    score += 5;
    flags.push({
      feature: 'spectral_centroid',
      message: `Severely degraded voice quality detected (centroid < ${thresholds.centroid_low_red} Hz)`,
      severity: 'RED',
      value: features.spectral_centroid,
      threshold: thresholds.centroid_low_red,
    });
  }

  // 3. Very high Pause Count (severe fragmentation)
  if (features.pause_count > thresholds.pause_count_red) {
    score += 5;
    flags.push({
      feature: 'pause_count',
      message: `Severely fragmented speech detected (${features.pause_count} pauses)`,
      severity: 'RED',
      value: features.pause_count,
      threshold: thresholds.pause_count_red,
    });
  }

  // 4. Very slow Speech Rate
  if (features.estimated_speech_rate < thresholds.speech_rate_low_red) {
    score += 5;
    flags.push({
      feature: 'estimated_speech_rate',
      message: `Very slow speech detected (${features.estimated_speech_rate.toFixed(1)} syl/sec)`,
      severity: 'RED',
      value: features.estimated_speech_rate,
      threshold: thresholds.speech_rate_low_red,
    });
  }

  // YELLOW FLAGS (+2 points each)

  // 1. Moderately high Zero Crossing Rate
  if (
    features.zero_crossing_rate > thresholds.zcr_high_yellow &&
    features.zero_crossing_rate <= thresholds.zcr_high_red
  ) {
    score += 2;
    flags.push({
      feature: 'zero_crossing_rate',
      message: `Moderate voice noise detected (ZCR ${thresholds.zcr_high_yellow}-${thresholds.zcr_high_red})`,
      severity: 'YELLOW',
      value: features.zero_crossing_rate,
      threshold: thresholds.zcr_high_yellow,
    });
  }

  // 2. Moderately low Spectral Centroid
  if (
    features.spectral_centroid < thresholds.centroid_low_yellow &&
    features.spectral_centroid >= thresholds.centroid_low_red
  ) {
    score += 2;
    flags.push({
      feature: 'spectral_centroid',
      message: `Moderate voice quality concern (centroid ${thresholds.centroid_low_red}-${thresholds.centroid_low_yellow} Hz)`,
      severity: 'YELLOW',
      value: features.spectral_centroid,
      threshold: thresholds.centroid_low_yellow,
    });
  }

  // 3. Moderate Pause Count
  if (
    features.pause_count > thresholds.pause_count_yellow &&
    features.pause_count <= thresholds.pause_count_red
  ) {
    score += 2;
    flags.push({
      feature: 'pause_count',
      message: `Fragmented speech detected (${features.pause_count} pauses)`,
      severity: 'YELLOW',
      value: features.pause_count,
      threshold: thresholds.pause_count_yellow,
    });
  }

  // 4. Moderately slow Speech Rate
  if (
    features.estimated_speech_rate < thresholds.speech_rate_low_yellow &&
    features.estimated_speech_rate >= thresholds.speech_rate_low_red
  ) {
    score += 2;
    flags.push({
      feature: 'estimated_speech_rate',
      message: `Slow speech detected (${features.estimated_speech_rate.toFixed(1)} syl/sec)`,
      severity: 'YELLOW',
      value: features.estimated_speech_rate,
      threshold: thresholds.speech_rate_low_yellow,
    });
  }

  // QUALITY FLAGS (informational, don't affect score in offline mode)
  // But we'll add them to flags for user awareness

  if (features.low_snr) {
    flags.push({
      feature: 'snr_db',
      message: `Low audio quality (SNR ${features.snr_db.toFixed(1)} dB). Results may be unreliable.`,
      severity: 'YELLOW',
      value: features.snr_db,
      threshold: thresholds.snr_poor,
    });
  }

  if (features.insufficient_speech) {
    flags.push({
      feature: 'speech_percentage',
      message: `Insufficient speech detected (${features.speech_percentage.toFixed(1)}%). Please speak continuously.`,
      severity: 'YELLOW',
      value: features.speech_percentage,
      threshold: thresholds.speech_pct_insufficient,
    });
  }

  if (features.clipping_detected) {
    flags.push({
      feature: 'clipping',
      message: 'Audio clipping detected. Microphone may be too close or volume too high.',
      severity: 'YELLOW',
    });
  }

  // Determine triage level
  let level: TriageLevel;
  let message: string;
  let action: string;
  let confidence: number;

  if (score >= 10) {
    level = 'RED';
    message = 'POTENTIAL EMERGENCY (Offline Analysis)';
    action =
      'This offline analysis suggests possible concerns. ' +
      'STRONGLY RECOMMEND: Connect to internet for full analysis, or seek medical attention if symptoms are severe.';
    // Lower confidence for offline RED (50-70%)
    confidence = Math.min(70, 50 + (score - 10) * 2);
  } else if (score >= 5) {
    level = 'YELLOW';
    message = 'POSSIBLE CONCERNS (Offline Analysis)';
    action =
      'Some potential issues detected. ' +
      'Recommend: Connect to internet for full analysis, or monitor symptoms and consult doctor if concerned.';
    // Lower confidence for offline YELLOW (40-60%)
    confidence = Math.min(60, 40 + (score - 5) * 2);
  } else {
    level = 'GREEN';
    message = 'NO MAJOR CONCERNS (Offline Analysis)';
    action =
      'No significant issues detected in offline analysis. ' +
      'For comprehensive evaluation, connect to internet for full Praat + Whisper analysis.';
    // Moderate confidence for offline GREEN (30-50%)
    confidence = Math.min(50, 30 + (5 - score) * 4);
  }

  // Apply quality-based confidence reduction
  if (features.low_snr || features.insufficient_speech) {
    confidence = Math.max(20, confidence - 10);
  }

  console.log('[OfflineTriage] Result:', { level, score, confidence });

  return {
    level,
    score,
    confidence,
    message,
    action,
    flags,
  };
}

/**
 * Get explanation of offline analysis limitations
 */
export function getOfflineAnalysisDisclaimer(): string {
  return (
    '⚠️ OFFLINE ANALYSIS LIMITATIONS:\n\n' +
    '• Uses simplified algorithms (no Praat or Whisper)\n' +
    '• Less accurate than online analysis\n' +
    '• Cannot detect all speech abnormalities\n' +
    '• No voice transcription available\n' +
    '• Conservative thresholds (may miss subtle issues)\n\n' +
    'For best results, connect to the internet and reanalyze with full backend processing.'
  );
}
