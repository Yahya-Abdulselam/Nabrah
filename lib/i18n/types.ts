/**
 * i18n Type Definitions for Nabrah
 *
 * Language support: English (en) and Arabic (ar)
 */

export type Language = 'en' | 'ar';

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    startCheck: string;
    patientQueue: string;
    backToHome: string;
    next: string;
    back: string;
    skip: string;
    retry: string;
    download: string;
    addToQueue: string;
    newCheck: string;
    showDetails: string;
    hideDetails: string;
  };

  landing: {
    hero: {
      title: string;
      subtitle: string;
      description: string;
    };
    howItWorks: {
      title: string;
      step1: { title: string; description: string };
      step2: { title: string; description: string };
      step3: { title: string; description: string };
    };
    features: {
      title: string;
      voiceStability: { title: string; description: string };
      voiceQuality: { title: string; description: string };
      speechRate: { title: string; description: string };
      pausePatterns: { title: string; description: string };
    };
    stats: {
      recording: string;
      analysis: string;
    };
  };

  recorder: {
    title: string;
    promptInstruction: string;
    prompt: string;
    startRecording: string;
    stopEarly: string;
    recordingInProgress: string;
    autoStopMessage: string;
    recordingComplete: string;
    audioSize: string;
    recordAgain: string;
    analyzeRecording: string;
    tip: string;
    noFfmpeg: string;
    permissionDenied: string;
  };

  triage: {
    levels: {
      red: string;
      yellow: string;
      green: string;
    };
    messages: {
      red: string;
      yellow: string;
      green: string;
    };
    actions: {
      red: string;
      yellow: string;
      green: string;
    };
    confidence: string;
    score: string;
    recommendedAction: string;
    detectedPatterns: string;
    viewQueue: string;
    flags: {
      shimmerHigh: string;
      pauseRatioHigh: string;
      jitterHigh: string;
      hnrLow: string;
      speechRateLow: string;
      voiceBreaks: string;
      noIssues: string;
      allNormal: string;
    };
    explanations: {
      red: string;
      yellow: string;
      green: string;
    };
    clinicalContext: {
      jitterHigh: string;
      shimmerHigh: string;
      hnrLow: string;
      speechRateLow: string;
      pauseRatioHigh: string;
      voiceBreaks: string;
    };
  };

  features: {
    jitter: string;
    shimmer: string;
    hnr: string;
    speechRate: string;
    pauseRatio: string;
    voiceBreaks: string;
    meanIntensity: string;
    explanations: {
      jitter: string;
      shimmer: string;
      hnr: string;
      speechRate: string;
      pauseRatio: string;
      voiceBreaks: string;
    };
  };

  questionnaire: {
    title: string;
    age: {
      question: string;
      hint: string;
      under40: string;
      '40-55': string;
      '55-70': string;
      over70: string;
    };
    conditions: {
      question: string;
      hint: string;
      hypertension: string;
      diabetes: string;
      heartDisease: string;
      previousStroke: string;
      familyHistory: string;
      noneSelected: string;
    };
    health: {
      question: string;
      hint: string;
      healthy: string;
      coldFlu: string;
      tired: string;
      unwellOther: string;
    };
    lifestyle: {
      question: string;
      hint: string;
      smoker: string;
      highStress: string;
      poorDiet: string;
      noneSelected: string;
    };
    checkup: {
      question: string;
      hint: string;
      within6Months: string;
      '6to12Months': string;
      over1Year: string;
      never: string;
    };
    suddenEvents: {
      question: string;
      hint: string;
      sudden_weakness: string;
      sudden_confusion: string;
      sudden_headache: string;
      no_sudden_event: string;
      noneSelected: string;
      warningMessage: string;
    };
    continueToRecording: string;
    skipQuestionnaire: string;
  };

  check: {
    title: string;
    questionnaireDescription: string;
    recordingDescription: string;
    analyzing: {
      title: string;
      extractingFeatures: string;
      analyzingPatterns: string;
      combiningBackground: string;
      calculatingTriage: string;
      timeEstimate: string;
    };
    error: {
      title: string;
      troubleshooting: string;
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      tryAgain: string;
    };
    progress: {
      questions: string;
      record: string;
      analyze: string;
      result: string;
    };
    healthBackground: string;
    riskLevel: string;
    confoundingNote: string;
    completedIn: string;
  };

  medical: {
    disclaimer: {
      title: string;
      text: string;
      emergency: string;
    };
    emergencyNumbers: {
      label: string;
      numbers: string;
    };
  };

  quality: {
    snrGood: string;
    snrAcceptable: string;
    snrPoor: string;
    vadSufficient: string;
    vadMarginal: string;
    vadInsufficient: string;
    combinedWarning: string;
  };

  wer: {
    normal: string;
    mild: string;
    moderate: string;
    severe: string;
  };

  report: {
    title: string;
    date: string;
    triageLevel: string;
    score: string;
    confidence: string;
    message: string;
    action: string;
    patterns: string;
    features: string;
    disclaimer: string;
    generatedBy: string;
  };

  queue: {
    title: string;
    subtitle: string;
    overview: string;
    patients: string;
    refresh: string;
    exportCsv: string;
    newCheck: string;
    failedToLoad: string;
    loading: string;
    autoRefresh: string;
    status: {
      pending: string;
      reviewing: string;
      completed: string;
      referred: string;
    };
    priority: string;
    actions: {
      startReview: string;
      complete: string;
      refer: string;
      remove: string;
      details: string;
      less: string;
    };
    assessment: string;
    flagsDetected: string;
    transcription: string;
    acousticFeatures: string;
    notes: string;
    confidenceLabel: string;
    reviewedBy: string;
    referredTo: string;
  };
}
