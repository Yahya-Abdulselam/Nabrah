/**
 * Pre-Screening Questionnaire Logic
 *
 * Calculates risk scores based on patient health background
 * to provide context for voice analysis results.
 */

// Age ranges and their risk points
export type AgeRange = 'under40' | '40-55' | '55-70' | 'over70';

// Medical conditions that increase stroke/neurological risk
export type MedicalCondition =
  | 'hypertension'
  | 'diabetes'
  | 'heart_disease'
  | 'previous_stroke'
  | 'family_history';

// Sudden events (stroke warning signs)
export type SuddenEvent =
  | 'sudden_weakness'
  | 'sudden_confusion'
  | 'sudden_headache'
  | 'no_sudden_event';

// Current health status options
export type CurrentHealthStatus =
  | 'healthy'
  | 'cold_flu'
  | 'tired'
  | 'unwell_other';

// Lifestyle factors
export type LifestyleFactor =
  | 'smoker'
  | 'high_stress'
  | 'poor_diet_sedentary';

// Last checkup timing
export type LastCheckup =
  | 'within_6_months'
  | '6_to_12_months'
  | 'over_1_year'
  | 'never';

// Complete questionnaire answers
export interface QuestionnaireAnswers {
  age: AgeRange;
  conditions: MedicalCondition[];
  currentHealth: CurrentHealthStatus;
  lifestyle: LifestyleFactor[];
  lastCheckup: LastCheckup;
  suddenEvents: SuddenEvent[];  // NEW: Sudden stroke warning signs
}

// Risk assessment result
export interface QuestionnaireResult {
  totalScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  hasConfoundingFactors: boolean;
  confidenceModifier: number;
  riskFactors: string[];
  recommendations: string[];
}

// Point values for each answer
const AGE_POINTS: Record<AgeRange, number> = {
  'under40': 0,
  '40-55': 1,
  '55-70': 2,
  'over70': 3
};

const CONDITION_POINTS: Record<MedicalCondition, number> = {
  'hypertension': 2,
  'diabetes': 2,
  'heart_disease': 3,
  'previous_stroke': 4,
  'family_history': 1
};

const HEALTH_STATUS_POINTS: Record<CurrentHealthStatus, number> = {
  'healthy': 0,
  'cold_flu': -2,  // Negative because it explains voice changes
  'tired': -1,
  'unwell_other': 1
};

const LIFESTYLE_POINTS: Record<LifestyleFactor, number> = {
  'smoker': 2,
  'high_stress': 1,
  'poor_diet_sedentary': 1
};

const CHECKUP_POINTS: Record<LastCheckup, number> = {
  'within_6_months': 0,
  '6_to_12_months': 1,
  'over_1_year': 2,
  'never': 3
};

const SUDDEN_EVENT_POINTS: Record<SuddenEvent, number> = {
  'sudden_weakness': 3,      // Stroke warning sign (moderate weight)
  'sudden_confusion': 3,     // Stroke warning sign (moderate weight)
  'sudden_headache': 2,      // Possible stroke/neurological (lower weight)
  'no_sudden_event': 0       // Baseline
};

// Human-readable labels
export const AGE_LABELS: Record<AgeRange, string> = {
  'under40': 'Under 40',
  '40-55': '40-55',
  '55-70': '55-70',
  'over70': 'Over 70'
};

export const CONDITION_LABELS: Record<MedicalCondition, string> = {
  'hypertension': 'High blood pressure',
  'diabetes': 'Diabetes',
  'heart_disease': 'Heart disease / irregular heartbeat',
  'previous_stroke': 'Previous stroke or TIA',
  'family_history': 'Family history of stroke'
};

export const HEALTH_STATUS_LABELS: Record<CurrentHealthStatus, string> = {
  'healthy': 'Feeling normal/healthy today',
  'cold_flu': 'Have cold/flu/sore throat',
  'tired': 'Very tired/exhausted',
  'unwell_other': 'Feeling unwell (other)'
};

export const LIFESTYLE_LABELS: Record<LifestyleFactor, string> = {
  'smoker': 'Smoker',
  'high_stress': 'High stress / demanding job',
  'poor_diet_sedentary': 'Poor diet / sedentary lifestyle'
};

export const CHECKUP_LABELS: Record<LastCheckup, string> = {
  'within_6_months': 'Within last 6 months',
  '6_to_12_months': '6-12 months ago',
  'over_1_year': 'Over 1 year ago',
  'never': 'Never / can\'t remember'
};

export const SUDDEN_EVENT_LABELS: Record<SuddenEvent, string> = {
  'sudden_weakness': 'Sudden weakness or collapse',
  'sudden_confusion': 'Sudden confusion or fainting',
  'sudden_headache': 'Sudden severe headache',
  'no_sudden_event': 'No sudden event'
};

/**
 * Calculate questionnaire risk score
 */
export function calculateQuestionnaireScore(answers: QuestionnaireAnswers): QuestionnaireResult {
  let totalScore = 0;
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  // Age points
  const agePoints = AGE_POINTS[answers.age];
  totalScore += agePoints;
  if (agePoints >= 2) {
    riskFactors.push(`Age ${AGE_LABELS[answers.age]} (higher risk bracket)`);
  }

  // Medical conditions
  for (const condition of answers.conditions) {
    const points = CONDITION_POINTS[condition];
    totalScore += points;
    riskFactors.push(CONDITION_LABELS[condition]);
  }

  // Current health status
  const healthPoints = HEALTH_STATUS_POINTS[answers.currentHealth];
  totalScore += healthPoints;

  // Lifestyle factors
  for (const factor of answers.lifestyle) {
    const points = LIFESTYLE_POINTS[factor];
    totalScore += points;
    if (factor === 'smoker') {
      riskFactors.push('Current smoker');
      recommendations.push('Consider smoking cessation support');
    }
  }

  // Last checkup
  const checkupPoints = CHECKUP_POINTS[answers.lastCheckup];
  totalScore += checkupPoints;
  if (checkupPoints >= 2) {
    riskFactors.push('Overdue for health checkup');
    recommendations.push('Schedule a comprehensive health checkup');
  }

  // Sudden events (stroke warning signs)
  for (const event of answers.suddenEvents) {
    const points = SUDDEN_EVENT_POINTS[event];
    totalScore += points;
    if (event === 'sudden_weakness') {
      riskFactors.push('Sudden weakness or collapse (STROKE WARNING)');
      recommendations.push('Seek immediate medical attention if experiencing sudden weakness with speech changes');
    } else if (event === 'sudden_confusion') {
      riskFactors.push('Sudden confusion or fainting (STROKE WARNING)');
      recommendations.push('Seek immediate medical attention if experiencing sudden confusion with speech changes');
    } else if (event === 'sudden_headache') {
      riskFactors.push('Sudden severe headache');
      recommendations.push('Monitor for additional neurological symptoms');
    }
  }

  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'high';
  if (totalScore <= 3) {
    riskLevel = 'low';
  } else if (totalScore <= 7) {
    riskLevel = 'moderate';
  } else {
    riskLevel = 'high';
  }

  // Check for confounding factors (cold, fatigue)
  const hasConfoundingFactors =
    answers.currentHealth === 'cold_flu' ||
    answers.currentHealth === 'tired';

  // Calculate confidence modifier
  // If has cold/flu, reduce confidence in voice abnormalities
  // If has multiple risk factors + voice issues, increase confidence
  let confidenceModifier = 1.0;
  if (hasConfoundingFactors) {
    confidenceModifier = 0.6; // Reduce confidence
    recommendations.push('Voice changes may be due to current health status. Consider retesting after recovery.');
  }
  if (answers.conditions.length >= 3) {
    confidenceModifier = Math.min(1.3, confidenceModifier * 1.2); // Increase confidence for high-risk
  }

  // Add recommendations based on risk
  if (riskLevel === 'high') {
    recommendations.push('Multiple risk factors detected. Regular monitoring recommended.');
  }
  if (answers.conditions.includes('previous_stroke')) {
    recommendations.push('History of stroke - any speech changes warrant immediate attention');
  }

  return {
    totalScore: isNaN(totalScore) ? 0 : totalScore,
    riskLevel,
    hasConfoundingFactors,
    confidenceModifier,
    riskFactors,
    recommendations
  };
}

/**
 * Combine questionnaire score with voice analysis score
 */
export function calculateCombinedTriage(
  questionnaireScore: number,
  voiceScore: number,
  hasConfoundingFactors: boolean
): {
  combinedScore: number;
  triageLevel: 'RED' | 'YELLOW' | 'GREEN';
  reasoning: string;
} {
  const combinedScore = questionnaireScore + voiceScore;

  let triageLevel: 'RED' | 'YELLOW' | 'GREEN';
  let reasoning: string;

  // Adjusted thresholds that account for questionnaire context
  if (combinedScore >= 15) {
    triageLevel = 'RED';
    reasoning = 'High combined risk score from health history and voice analysis';
  } else if (combinedScore >= 8) {
    triageLevel = 'YELLOW';
    if (hasConfoundingFactors && voiceScore >= 8) {
      reasoning = 'Voice abnormalities detected but may be affected by current health status (cold/fatigue)';
    } else {
      reasoning = 'Moderate concern - follow-up recommended';
    }
  } else {
    triageLevel = 'GREEN';
    reasoning = 'Low overall risk based on health history and voice analysis';
  }

  return {
    combinedScore,
    triageLevel,
    reasoning
  };
}

/**
 * Get empty/default questionnaire answers
 */
export function getDefaultAnswers(): QuestionnaireAnswers {
  return {
    age: 'under40',
    conditions: [],
    currentHealth: 'healthy',
    lifestyle: [],
    lastCheckup: 'within_6_months',
    suddenEvents: ['no_sudden_event']  // Default: no sudden event
  };
}
