/**
 * BACKUP OF ORIGINAL THRESHOLDS - 2026-01-30
 * Created before recalibration to address false RED triage flags
 *
 * This file preserves the thresholds that were recalibrated on 2026-01-29
 * System was consistently giving RED results for healthy individuals
 */

import { Language } from './i18n/types';

export interface ThresholdSet {
  jitter_high: number;
  shimmer_high: number;
  hnr_low_red: number;
  hnr_low_yellow: number;
  pause_high: number;
  speech_rate_low_red: number;
  speech_rate_low_yellow: number;
  voice_breaks_threshold: number;
}

/**
 * ORIGINAL THRESHOLDS (2026-01-29)
 * These were already adjusted from clinical thresholds but still too sensitive
 */
export const BACKUP_THRESHOLDS: Record<Language, ThresholdSet> = {
  en: {
    jitter_high: 1.5,                 // YELLOW: > 1.5% (was 1.040% clinical)
    shimmer_high: 5.5,                // RED: > 5.5% (was 3.810% clinical)
    hnr_low_red: 5.0,                 // RED: < 5 dB (was 7 dB clinical)
    hnr_low_yellow: 8.0,              // YELLOW: < 8 dB (was 10 dB clinical)
    pause_high: 25.0,                 // RED: > 25% (was 17% clinical)
    speech_rate_low_red: 2.0,         // RED: < 2.0 sps (was 2.5 clinical)
    speech_rate_low_yellow: 2.8,      // YELLOW: < 2.8 sps (was 3.3 clinical)
    voice_breaks_threshold: 2,        // > 2 breaks (was 0 clinical)
  },
  ar: {
    jitter_high: 1.5,
    shimmer_high: 5.5,
    hnr_low_red: 5.0,
    hnr_low_yellow: 8.0,
    pause_high: 25.0,
    speech_rate_low_red: 1.8,         // Arabic slower than English
    speech_rate_low_yellow: 2.3,
    voice_breaks_threshold: 2,
  },
};

/**
 * SCORING SYSTEM (unchanged)
 * Score >= 10 → RED (Emergency)
 * Score >= 5  → YELLOW (Urgent)
 * Score < 5   → GREEN (Normal)
 *
 * Point Values:
 * - RED FLAGS: 5 points each (shimmer_high, pause_high, hnr_low_red, speech_rate_low_red)
 * - YELLOW FLAGS: 2 points each (jitter_high, hnr_low_yellow, speech_rate_low_yellow, voice_breaks)
 */

/**
 * PROBLEMS WITH THESE THRESHOLDS:
 *
 * 1. HNR < 5 dB (RED, +5 points)
 *    - Home recording noise easily triggers this
 *    - Even "good" SNR (15+ dB) can have low HNR
 *    - Should be < 4 dB for RED, < 6 dB for YELLOW
 *
 * 2. Pause Ratio > 25% (RED, +5 points)
 *    - Natural pauses in prompt trigger this
 *    - Should be > 35% for RED, > 28% for YELLOW
 *
 * 3. Shimmer > 5.5% (RED, +5 points)
 *    - Healthy voices show 3-6% in short recordings
 *    - Should be > 7% for RED, > 5.5% for YELLOW
 *
 * 4. Speech Rate < 2.0 sps (RED, +5 points)
 *    - Clear, careful speech naturally slows rate
 *    - Should be < 1.5 sps for RED, < 2.0 sps for YELLOW
 *
 * 5. Jitter > 1.5% (YELLOW, +2 points)
 *    - Slightly too strict for home recordings
 *    - Should be > 2.0% for YELLOW
 *
 * RESULT: Combination of any 2 RED flags = 10 points = RED triage
 *         Common: Low HNR (noise) + Natural pauses = FALSE RED
 */
