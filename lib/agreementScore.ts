/**
 * Multi-Method Agreement Score
 *
 * Calculates consensus across different analysis methods.
 * Higher agreement = higher confidence in the diagnosis.
 */

export type MethodVerdict = 'normal' | 'concerning' | 'critical';

export interface MethodAssessment {
  method: 'praat' | 'whisper_confidence' | 'wer' | 'quality';
  name: string;
  verdict: MethodVerdict;
  score: number;
  maxScore: number;
  details: string;
}

export type ConsensusLevel = 'unanimous' | 'strong' | 'mixed' | 'conflicting';

export interface AgreementScore {
  methodsAgree: number;
  totalMethods: number;
  agreementPercentage: number;
  consensusLevel: ConsensusLevel;
  methodDetails: MethodAssessment[];
  overallVerdict: MethodVerdict;
}

/**
 * Calculate Praat method assessment based on acoustic features
 */
export function assessPraatMethod(praatScore: number): MethodAssessment {
  let verdict: MethodVerdict;
  let details: string;

  if (praatScore >= 10) {
    verdict = 'critical';
    details = 'Multiple critical acoustic abnormalities detected';
  } else if (praatScore >= 5) {
    verdict = 'concerning';
    details = 'Some acoustic abnormalities detected';
  } else {
    verdict = 'normal';
    details = 'Acoustic features within normal range';
  }

  return {
    method: 'praat',
    name: 'Acoustic Analysis',
    verdict,
    score: praatScore,
    maxScore: 15,
    details
  };
}

/**
 * Calculate Whisper confidence assessment
 */
export function assessWhisperConfidence(
  avgLogprob: number,
  confidenceScore: number
): MethodAssessment {
  let verdict: MethodVerdict;
  let details: string;

  // avgLogprob typically ranges from -2.0 (unclear) to 0.0 (clear)
  if (avgLogprob < -1.0) {
    verdict = 'critical';
    details = 'Speech clarity is very poor';
  } else if (avgLogprob < -0.5) {
    verdict = 'concerning';
    details = 'Speech clarity is reduced';
  } else {
    verdict = 'normal';
    details = 'Speech clarity is good';
  }

  return {
    method: 'whisper_confidence',
    name: 'Speech Clarity',
    verdict,
    score: Math.round(confidenceScore),
    maxScore: 100,
    details
  };
}

/**
 * Calculate WER assessment
 */
export function assessWER(wer: number): MethodAssessment {
  let verdict: MethodVerdict;
  let details: string;

  if (wer > 0.5) {
    verdict = 'critical';
    details = 'Severe articulation difficulty';
  } else if (wer > 0.3) {
    verdict = 'concerning';
    details = 'Moderate articulation difficulty';
  } else if (wer > 0.15) {
    verdict = 'concerning';
    details = 'Mild articulation difficulty';
  } else {
    verdict = 'normal';
    details = 'Articulation is clear';
  }

  // Convert WER to a quality score (0-100, higher is better)
  const qualityScore = Math.round((1 - wer) * 100);

  return {
    method: 'wer',
    name: 'Word Accuracy',
    verdict,
    score: qualityScore,
    maxScore: 100,
    details
  };
}

/**
 * Calculate audio quality assessment
 */
export function assessQuality(
  snrDb: number,
  speechPercentage: number
): MethodAssessment {
  let verdict: MethodVerdict;
  let details: string;

  if (snrDb < 10 || speechPercentage < 20) {
    verdict = 'critical';
    details = 'Audio quality too poor for reliable analysis';
  } else if (snrDb < 15 || speechPercentage < 40) {
    verdict = 'concerning';
    details = 'Audio quality may affect accuracy';
  } else {
    verdict = 'normal';
    details = 'Audio quality is good';
  }

  // Combine SNR and speech percentage into single score
  const snrScore = Math.min(100, (snrDb / 20) * 100);
  const speechScore = Math.min(100, (speechPercentage / 60) * 100);
  const combinedScore = Math.round((snrScore + speechScore) / 2);

  return {
    method: 'quality',
    name: 'Audio Quality',
    verdict,
    score: combinedScore,
    maxScore: 100,
    details
  };
}

/**
 * Calculate overall agreement across all methods
 */
export function calculateAgreement(
  methods: MethodAssessment[]
): AgreementScore {
  if (methods.length === 0) {
    return {
      methodsAgree: 0,
      totalMethods: 0,
      agreementPercentage: 0,
      consensusLevel: 'conflicting',
      methodDetails: [],
      overallVerdict: 'normal'
    };
  }

  // Count verdicts
  const verdictCounts: Record<MethodVerdict, number> = {
    normal: 0,
    concerning: 0,
    critical: 0
  };

  for (const method of methods) {
    verdictCounts[method.verdict]++;
  }

  // Find majority verdict
  let majorityVerdict: MethodVerdict = 'normal';
  let maxCount = 0;

  for (const [verdict, count] of Object.entries(verdictCounts)) {
    if (count > maxCount) {
      maxCount = count;
      majorityVerdict = verdict as MethodVerdict;
    }
  }

  // Calculate agreement
  const methodsAgree = maxCount;
  const totalMethods = methods.length;
  const agreementPercentage = Math.round((methodsAgree / totalMethods) * 100);

  // Determine consensus level
  let consensusLevel: ConsensusLevel;
  if (agreementPercentage === 100) {
    consensusLevel = 'unanimous';
  } else if (agreementPercentage >= 75) {
    consensusLevel = 'strong';
  } else if (agreementPercentage >= 50) {
    consensusLevel = 'mixed';
  } else {
    consensusLevel = 'conflicting';
  }

  // Determine overall verdict (prioritize critical findings)
  let overallVerdict: MethodVerdict;
  if (verdictCounts.critical >= 2 || verdictCounts.critical >= totalMethods / 2) {
    overallVerdict = 'critical';
  } else if (verdictCounts.critical >= 1 || verdictCounts.concerning >= 2) {
    overallVerdict = 'concerning';
  } else {
    overallVerdict = majorityVerdict;
  }

  return {
    methodsAgree,
    totalMethods,
    agreementPercentage,
    consensusLevel,
    methodDetails: methods,
    overallVerdict
  };
}

/**
 * Get human-readable consensus description
 */
export function getConsensusDescription(agreement: AgreementScore): string {
  const { consensusLevel, methodsAgree, totalMethods, overallVerdict } = agreement;

  const verdictText = overallVerdict === 'critical'
    ? 'emergency indicators'
    : overallVerdict === 'concerning'
      ? 'concerning patterns'
      : 'normal patterns';

  switch (consensusLevel) {
    case 'unanimous':
      return `All ${totalMethods} methods agree: ${verdictText} detected`;
    case 'strong':
      return `${methodsAgree}/${totalMethods} methods agree: ${verdictText} detected`;
    case 'mixed':
      return `Mixed results (${methodsAgree}/${totalMethods} agree): ${verdictText} suggested`;
    case 'conflicting':
      return `Conflicting results: Consider re-recording for clearer assessment`;
    default:
      return `${methodsAgree}/${totalMethods} methods analyzed`;
  }
}
