/**
 * Nabrah Triage Logic System
 *
 * Rule-based scoring system for emergency voice triage
 * Based on research-backed acoustic feature thresholds
 * Supports language-specific thresholds for English and Arabic
 */

/**
 * ⚠️ KNOWN ISSUE: False RED Triage Flags
 *
 * The current scoring system is overly sensitive and frequently triggers
 * RED flags for healthy individuals. This is NOT a bug in the code logic,
 * but a calibration issue with the thresholds.
 *
 * Common False Positive Scenarios:
 *
 * 1. HNR < 7 dB (+5 points RED flag)
 *    - Home recording environments have background noise
 *    - Even "good" audio (SNR 15+ dB) can have HNR below 7
 *    - Clinical studies use professional microphones in soundproof rooms
 *    - Recommendation: Increase threshold to HNR < 5 dB for RED
 *
 * 2. Pause Ratio > 17% (+5 points RED flag)
 *    - Prompt: "Today is Monday. I need medical help."
 *    - Natural pause between sentences easily exceeds 17%
 *    - People pause for emphasis when saying "I need medical help"
 *    - Recommendation: Increase threshold to > 25% for RED
 *
 * 3. Shimmer DDA > 3.810% (+5 points RED flag)
 *    - Praat's DDA method reports higher values than other shimmer measures
 *    - Healthy voices can have 3-5% DDA shimmer in short recordings
 *    - 5-second recordings amplify natural micro-variations
 *    - Recommendation: Increase threshold to > 5.5% for RED
 *
 * 4. Speech Rate < 2.5 syl/sec (+5 points RED flag)
 *    - Backend estimates syllables by vowel counting (approximation)
 *    - Speaking clearly and carefully naturally slows rate
 *    - English/Arabic syllable detection is imprecise
 *    - Recommendation: Decrease threshold to < 2.0 syl/sec for RED
 *
 * 5. Cumulative Scoring Problem:
 *    - Only need 10 points for RED (2 RED flags OR 5 YELLOW flags)
 *    - Common scenario: Background noise (HNR) + Natural pauses = 10 points = RED
 *    - No weighting for audio quality warnings
 *    - No consideration for conflicting indicators
 *
 * Why This Happens More in Good Recordings:
 * - Users speaking clearly and carefully trigger slower speech rate flags
 * - Recording in quiet home environments still has noise that affects HNR
 * - The 5-second duration amplifies any small variations
 * - Natural, emphatic speech patterns trigger pause ratio flags
 *
 * SOLUTION APPROACHES (Future Work):
 *
 * A. Threshold Adjustment (Recommended First Step):
 *    - Collect real-world data from 100+ healthy and 100+ unhealthy speakers
 *    - Use statistical analysis to find optimal discrimination thresholds
 *    - Set thresholds at 90th percentile of healthy population for RED
 *    - Set thresholds at 70th percentile of healthy population for YELLOW
 *
 * B. Audio Quality Weighting:
 *    - Reduce RED flag points by 2 if SNR < 15 dB (noisy environment)
 *    - Add uncertainty indicator if VAD < 40% (insufficient speech)
 *    - Require higher scores (15+ instead of 10+) for RED in poor audio
 *
 * C. Percentile-Based Scoring:
 *    - Instead of fixed thresholds, use percentile ranking
 *    - Score = (user_value - healthy_mean) / healthy_std_dev
 *    - Z-score > 2.0 = RED, Z-score > 1.0 = YELLOW
 *
 * D. Multi-Flag Requirement:
 *    - Require 3+ triggered flags instead of just 10 points for RED
 *    - Prevents single noisy measurements from dominating
 *    - Ensures multiple independent indicators agree
 *
 * E. Confidence Penalty:
 *    - Lower confidence score (not triage level) for poor audio quality
 *    - Add "low confidence" warning when SNR < 10 dB or VAD < 40%
 *    - Suggest re-recording in better conditions
 *
 * IMMEDIATE ACTIONS:
 *
 * 1. Tell Users Results Are Preliminary:
 *    - Add prominent disclaimer that results require clinical validation
 *    - Emphasize this is a screening tool, not a diagnostic tool
 *    - Recommend medical consultation for any concerns
 *
 * 2. Collect Validation Data:
 *    - Record 5-second samples from healthy volunteers
 *    - Analyze distribution of features to set realistic thresholds
 *    - Test against known pathological cases
 *
 * 3. DO NOT Adjust Thresholds Without Medical Consultation:
 *    - Loosening thresholds could miss real emergencies (false negatives)
 *    - Any changes must be validated against clinical data
 *    - Current false positives are safer than false negatives
 *
 * Technical Implementation Note:
 * The scoring logic below is correct and working as designed. The issue is
 * that the threshold VALUES (in thresholds.ts) are not calibrated for
 * real-world home recording conditions. Future fixes should modify
 * thresholds.ts, not this file's logic.
 */

import { Language } from './i18n/types';
import { getThresholds } from './thresholds';
import {
  getAdaptiveThresholds,
  calculateWeightedPoints,
  getSNRConfidenceModifier,
  getThresholdAdjustmentExplanation,
  isQualityLimited,
  getQualityLimitedConstraints,
} from './snrAdaptation';

export interface AudioFeatures {
  jitter_local: number;        // Percentage (%)
  shimmer_dda: number;         // Percentage (%) - Praat's DDA
                               // (Difference of Differences) method
                               // NOTE: This is the standard Praat shimmer
                               // measurement
                               // Threshold: >3.810% pathological
                               // (see thresholds.ts)
                               // Backend (server.py) extracts this via Praat DDA
  hnr: number;                 // Harmonics-to-noise ratio (dB)
  speech_rate: number;         // Syllables per second (estimated,
                               // see server.py for limitations)
  pause_ratio: number;         // Total pause percentage (≥300ms pauses)
  brief_pause_ratio?: number;  // Brief pauses (300-800ms) - normal inter-sentence breaks
  respiratory_pause_ratio?: number; // Respiratory pauses (>800ms) - pathological marker
  voice_breaks: number;        // Count of discontinuities
                               // (normalized by /10, see server.py)
  mean_intensity: number;      // Average volume (dB)
}

export type QualityLevel = 'good' | 'acceptable' | 'poor' | 'unknown';

export interface AudioQuality {
  snr_db: number;                    // Signal-to-noise ratio in dB
  quality_level: QualityLevel;       // Overall quality assessment
  speech_percentage: number;         // Percentage of audio with speech
  has_sufficient_speech: boolean;    // >= 40% speech detected
  is_reliable: boolean;              // SNR >= 10 && sufficient speech
  snr_recommendation: string;        // User-facing SNR message
  vad_message: string;               // User-facing VAD message
}

export interface QualityWarning {
  type: 'snr' | 'vad' | 'combined';
  severity: 'info' | 'warning' | 'error';
  message: string;
}

/**
 * Get quality warnings based on audio quality metrics
 */
export function getQualityWarnings(quality: AudioQuality): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  // SNR warnings
  if (quality.snr_db < 10) {
    warnings.push({
      type: 'snr',
      severity: 'error',
      message: quality.snr_recommendation
    });
  } else if (quality.snr_db < 15) {
    warnings.push({
      type: 'snr',
      severity: 'warning',
      message: quality.snr_recommendation
    });
  }

  // VAD warnings
  if (!quality.has_sufficient_speech) {
    warnings.push({
      type: 'vad',
      severity: 'error',
      message: quality.vad_message
    });
  } else if (quality.speech_percentage < 40) {
    warnings.push({
      type: 'vad',
      severity: 'warning',
      message: quality.vad_message
    });
  }

  // Combined reliability warning
  if (!quality.is_reliable) {
    warnings.push({
      type: 'combined',
      severity: 'error',
      message: 'Audio quality may affect analysis accuracy. Consider re-recording in a quieter environment.'
    });
  }

  return warnings;
}

export type TriageLevel = 'RED' | 'YELLOW' | 'GREEN';

export interface TriageFlag {
  severity: 'high' | 'medium' | 'low';
  message: string;
  points: number;
}

export interface TriageResult {
  level: TriageLevel;
  score: number;
  confidence: number;
  message: string;
  action: string;
  flags: string[];
  detailedFlags: TriageFlag[];
  features: AudioFeatures;
  timestamp: string;
  // Quality-related fields (optional for backwards compatibility)
  quality?: AudioQuality;
  qualityWarnings?: QualityWarning[];
  // SNR-adaptive fields
  snrAdjustment?: string;  // Explanation of SNR-based threshold adjustments
}

/**
 * Calculate triage level based on acoustic features
 *
 * Scoring system:
 * - RED (Emergency): Score >= 10 points
 * - YELLOW (Urgent): Score >= 5 points
 * - GREEN (Normal): Score < 5 points
 *
 * Feature thresholds are language-specific:
 * - English: Standard research thresholds
 * - Arabic: Adjusted for Arabic speech characteristics
 *
 * @param features - Acoustic features extracted from voice
 * @param language - Language for threshold selection ('en' or 'ar')
 */
export function calculateTriage(
  features: AudioFeatures,
  language: Language = 'en',
  snr_db?: number,
  whisper_confidence?: number,  // Whisper transcription confidence (0-100)
  wer_accuracy?: number          // Word Error Rate accuracy (0-100)
): TriageResult {
  let score = 0;
  const flags: string[] = [];
  const detailedFlags: TriageFlag[] = [];

  // Get language-specific thresholds
  const baseThresholds = getThresholds(language);

  // Apply SNR-adaptive thresholds if SNR is provided
  const thresholds = snr_db !== undefined
    ? getAdaptiveThresholds(snr_db, baseThresholds)
    : baseThresholds;

  // Track SNR adjustment for explanation
  const snrAdjustment = snr_db !== undefined
    ? getThresholdAdjustmentExplanation(snr_db)
    : null;

  // RED FLAGS - Emergency indicators (5 points each)

  // Shimmer: Amplitude instability indicator with tiered thresholds
  // Research shows shimmer has gradual severity spectrum:
  // - Healthy: <3.81% (Praat clinical threshold)
  // - Mild: 3.81-10% (prosodic variation, home recording noise)
  // - Severe: >10% (pathological, dysarthria, vocal cord paralysis)
  const shimmer_severe_threshold = 10.0; // Severe pathology (RED)
  const shimmer_mild_threshold = thresholds.shimmer_high; // 6.0% (YELLOW)

  if (features.shimmer_dda > shimmer_severe_threshold) {
    // RED: Severe amplitude instability (>10%)
    const basePoints = 5;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'shimmer')
      : basePoints;

    score += weightedPoints;
    const flag = `Severe voice amplitude instability detected (shimmer > ${shimmer_severe_threshold.toFixed(1)}%)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'high',
      message: flag,
      points: weightedPoints
    });
  } else if (features.shimmer_dda > shimmer_mild_threshold) {
    // YELLOW: Moderate amplitude instability (6-10%)
    const basePoints = 2;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'shimmer')
      : basePoints;

    score += weightedPoints;
    const flag = `Moderate voice amplitude instability detected (shimmer ${shimmer_mild_threshold.toFixed(1)}-${shimmer_severe_threshold.toFixed(1)}%)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'medium',
      message: flag,
      points: weightedPoints
    });
  }

  // Pause ratio: Respiratory distress indicator (with tiered thresholds)
  // Use respiratory_pause_ratio (>500ms pauses) if available, otherwise fallback to pause_ratio
  const pause_metric = features.respiratory_pause_ratio !== undefined
    ? features.respiratory_pause_ratio
    : features.pause_ratio;

  // Adjusted thresholds for respiratory pauses (more specific than total pauses)
  const respiratory_red_threshold = features.respiratory_pause_ratio !== undefined
    ? 10  // >10% respiratory pauses (>800ms) = severe respiratory distress
    : thresholds.pause_high; // Fallback to original threshold for backward compatibility

  const respiratory_yellow_threshold = features.respiratory_pause_ratio !== undefined
    ? 3   // >3% respiratory pauses = concerning
    : thresholds.pause_yellow; // Fallback to original threshold

  if (pause_metric > respiratory_red_threshold) {
    // RED: Severe respiratory distress
    const basePoints = 5;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'pause_ratio')
      : basePoints;

    score += weightedPoints;
    const flag = features.respiratory_pause_ratio !== undefined
      ? `Severe respiratory pauses detected (>${respiratory_red_threshold.toFixed(1)}% long pauses >800ms)`
      : `Excessive breathing pauses detected (>${respiratory_red_threshold.toFixed(1)}% silence)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'high',
      message: flag,
      points: weightedPoints
    });
  } else if (pause_metric > respiratory_yellow_threshold) {
    // YELLOW: Increased pauses
    const basePoints = 2;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'pause_ratio')
      : basePoints;

    score += weightedPoints;
    const flag = features.respiratory_pause_ratio !== undefined
      ? `Increased respiratory pauses detected (${respiratory_yellow_threshold.toFixed(1)}-${respiratory_red_threshold.toFixed(1)}% long pauses)`
      : `Increased pauses detected (${respiratory_yellow_threshold.toFixed(1)}-${respiratory_red_threshold.toFixed(1)}% silence)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'medium',
      message: flag,
      points: weightedPoints
    });
  }

  // YELLOW FLAGS - Concerning indicators (1-2 points each)

  // Jitter: Frequency instability indicator
  if (features.jitter_local > thresholds.jitter_high) {
    const basePoints = 2;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'jitter')
      : basePoints;

    score += weightedPoints;
    const flag = `Voice frequency instability detected (jitter > ${thresholds.jitter_high.toFixed(2)}%)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'medium',
      message: flag,
      points: weightedPoints
    });
  }

  // HNR: Voice quality indicator with tiered thresholds
  // NOTE: This threshold is too strict for home recordings - see file header
  // Background noise in home environments easily reduces HNR below 7 dB
  if (features.hnr < thresholds.hnr_low_red) {
    const basePoints = 5;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'hnr')
      : basePoints;

    score += weightedPoints;
    const flag = `Severe voice quality degradation (HNR < ${thresholds.hnr_low_red.toFixed(1)} dB - pathology zone)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'high',
      message: flag,
      points: weightedPoints
    });
  } else if (features.hnr < thresholds.hnr_low_yellow) {
    const basePoints = 2;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'hnr')
      : basePoints;

    score += weightedPoints;
    const flag = `Moderate voice quality concern (HNR ${thresholds.hnr_low_red.toFixed(1)}-${thresholds.hnr_low_yellow.toFixed(1)} dB)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'medium',
      message: flag,
      points: weightedPoints
    });
  }

  // Speech rate: Articulation speed indicator with tiered thresholds
  // RED: < 2.5 sps (clearly slow)
  // YELLOW: 2.5 - 3.3 sps (slower than typical / could be hesitations)
  // GREEN: >= 3.3 sps (normal-ish)
  // NOTE: This threshold is too strict - see file header
  // Speaking clearly and carefully (as instructed) naturally slows speech rate
  // Syllable estimation by vowel counting is imprecise
  if (features.speech_rate > 0) {
    if (features.speech_rate < thresholds.speech_rate_low_red) {
      const basePoints = 5;
      const weightedPoints = snr_db !== undefined
        ? calculateWeightedPoints(basePoints, snr_db, 'speech_rate')
        : basePoints;

      score += weightedPoints;
      const flag = `Severely slow speech rate detected (< ${thresholds.speech_rate_low_red.toFixed(1)} sps - clearly slow)`;
      flags.push(flag);
      detailedFlags.push({
        severity: 'high',
        message: flag,
        points: weightedPoints
      });
    } else if (features.speech_rate < thresholds.speech_rate_low_yellow) {
      const basePoints = 2;
      const weightedPoints = snr_db !== undefined
        ? calculateWeightedPoints(basePoints, snr_db, 'speech_rate')
        : basePoints;

      score += weightedPoints;
      const flag = `Slow speech rate detected (${thresholds.speech_rate_low_red.toFixed(1)}-${thresholds.speech_rate_low_yellow.toFixed(1)} sps - slower than typical)`;
      flags.push(flag);
      detailedFlags.push({
        severity: 'medium',
        message: flag,
        points: weightedPoints
      });
    }
  }

  // Voice breaks: Continuity indicator (any breaks > 0 is pathological for sustained vowel)
  if (features.voice_breaks > thresholds.voice_breaks_threshold) {
    const basePoints = 2;
    const weightedPoints = snr_db !== undefined
      ? calculateWeightedPoints(basePoints, snr_db, 'voice_breaks')
      : basePoints;

    score += weightedPoints;
    const flag = `Voice breaks detected (${features.voice_breaks} breaks - pathological in sustained vowel)`;
    flags.push(flag);
    detailedFlags.push({
      severity: 'medium',
      message: flag,
      points: weightedPoints
    });
  }

  // Speech intelligibility: Whisper confidence indicator
  // High weight for unintelligible speech - critical neurological indicator
  if (whisper_confidence !== undefined) {
    if (whisper_confidence < 50) {
      // RED: Severely unintelligible speech (<50% confidence)
      const basePoints = 5;
      const weightedPoints = snr_db !== undefined
        ? calculateWeightedPoints(basePoints, snr_db, 'whisper')
        : basePoints;

      score += weightedPoints;
      const flag = `Severely unintelligible speech detected (Whisper confidence ${whisper_confidence.toFixed(0)}% < 50%)`;
      flags.push(flag);
      detailedFlags.push({
        severity: 'high',
        message: flag,
        points: weightedPoints
      });
    } else if (whisper_confidence < 65) {
      // YELLOW: Poor speech clarity (50-65% confidence)
      const basePoints = 2;
      const weightedPoints = snr_db !== undefined
        ? calculateWeightedPoints(basePoints, snr_db, 'whisper')
        : basePoints;

      score += weightedPoints;
      const flag = `Poor speech clarity detected (Whisper confidence ${whisper_confidence.toFixed(0)}% in 50-65% range)`;
      flags.push(flag);
      detailedFlags.push({
        severity: 'medium',
        message: flag,
        points: weightedPoints
      });
    }
  }

  // EXTREME CASE CHECK (BEFORE quality adjustments)
  // Check for obviously pathological cases that should always be RED
  //
  // UPDATED (2026-01-30): Use multi-indicator logic to catch moderate severity across domains
  // Rationale: Single extreme thresholds (pause >55%, WER <20%) miss obvious pathology
  // when multiple indicators show moderate impairment (e.g., WER 43% + Whisper 62%)
  const hasExtremeValues = (
    // Single severe indicators (keep strict to avoid false positives)
    features.pause_ratio > 55 ||  // >55% pause = severe respiratory distress
    features.hnr < 2.0 ||  // <2 dB HNR = severe dysphonia
    features.speech_rate < 0.5 ||  // <0.5 sps = almost no speech

    // Whisper confidence alone can indicate severe impairment
    (whisper_confidence !== undefined && whisper_confidence < 20) ||  // <20% = severely unintelligible (e.g., 0% dysarthria)

    // Multi-indicator combinations (catch moderate severity across multiple domains)
    // These represent realistic pathology that doesn't reach single extreme thresholds
    (wer_accuracy !== undefined && whisper_confidence !== undefined &&
     wer_accuracy < 60 && whisper_confidence < 70) ||  // Both speech indicators poor (e.g., WER 43%, Whisper 62%)

    (features.pause_ratio > 40 && whisper_confidence !== undefined &&
     whisper_confidence < 70) ||  // Respiratory issues + speech impairment (pause 40%+ and Whisper <70%)

    (features.pause_ratio > 40 && wer_accuracy !== undefined &&
     wer_accuracy < 70) ||  // Respiratory issues + speech impairment (pause 40%+ and WER <70%)

    (features.hnr < 4.0 && whisper_confidence !== undefined &&
     whisper_confidence < 70) ||  // Voice quality issues + speech impairment (HNR <4 dB and Whisper <70%)

    (features.hnr < 4.0 && wer_accuracy !== undefined &&
     wer_accuracy < 70)  // Voice quality issues + speech impairment (HNR <4 dB and WER <70%)
  );

  // TIER 2: Quality-Aware Scoring Adjustment
  // Integrate Whisper/WER/SNR quality indicators to reduce false positives
  // BUT: Skip quality bonus if extreme values detected (pathological speech should stay RED)
  let qualityBonus = 0;

  if (whisper_confidence !== undefined && wer_accuracy !== undefined && snr_db !== undefined) {
    // Check if ALL quality indicators show healthy speech
    if (whisper_confidence >= 65 && wer_accuracy >= 85 && snr_db >= 15) {
      // Excellent speech quality → reduce acoustic flag severity by 60%
      // UNLESS extreme values detected (pathological cases)
      if (!hasExtremeValues) {
        const originalScore = score;
        score = Math.round(score * 0.4);
        qualityBonus = originalScore - score;

        flags.push(`✅ High-quality speech detected: Whisper ${whisper_confidence.toFixed(0)}%, WER ${wer_accuracy.toFixed(0)}%, SNR ${snr_db.toFixed(1)} dB`);
        if (qualityBonus > 0) {
          flags.push(`Quality bonus: Reduced score by ${qualityBonus} points (acoustic flags likely prosody/measurement noise)`);
        }
      }
    } else if (snr_db < 10 || whisper_confidence < 50) {
      // Poor quality indicators → increase uncertainty penalty
      score += 2;
      flags.push('⚠️ Low audio quality detected: Results may be less reliable');
    }
  }

  // TIER 2.5: Isolated/Borderline Flag Discount
  // Few acoustic flags + excellent speech clarity = likely false positive
  // This prevents prosodic variation or measurement noise from triggering YELLOW
  const flagCount = detailedFlags.filter(f => f.points > 0).length;
  const redFlagCount = detailedFlags.filter(f => f.severity === 'high').length;
  const yellowFlagCount = detailedFlags.filter(f => f.severity === 'medium').length;

  // Case 1: Single flag with excellent speech clarity
  console.log('[TRIAGE DEBUG] Isolated flag check:', {
    flagCount,
    whisper_confidence,
    wer_accuracy,
    snr_db,
    score,
    conditions: {
      flagCountIs1: flagCount === 1,
      hasWhisper: whisper_confidence !== undefined,
      hasWER: wer_accuracy !== undefined,
      whisperOK: whisper_confidence !== undefined && whisper_confidence >= 75,
      werOK: wer_accuracy !== undefined && wer_accuracy >= 85,
      hasSNR: snr_db !== undefined,
      snrOK: snr_db !== undefined && snr_db >= 20
    }
  });

  if (flagCount === 1 &&
      whisper_confidence !== undefined && wer_accuracy !== undefined &&
      whisper_confidence >= 75 && wer_accuracy >= 85 &&
      snr_db !== undefined && snr_db >= 20) {
    // Isolated acoustic anomaly with strong contradictory evidence
    const originalScore = score;
    score = Math.max(1, Math.round(score * 0.2)); // Keep minimum 1 point as caution

    flags.push(`✅ Isolated acoustic variation with excellent speech clarity (Whisper ${whisper_confidence.toFixed(0)}%, WER ${wer_accuracy.toFixed(0)}%) - likely prosody or measurement noise`);
    flags.push(`Isolated flag discount: Reduced score from ${originalScore} to ${score} points`);
    console.log('[TRIAGE DEBUG] Isolated flag discount applied:', { originalScore, newScore: score });
  }
  // Case 2: Two borderline flags (1 RED + 1 YELLOW OR 2 YELLOW) with good speech clarity
  // Example: Shimmer 10.28% (barely RED) + HNR 7.5 dB (borderline YELLOW) but Whisper 73%, WER 100%
  else if (flagCount === 2 &&
           whisper_confidence !== undefined && wer_accuracy !== undefined &&
           whisper_confidence >= 70 && wer_accuracy >= 95 &&
           snr_db !== undefined && snr_db >= 20 &&
           redFlagCount <= 1) {  // At most 1 RED flag (if 2 RED flags, likely real pathology)
    // Two borderline acoustic flags contradicted by excellent speech intelligibility
    const originalScore = score;
    score = Math.max(2, Math.round(score * 0.3)); // Keep minimum 2 points (more cautious than single flag)

    flags.push(`✅ Borderline acoustic variations with excellent speech clarity (Whisper ${whisper_confidence.toFixed(0)}%, WER ${wer_accuracy.toFixed(0)}%) - likely prosodic emphasis or measurement noise`);
    flags.push(`Borderline flag discount: Reduced score from ${originalScore} to ${score} points`);
  }

  // TIER 3: Multi-Flag Requirement for RED
  // Prevent single noisy measurement from causing RED triage
  // Note: redFlagCount and yellowFlagCount already defined in TIER 2.5

  // Determine triage level based on score AND flag count
  // ✅ FIXED: Now requires multiple independent indicators for RED
  let level: TriageLevel;
  let message: string;
  let action: string;
  let confidence: number;

  // Multi-flag logic: Require at least 2 RED flags OR high score with multiple flags
  // OR extreme pathological values
  if (hasExtremeValues && score >= 5) {
    // RED: Extreme pathological case detected (lowered threshold to 5 points)
    level = 'RED';
    message = 'SEEK IMMEDIATE EMERGENCY CARE';
    action = 'Call emergency services (911/999) or go to the nearest Emergency Room immediately';
    confidence = Math.min(95, 80 + (score - 5) * 2);

    // Generate appropriate message based on which extreme condition triggered
    if (features.pause_ratio > 55) {
      flags.push('🚨 Extreme respiratory distress detected (pause >55%)');
    } else if (features.hnr < 2.0) {
      flags.push('🚨 Severe voice quality impairment detected (HNR <2 dB)');
    } else if (features.speech_rate < 0.5) {
      flags.push('🚨 Severe speech rate impairment detected (almost no speech)');
    } else if (whisper_confidence !== undefined && whisper_confidence < 20) {
      flags.push(`🚨 Severely unintelligible speech detected (Whisper ${whisper_confidence.toFixed(0)}%)`);
    } else if (wer_accuracy !== undefined && whisper_confidence !== undefined &&
               wer_accuracy < 60 && whisper_confidence < 70) {
      flags.push(`🚨 Severe speech impairment detected across multiple indicators (WER ${wer_accuracy.toFixed(0)}%, Whisper ${whisper_confidence.toFixed(0)}%)`);
    } else if (features.pause_ratio > 40 && whisper_confidence !== undefined && whisper_confidence < 70) {
      flags.push(`🚨 Combined respiratory and speech impairment detected (Pause ${features.pause_ratio.toFixed(1)}%, Whisper ${whisper_confidence.toFixed(0)}%)`);
    } else if (features.pause_ratio > 40 && wer_accuracy !== undefined && wer_accuracy < 70) {
      flags.push(`🚨 Combined respiratory and speech impairment detected (Pause ${features.pause_ratio.toFixed(1)}%, WER ${wer_accuracy.toFixed(0)}%)`);
    } else if (features.hnr < 4.0 && whisper_confidence !== undefined && whisper_confidence < 70) {
      flags.push(`🚨 Combined voice quality and speech impairment detected (HNR ${features.hnr.toFixed(1)} dB, Whisper ${whisper_confidence.toFixed(0)}%)`);
    } else if (features.hnr < 4.0 && wer_accuracy !== undefined && wer_accuracy < 70) {
      flags.push(`🚨 Combined voice quality and speech impairment detected (HNR ${features.hnr.toFixed(1)} dB, WER ${wer_accuracy.toFixed(0)}%)`);
    } else {
      flags.push('🚨 Extreme pathological values detected');
    }
  } else if (score >= 10 && redFlagCount >= 2) {
    // RED: Multiple severe indicators (2+ RED flags)
    level = 'RED';
    message = 'SEEK IMMEDIATE EMERGENCY CARE';
    action = 'Call emergency services (911/999) or go to the nearest Emergency Room immediately';
    // Confidence increases with score, capped at 95%
    confidence = Math.min(95, 70 + (score - 10) * 3);
  } else if (score >= 12 && redFlagCount >= 1 && yellowFlagCount >= 2) {
    // RED: 1 severe + multiple moderate indicators
    level = 'RED';
    message = 'SEEK IMMEDIATE EMERGENCY CARE';
    action = 'Call emergency services (911/999) or go to the nearest Emergency Room immediately';
    confidence = Math.min(95, 70 + (score - 10) * 3);
  } else if (score >= 15) {
    // RED: Very high score (multiple severe issues)
    level = 'RED';
    message = 'SEEK IMMEDIATE EMERGENCY CARE';
    action = 'Call emergency services (911/999) or go to the nearest Emergency Room immediately';
    confidence = Math.min(95, 70 + (score - 10) * 3);
  } else if (score >= 5) {
    // YELLOW: Urgent - Medical evaluation needed soon
    level = 'YELLOW';
    message = 'SCHEDULE URGENT MEDICAL EVALUATION';
    action = 'Contact your doctor within 24-48 hours for evaluation';
    // Confidence based on proximity to thresholds
    confidence = Math.min(85, 60 + (score - 5) * 4);
  } else {
    // GREEN: Normal - No immediate concerns
    level = 'GREEN';
    message = 'NO IMMEDIATE CONCERNS DETECTED';
    action = 'Continue to monitor symptoms. Seek care if symptoms worsen or new symptoms develop';
    // Higher confidence for lower scores
    confidence = Math.min(80, 50 + (5 - score) * 6);
  }

  // Apply SNR-based confidence modifier
  if (snr_db !== undefined) {
    const snrModifier = getSNRConfidenceModifier(snr_db);
    confidence = Math.max(30, Math.min(95, confidence + snrModifier));

    // Quality-limited mode: Enforce stricter constraints for poor audio
    const qualityConstraints = getQualityLimitedConstraints(snr_db);

    if (qualityConstraints.showProminentWarning) {
      // Cap confidence in poor audio
      confidence = Math.min(confidence, qualityConstraints.maxConfidence);

      // For GREEN results in quality-limited mode, require multiple robust features
      if (level === 'GREEN' && qualityConstraints.requireMultipleFlags) {
        // If score is 0 (no flags) in very poor audio, downgrade confidence further
        if (score === 0) {
          confidence = Math.min(confidence, 50);
          flags.push('⚠️ Quality-limited result: Very low audio quality may mask subtle abnormalities');
        }
      }

      // Add quality warning to message
      if (snr_db < 10) {
        message += ' (QUALITY-LIMITED RESULT)';
        action += ' ⚠️ Consider re-recording in quieter environment for more reliable analysis.';
      }
    }
  }

  // Add default message if no flags were triggered
  if (flags.length === 0) {
    flags.push('No concerning speech patterns detected in analysis');
    detailedFlags.push({
      severity: 'low',
      message: 'All acoustic features within normal ranges',
      points: 0
    });
  }

  return {
    level,
    score,
    confidence,
    message,
    action,
    flags,
    detailedFlags,
    features,
    timestamp: new Date().toISOString(),
    snrAdjustment: snrAdjustment || undefined
  };
}

/**
 * Get color scheme for triage level
 */
export function getTriageColors(level: TriageLevel) {
  const colorSchemes = {
    RED: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-900',
      icon: 'text-red-600',
      badge: 'bg-red-100 text-red-800',
      button: 'bg-red-600 hover:bg-red-700'
    },
    YELLOW: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'text-yellow-900',
      icon: 'text-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    GREEN: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-900',
      icon: 'text-green-600',
      badge: 'bg-green-100 text-green-800',
      button: 'bg-green-600 hover:bg-green-700'
    }
  };

  return colorSchemes[level];
}

/**
 * Format feature value for display
 */
export function formatFeatureValue(value: number, unit: string): string {
  if (unit === '%') {
    return `${value.toFixed(2)}%`;
  } else if (unit === 'dB') {
    return `${value.toFixed(2)} dB`;
  } else if (unit === 'syl/s') {
    return `${value.toFixed(2)} syl/s`;
  } else {
    return value.toFixed(2);
  }
}

/**
 * Get feature threshold information
 */
export interface FeatureThreshold {
  name: string;
  value: number;
  threshold: number;
  unit: string;
  description: string;
  inverse?: boolean; // Lower is worse (e.g., HNR)
}

export function getFeatureThresholds(features: AudioFeatures, language: Language = 'en'): FeatureThreshold[] {
  const thresholds = getThresholds(language);

  const baseFeatures: FeatureThreshold[] = [
    {
      name: 'Jitter',
      value: features.jitter_local,
      threshold: thresholds.jitter_high,
      unit: '%',
      description: 'Voice frequency stability',
      inverse: false
    },
    {
      name: 'Shimmer',
      value: features.shimmer_dda,
      threshold: thresholds.shimmer_high,
      unit: '%',
      description: 'Voice amplitude stability',
      inverse: false
    },
    {
      name: 'HNR',
      value: features.hnr,
      threshold: thresholds.hnr_low,
      unit: 'dB',
      description: 'Harmonics-to-noise ratio',
      inverse: true // Lower HNR is worse
    },
    {
      name: 'Speech Rate',
      value: features.speech_rate,
      threshold: thresholds.speech_rate_low_yellow,  // Fixed: was speech_rate_low (doesn't exist)
      unit: 'syl/s',
      description: 'Syllables per second',
      inverse: true // Lower speech rate is concerning
    }
  ];

  // Add pause ratio features (dual ratios if available)
  if (features.respiratory_pause_ratio !== undefined && features.brief_pause_ratio !== undefined) {
    // New hybrid approach: show both pause types
    baseFeatures.push(
      {
        name: 'Brief Pauses',
        value: features.brief_pause_ratio,
        threshold: 15, // Normal speech has 5-15% brief pauses (300-800ms)
        unit: '%',
        description: 'Normal inter-sentence pauses (300-800ms)',
        inverse: false
      },
      {
        name: 'Respiratory Pauses',
        value: features.respiratory_pause_ratio,
        threshold: 3, // >3% respiratory pauses is concerning
        unit: '%',
        description: 'Long pauses >800ms (respiratory indicator)',
        inverse: false
      }
    );
  } else {
    // Fallback: show total pause ratio (backward compatibility)
    baseFeatures.push({
      name: 'Pause Ratio',
      value: features.pause_ratio,
      threshold: thresholds.pause_high,  // Fixed: was pause_ratio_high (doesn't exist)
      unit: '%',
      description: 'Percentage of silence',
      inverse: false
    });
  }

  // Add voice breaks
  baseFeatures.push({
    name: 'Voice Breaks',
    value: features.voice_breaks,
    threshold: thresholds.voice_breaks_threshold,  // Fixed: was voice_breaks_high (doesn't exist)
    unit: 'breaks',
    description: 'Voice discontinuities',
    inverse: false
  });

  return baseFeatures;
}
