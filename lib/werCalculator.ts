/**
 * Word Error Rate (WER) Calculator
 *
 * Calculates how accurately Whisper transcribed the expected prompt.
 * High WER indicates speech abnormalities (slurring, dysarthria).
 *
 * Supports English and Arabic with language-specific text normalization.
 */

import { Language } from './i18n/types';
import { getExpectedPrompt } from './i18n/prompts';

// Keep for backward compatibility
export const EXPECTED_PROMPT = "Today is Monday. I need medical help.";

export interface WERResult {
  expected: string;
  transcribed: string;
  wer: number;                // 0.0 = perfect, 1.0 = complete mismatch
  substitutions: number;
  insertions: number;
  deletions: number;
  wordMatches: string[];      // Successfully matched words
  wordErrors: string[];       // Problematic words
  isAbnormal: boolean;        // WER > 0.3 indicates potential issue
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  points: number;             // Triage points to add
}

/**
 * Normalize text for comparison
 * - Lowercase (for English)
 * - Remove punctuation
 * - Normalize whitespace
 * - Language-specific normalization (Arabic diacritics, letter variations)
 */
function normalizeText(text: string, language: Language = 'en'): string[] {
  let normalized = text.toLowerCase();

  // Arabic-specific normalization
  if (language === 'ar') {
    // Remove Arabic diacritics (tashkeel: fatha, damma, kasra, sukun, shadda, tanween, etc.)
    normalized = normalized.replace(/[\u064B-\u065F]/g, '');

    // Normalize alef variations (أ، إ، آ → ا)
    normalized = normalized.replace(/[أإآ]/g, 'ا');

    // Normalize yaa/alef maqsura (ى → ي)
    normalized = normalized.replace(/ى/g, 'ي');

    // Remove tatweel (ـ)
    normalized = normalized.replace(/ـ/g, '');

    // Normalize taa marbouta (ة → ه)
    normalized = normalized.replace(/ة/g, 'ه');
  }

  // Remove punctuation (keeping Arabic characters for Arabic text)
  const punctuationPattern = language === 'ar'
    ? /[^\w\s\u0600-\u06FF]/g  // Keep Arabic characters
    : /[^\w\s]/g;               // Standard English

  return normalized
    .replace(punctuationPattern, '')
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()
    .split(' ')
    .filter(word => word.length > 0);
}

/**
 * Calculate Levenshtein distance between two word arrays
 * Returns edit operations: substitutions, insertions, deletions
 */
function levenshteinDistance(
  reference: string[],
  hypothesis: string[]
): { distance: number; substitutions: number; insertions: number; deletions: number } {
  const m = reference.length;
  const n = hypothesis.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  // Backtrack to count operations
  let i = m, j = n;
  let substitutions = 0, insertions = 0, deletions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === hypothesis[j - 1]) {
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++;
      i--; j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      insertions++;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++;
      i--;
    } else {
      break; // Should not happen
    }
  }

  return {
    distance: dp[m][n],
    substitutions,
    insertions,
    deletions
  };
}

/**
 * Calculate Word Error Rate between expected and transcribed text
 * Supports multiple languages with appropriate text normalization
 */
export function calculateWER(
  transcribed: string,
  language: Language = 'en',
  expected?: string
): WERResult {
  // Use provided expected text or get from prompts
  const expectedText = expected || getExpectedPrompt(language);

  const referenceWords = normalizeText(expectedText, language);
  const hypothesisWords = normalizeText(transcribed, language);

  // Handle edge cases
  if (referenceWords.length === 0) {
    return {
      expected: expectedText,
      transcribed,
      wer: hypothesisWords.length > 0 ? 1.0 : 0.0,
      substitutions: 0,
      insertions: hypothesisWords.length,
      deletions: 0,
      wordMatches: [],
      wordErrors: hypothesisWords,
      isAbnormal: hypothesisWords.length > 0,
      severity: 'severe',
      points: 5
    };
  }

  if (hypothesisWords.length === 0) {
    return {
      expected: expectedText,
      transcribed,
      wer: 1.0,
      substitutions: 0,
      insertions: 0,
      deletions: referenceWords.length,
      wordMatches: [],
      wordErrors: referenceWords,
      isAbnormal: true,
      severity: 'severe',
      points: 5
    };
  }

  // Calculate Levenshtein distance
  const { distance, substitutions, insertions, deletions } = levenshteinDistance(
    referenceWords,
    hypothesisWords
  );

  // WER = (S + D + I) / N where N is reference length
  const wer = Math.min(1.0, distance / referenceWords.length);

  // Find matched and error words
  const wordMatches: string[] = [];
  const wordErrors: string[] = [];

  for (const word of referenceWords) {
    if (hypothesisWords.includes(word)) {
      wordMatches.push(word);
    } else {
      wordErrors.push(word);
    }
  }

  // Determine severity and points (language-specific thresholds)
  let severity: WERResult['severity'];
  let points: number;

  if (language === 'en') {
    // English: Whisper tiny.en baseline ~15% WER on LibriSpeech test-other
    if (wer <= 0.15) {
      severity = 'normal';
      points = 0;
    } else if (wer <= 0.30) {
      severity = 'mild';
      points = 1;
    } else if (wer <= 0.50) {
      severity = 'moderate';
      points = 3;
    } else {
      severity = 'severe';
      points = 5;
    }
  } else {
    // Arabic (MSA): Talafha et al. ~13-17% WER on MSA benchmarks, ~31% on harder
    // Use 20% as normal upper bound, 40% as elevated
    if (wer <= 0.20) {
      severity = 'normal';
      points = 0;
    } else if (wer <= 0.40) {
      severity = 'mild';
      points = 2;
    } else {
      severity = 'severe';
      points = 5;
    }
  }

  return {
    expected: expectedText,
    transcribed,
    wer: Math.round(wer * 1000) / 1000, // 3 decimal places
    substitutions,
    insertions,
    deletions,
    wordMatches,
    wordErrors,
    isAbnormal: language === 'en' ? wer > 0.30 : wer > 0.40,
    severity,
    points
  };
}

/**
 * Get human-readable WER description
 */
export function getWERDescription(result: WERResult): string {
  const percentage = Math.round(result.wer * 100);

  switch (result.severity) {
    case 'normal':
      return `Speech clarity is good (${percentage}% error rate)`;
    case 'mild':
      return `Mild articulation difficulty detected (${percentage}% error rate)`;
    case 'moderate':
      return `Moderate speech difficulty detected (${percentage}% error rate)`;
    case 'severe':
      return `Severe speech impairment detected (${percentage}% error rate)`;
    default:
      return `Word error rate: ${percentage}%`;
  }
}
