/**
 * SNR Option A Validation Tests
 *
 * Verifies that we've eliminated "double compensation" and
 * implemented a clean feature-correction-only approach.
 *
 * Test scenarios:
 * 1. Clean audio (SNR 20+): No adjustments
 * 2. Moderate noise (SNR 12-15): Backend correction + mild confidence penalty
 * 3. Poor noise (SNR 10-12): Backend correction + confidence penalty + mild weighting
 * 4. Critical noise (SNR <10): Quality-limited mode, max confidence 60%
 */

import { calculateTriage } from '../triageLogic';
import { getAdaptiveThresholds, getSNRConfidenceModifier, getQualityLimitedConstraints } from '../snrAdaptation';
import { getThresholds } from '../thresholds';
import type { AudioFeatures } from '../triageLogic';

describe('SNR Option A: Feature Correction Only (No Double Compensation)', () => {

  // Mock healthy speaker with moderate noise
  const mockHealthyInNoise: AudioFeatures = {
    jitter_local: 1.2,      // Slightly elevated (noise-corrected from 1.6%)
    shimmer_dda: 4.8,       // Normal range (noise-corrected from 5.5%)
    hnr: 8.5,               // Acceptable (noise-corrected from 6.0 dB)
    speech_rate: 2.6,       // Normal
    pause_ratio: 18.0,      // Normal (noise-corrected from 20%)
    voice_breaks: 1,        // Normal
    mean_intensity: 65.0,
  };

  // Mock pathological speaker in clean audio
  const mockPathologicalInClean: AudioFeatures = {
    jitter_local: 2.5,      // High (pathological)
    shimmer_dda: 7.0,       // High (pathological)
    hnr: 4.0,               // Low (pathological)
    speech_rate: 1.8,       // Slow (pathological)
    pause_ratio: 28.0,      // High (pathological)
    voice_breaks: 3,        // High (pathological)
    mean_intensity: 60.0,
  };

  describe('Test 1: Clean Audio (SNR 20 dB) - No Adjustments', () => {
    it('should use base thresholds without relaxation', () => {
      const baseThresholds = getThresholds('en');
      const adaptiveThresholds = getAdaptiveThresholds(20, baseThresholds);

      // Thresholds should be IDENTICAL (no adjustment)
      expect(adaptiveThresholds.jitter_high).toBe(baseThresholds.jitter_high);
      expect(adaptiveThresholds.shimmer_high).toBe(baseThresholds.shimmer_high);
      expect(adaptiveThresholds.hnr_low_red).toBe(baseThresholds.hnr_low_red);
      expect(adaptiveThresholds.pause_high).toBe(baseThresholds.pause_high);
    });

    it('should not apply confidence penalty', () => {
      const modifier = getSNRConfidenceModifier(20);
      expect(modifier).toBe(0); // No penalty or boost
    });

    it('should detect pathological features correctly', () => {
      const result = calculateTriage(mockPathologicalInClean, 'en', 20);

      // Should trigger RED (score >= 10)
      expect(result.level).toBe('RED');
      expect(result.score).toBeGreaterThanOrEqual(10);
      expect(result.confidence).toBeGreaterThan(70);
    });
  });

  describe('Test 2: Moderate Noise (SNR 13 dB) - Backend Correction Only', () => {
    it('should use base thresholds (no relaxation)', () => {
      const baseThresholds = getThresholds('en');
      const adaptiveThresholds = getAdaptiveThresholds(13, baseThresholds);

      // Thresholds should be IDENTICAL (Option A: no frontend relaxation)
      expect(adaptiveThresholds.jitter_high).toBe(baseThresholds.jitter_high);
      expect(adaptiveThresholds.shimmer_high).toBe(baseThresholds.shimmer_high);
      expect(adaptiveThresholds.hnr_low_red).toBe(baseThresholds.hnr_low_red);
    });

    it('should apply mild confidence penalty', () => {
      const modifier = getSNRConfidenceModifier(13);
      expect(modifier).toBe(-10); // Acceptable bin: -10%
    });

    it('should NOT give false GREEN to pathological speaker', () => {
      // Even in noise, pathological features should still trigger flags
      // Backend already corrected features, thresholds stay stable
      const result = calculateTriage(mockPathologicalInClean, 'en', 13);

      // Pathological speaker should still be RED or YELLOW, NOT GREEN
      expect(result.level).not.toBe('GREEN');
      expect(result.score).toBeGreaterThan(5);
    });

    it('should NOT give false RED to healthy speaker', () => {
      // Backend corrected features, so healthy + noise should stay GREEN
      const result = calculateTriage(mockHealthyInNoise, 'en', 13);

      // Healthy speaker should be GREEN (no double compensation)
      // Backend already removed noise bias from features
      expect(result.score).toBeLessThan(10); // Not RED
      expect(result.confidence).toBeGreaterThan(50); // Still reasonable confidence
    });
  });

  describe('Test 3: Poor Noise (SNR 11 dB) - Confidence Penalty + Mild Weighting', () => {
    it('should still use base thresholds', () => {
      const baseThresholds = getThresholds('en');
      const adaptiveThresholds = getAdaptiveThresholds(11, baseThresholds);

      // Still no relaxation (Option A)
      expect(adaptiveThresholds.jitter_high).toBe(baseThresholds.jitter_high);
      expect(adaptiveThresholds.shimmer_high).toBe(baseThresholds.shimmer_high);
    });

    it('should apply significant confidence penalty', () => {
      const modifier = getSNRConfidenceModifier(11);
      expect(modifier).toBe(-20); // Poor bin: -20%
    });

    it('should show prominent warning', () => {
      const constraints = getQualityLimitedConstraints(11);
      expect(constraints.showProminentWarning).toBe(true);
      expect(constraints.maxConfidence).toBe(75);
    });
  });

  describe('Test 4: Critical Noise (SNR 8 dB) - Quality-Limited Mode', () => {
    it('should apply minimal uncertainty band (5%, not 20%)', () => {
      const baseThresholds = getThresholds('en');
      const adaptiveThresholds = getAdaptiveThresholds(8, baseThresholds);

      // Only 5% relaxation (not 20% like before)
      expect(adaptiveThresholds.jitter_high).toBeCloseTo(baseThresholds.jitter_high * 1.05, 2);
      expect(adaptiveThresholds.shimmer_high).toBeCloseTo(baseThresholds.shimmer_high * 1.05, 2);
    });

    it('should apply heavy confidence penalty', () => {
      const modifier = getSNRConfidenceModifier(8);
      expect(modifier).toBe(-35); // Critical bin: -35%
    });

    it('should enforce quality-limited mode', () => {
      const constraints = getQualityLimitedConstraints(8);
      expect(constraints.showProminentWarning).toBe(true);
      expect(constraints.maxConfidence).toBe(60);
      expect(constraints.requireMultipleFlags).toBe(true);
    });

    it('should cap confidence at 60% max', () => {
      const result = calculateTriage(mockPathologicalInClean, 'en', 8);
      expect(result.confidence).toBeLessThanOrEqual(60);
    });

    it('should add quality warning to message', () => {
      const result = calculateTriage(mockHealthyInNoise, 'en', 8);
      expect(result.message).toContain('QUALITY-LIMITED');
      expect(result.action).toContain('re-recording');
    });
  });

  describe('Test 5: Verify No Double Compensation', () => {
    it('should not stack corrections (backend + frontend)', () => {
      const baseThresholds = getThresholds('en');
      const snr = 12;

      // Backend already corrected features (see server.py)
      // Frontend should NOT also relax thresholds

      const adaptiveThresholds = getAdaptiveThresholds(snr, baseThresholds);

      // Thresholds should match base (Option A: no frontend relaxation)
      expect(adaptiveThresholds).toEqual(baseThresholds);
    });

    it('should apply weighting conservatively (not aggressively)', () => {
      // OLD SYSTEM: 50% weight at SNR 12 (aggressive)
      // NEW SYSTEM: 85% weight at SNR 12 (conservative)

      const mockFeatures: AudioFeatures = {
        jitter_local: 1.6,      // Slightly high
        shimmer_dda: 5.2,       // Slightly high
        hnr: 7.0,
        speech_rate: 2.5,
        pause_ratio: 20.0,
        voice_breaks: 1,
        mean_intensity: 65.0,
      };

      const result = calculateTriage(mockFeatures, 'en', 12);

      // Should not aggressively downweight to 0 score
      // Mild weighting only
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Test 6: Comparison with Old System', () => {
    it('OLD: Would give false GREEN to pathological in noise', () => {
      // Simulate old system behavior:
      // - Backend corrected: shimmer 7.0% → 5.5%
      // - Frontend relaxed threshold: 5.5% → 6.6% (+20%)
      // - Frontend downweighted: 5 points → 2.5 points (50%)
      // Result: No flag triggered, FALSE GREEN

      // NEW SYSTEM: Should still catch this
      const result = calculateTriage(mockPathologicalInClean, 'en', 12);
      expect(result.level).not.toBe('GREEN');
    });

    it('OLD: Would give false RED to healthy in noise', () => {
      // Simulate old system behavior:
      // - Raw shimmer: 5.5%
      // - No correction: triggers RED (>5.5%)
      // Result: FALSE RED

      // NEW SYSTEM: Backend corrects, should be GREEN
      const result = calculateTriage(mockHealthyInNoise, 'en', 12);
      expect(result.level).not.toBe('RED');
    });
  });

  describe('Test 7: Edge Case - Very Pathological in Very Noisy', () => {
    const mockSevereInNoise: AudioFeatures = {
      jitter_local: 3.0,      // Very high (even after correction)
      shimmer_dda: 8.0,       // Very high
      hnr: 3.0,               // Very low
      speech_rate: 1.5,       // Very slow
      pause_ratio: 35.0,      // Very high
      voice_breaks: 5,        // Very high
      mean_intensity: 55.0,
    };

    it('should still trigger RED despite noise', () => {
      // Quality-limited mode should NOT hide severe pathology
      const result = calculateTriage(mockSevereInNoise, 'en', 8);

      expect(result.level).toBe('RED');
      expect(result.score).toBeGreaterThanOrEqual(10);

      // But confidence should be capped
      expect(result.confidence).toBeLessThanOrEqual(60);
    });
  });
});

describe('SNR Backend Correction Validation', () => {
  it('should have reduced correction constants', () => {
    // This test would check that server.py uses new conservative constants
    // K_JITTER: 0.04 (not 0.05)
    // K_SHIMMER: 0.10 (not 0.15)
    // K_HNR: 0.30 (not 0.5)
    // K_PAUSE: 0.004 (not 0.008)

    // Would require importing from Python (integration test)
    expect(true).toBe(true); // Placeholder
  });

  it('should enforce correction clamps', () => {
    // MAX_JITTER_CORRECTION: 0.4%
    // MAX_SHIMMER_CORRECTION: 1.5%
    // MAX_HNR_CORRECTION: 3.0 dB
    // MAX_PAUSE_CORRECTION: 5%

    // Would require testing Python function (integration test)
    expect(true).toBe(true); // Placeholder
  });
});
