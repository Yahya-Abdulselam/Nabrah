/**
 * Language-Specific Recording Prompts for Nabrah
 *
 * These prompts are used for:
 * 1. Display to users during recording
 * 2. WER (Word Error Rate) calculation reference
 */

import { Language } from './types';

/**
 * Recording prompts displayed to users
 */
export const RECORDING_PROMPTS: Record<Language, string> = {
  en: 'Today is Monday. I need medical help.',
  ar: 'اليوم يوم الاثنين. أحتاج مساعدة طبية.',
};

/**
 * Expected prompts for WER calculation
 * Normalized (no punctuation) for accurate comparison
 */
export const EXPECTED_PROMPTS: Record<Language, string> = {
  en: 'today is monday i need medical help',
  ar: 'اليوم يوم الاثنين أحتاج مساعدة طبية',
};

/**
 * Get recording prompt for display
 */
export function getRecordingPrompt(language: Language): string {
  return RECORDING_PROMPTS[language] || RECORDING_PROMPTS.en;
}

/**
 * Get expected prompt for WER calculation
 */
export function getExpectedPrompt(language: Language): string {
  return EXPECTED_PROMPTS[language] || EXPECTED_PROMPTS.en;
}
