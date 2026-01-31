import { NextRequest, NextResponse } from 'next/server';
import {
  calculateTriage,
  AudioFeatures,
  AudioQuality,
  getQualityWarnings,
  TriageResult
} from '@/lib/triageLogic';
import { calculateWER, WERResult } from '@/lib/werCalculator';
import { Language } from '@/lib/i18n/types';
import { getSNRConfidenceModifier } from '@/lib/snrAdaptation';
import {
  calculateAgreement,
  assessPraatMethod,
  assessWhisperConfidence,
  assessWER,
  assessQuality,
  AgreementScore,
  MethodAssessment
} from '@/lib/agreementScore';

interface WhisperResult {
  transcription: string;
  avg_logprob: number;
  no_speech_prob: number;
  confidence_score: number;
  language: string;
  duration_s: number;
  processing_time_ms: number;
}

interface QuestionnaireData {
  score: number;
  riskLevel: string;
  hasConfounding: boolean;
  confidenceModifier: number;
  suddenEvents?: string[];  // NEW: Stroke warning signs from questionnaire
}

interface EnhancedTriageResult extends TriageResult {
  whisper?: WhisperResult;
  wer?: WERResult;
  agreement?: AgreementScore;
  questionnaireScore?: number;
  scoreBreakdown?: {
    praatScore: number;
    whisperScore: number;
    werScore: number;
    questionnaireScore: number;
  };
}

/**
 * POST /api/analyze
 *
 * Enhanced audio analysis with parallel Praat and Whisper processing
 *
 * Workflow:
 * 1. Receive audio file from client
 * 2. Forward to Python backend for Praat + Whisper analysis (parallel)
 * 3. Calculate WER from Whisper transcription
 * 4. Calculate agreement score across all methods
 * 5. Apply enhanced triage logic with multi-method scoring
 * 6. Return complete triage result
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = (formData.get('language') as Language) || 'en';

    // Validate language
    if (language !== 'en' && language !== 'ar') {
      return NextResponse.json(
        { success: false, error: 'Invalid language parameter. Must be "en" or "ar"' },
        { status: 400 }
      );
    }

    console.log('[API] Language:', language);

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'Audio file too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Extract questionnaire data if provided
    const questionnaireScore = formData.get('questionnaire_score');
    const questionnaireRisk = formData.get('questionnaire_risk');
    const hasConfounding = formData.get('has_confounding');
    const confidenceModifier = formData.get('confidence_modifier');
    const suddenEventsRaw = formData.get('sudden_events');

    const questionnaireData: QuestionnaireData | null = questionnaireScore ? {
      score: parseInt(questionnaireScore as string, 10),
      riskLevel: questionnaireRisk as string || 'low',
      hasConfounding: hasConfounding === 'true',
      confidenceModifier: parseFloat(confidenceModifier as string) || 1.0,
      suddenEvents: suddenEventsRaw ? JSON.parse(suddenEventsRaw as string) : undefined
    } : null;

    if (questionnaireData) {
      console.log('[API] Questionnaire data:', questionnaireData);
    }

    const pythonBackendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Create FormData for both endpoints
    const praatFormData = new FormData();
    praatFormData.append('file', audioFile);

    // Need to create a new blob for whisper since FormData consumes the file
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioBlob, audioFile.name);

    console.log('[API] Starting parallel analysis (Praat + Whisper)...');

    // Build Whisper URL with language parameter
    const whisperUrl = new URL(`${pythonBackendUrl}/analyze/whisper`);
    whisperUrl.searchParams.set('language', language);

    // Create timeout controllers for each request (30s timeout)
    const praatController = new AbortController();
    const whisperController = new AbortController();
    const praatTimeout = setTimeout(() => praatController.abort(), 30000); // 30s
    const whisperTimeout = setTimeout(() => whisperController.abort(), 30000); // 30s

    // Make parallel requests to Praat and Whisper endpoints with timeouts
    let praatResponse, whisperResponse;
    try {
      [praatResponse, whisperResponse] = await Promise.allSettled([
        fetch(`${pythonBackendUrl}/analyze`, {
          method: 'POST',
          body: praatFormData,
          signal: praatController.signal,
        }),
        fetch(whisperUrl.toString(), {
          method: 'POST',
          body: whisperFormData,
          signal: whisperController.signal,
        })
      ]);
    } finally {
      // Always clear timeouts
      clearTimeout(praatTimeout);
      clearTimeout(whisperTimeout);
    }

    // Process Praat response (required)
    if (praatResponse.status === 'rejected') {
      console.error('[API] Praat request failed:', praatResponse.reason);
      return NextResponse.json(
        { success: false, error: 'Cannot connect to audio analysis backend' },
        { status: 503 }
      );
    }

    const praatRes = praatResponse.value;
    if (!praatRes.ok) {
      const errorData = await praatRes.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { success: false, error: `Audio analysis failed: ${errorData.detail}` },
        { status: praatRes.status }
      );
    }

    const praatData = await praatRes.json();
    const features: AudioFeatures = praatData.features;
    const quality: AudioQuality | undefined = praatData.quality;

    console.log('[API] Praat features extracted:', features);

    // Process Whisper response (optional - graceful degradation)
    let whisperData: WhisperResult | null = null;
    let werResult: WERResult | null = null;

    if (whisperResponse.status === 'fulfilled' && whisperResponse.value.ok) {
      try {
        whisperData = await whisperResponse.value.json();
        console.log('[API] Whisper transcription:', whisperData?.transcription?.slice(0, 50));

        // Calculate WER from transcription with language-specific prompt
        if (whisperData?.transcription) {
          werResult = calculateWER(whisperData.transcription, language);
          console.log('[API] WER calculated:', werResult.wer, werResult.severity);
        }
      } catch (e) {
        console.warn('[API] Whisper response parsing failed:', e);
      }
    } else {
      console.warn('[API] Whisper analysis unavailable - continuing with Praat only');
    }

    // Calculate base triage from Praat features with language-specific thresholds
    // Pass SNR, Whisper confidence, and WER accuracy for quality-aware scoring
    const snr_db = quality?.snr_db;
    const whisper_confidence = whisperData?.confidence_score !== undefined ? whisperData.confidence_score : undefined;
    // Convert WER (error rate) to accuracy: accuracy = (1 - wer) * 100
    const wer_accuracy = werResult?.wer !== undefined ? (1 - werResult.wer) * 100 : undefined;

    const triageResult = calculateTriage(
      features,
      language,
      snr_db,
      whisper_confidence,
      wer_accuracy
    ) as EnhancedTriageResult;

    // Add quality data
    if (quality) {
      triageResult.quality = quality;
      triageResult.qualityWarnings = getQualityWarnings(quality);
    }

    // Quality gating - warn/block if audio quality is insufficient
    if (quality && !quality.is_reliable) {
      const warnings = [];

      if (quality.snr_db < 10) {
        warnings.push({
          type: 'SNR_TOO_LOW',
          severity: 'error',
          message: `Background noise is too high (SNR: ${quality.snr_db.toFixed(1)}dB). Please record in a quieter environment.`
        });
      }

      if (quality.speech_percentage < 20) {
        warnings.push({
          type: 'INSUFFICIENT_SPEECH',
          severity: 'error',
          message: `Not enough speech detected (${quality.speech_percentage.toFixed(1)}%). Please speak clearly during the entire recording.`
        });
      }

      // Return with quality check failure
      return NextResponse.json({
        success: false,
        status: 'quality_check_failed',
        quality,
        warnings,
        message: 'Audio quality is insufficient for reliable analysis. Please record again in a quieter environment.',
        can_retry: true
      }, { status: 422 }); // 422 Unprocessable Entity
    }

    // Build method assessments for agreement calculation
    const methodAssessments: MethodAssessment[] = [
      assessPraatMethod(triageResult.score)
    ];

    // Add Whisper assessment if available
    if (whisperData) {
      triageResult.whisper = whisperData;
      methodAssessments.push(
        assessWhisperConfidence(whisperData.avg_logprob, whisperData.confidence_score)
      );
    }

    // Add WER assessment if available
    if (werResult) {
      triageResult.wer = werResult;
      methodAssessments.push(assessWER(werResult.wer));

      // Add WER points to triage score
      if (werResult.points > 0) {
        triageResult.detailedFlags.push({
          severity: werResult.severity === 'severe' ? 'high' : 'medium',
          message: `Speech articulation: ${werResult.severity} (${Math.round(werResult.wer * 100)}% word error rate)`,
          points: werResult.points
        });
        triageResult.flags.push(
          `Word error rate: ${Math.round(werResult.wer * 100)}% (${werResult.severity})`
        );
      }
    }

    // Add quality assessment if available
    if (quality) {
      methodAssessments.push(
        assessQuality(quality.snr_db, quality.speech_percentage)
      );
    }

    // Calculate agreement score
    const agreement = calculateAgreement(methodAssessments);
    triageResult.agreement = agreement;

    // Store score breakdown
    triageResult.scoreBreakdown = {
      praatScore: triageResult.score,
      whisperScore: whisperData
        ? Math.round((whisperData.avg_logprob + 2.0) * 2.5) // 0-5 points
        : 0,
      werScore: werResult?.points || 0,
      questionnaireScore: questionnaireData?.score || 0
    };

    // Store questionnaire score on result
    if (questionnaireData) {
      triageResult.questionnaireScore = questionnaireData.score;
    }

    // Adjust confidence based on agreement
    if (agreement.consensusLevel === 'unanimous') {
      triageResult.confidence = Math.min(95, triageResult.confidence + 10);
    } else if (agreement.consensusLevel === 'conflicting') {
      triageResult.confidence = Math.max(40, triageResult.confidence - 15);
    }

    // Adjust confidence based on SNR quality (additional to base SNR adjustment in calculateTriage)
    if (snr_db !== undefined) {
      const snrModifier = getSNRConfidenceModifier(snr_db);
      // Apply additional modifier for very good or very poor quality
      if (snr_db >= 25) {
        // Pristine recording - additional boost beyond base calculation
        triageResult.confidence = Math.min(95, triageResult.confidence + 3);
      } else if (snr_db < 12 && quality?.is_reliable) {
        // Marginal quality - penalize further
        triageResult.confidence = Math.max(30, triageResult.confidence - 10);
      }
    }

    // Adjust confidence if quality is poor (blocks analysis, so this is fallback)
    if (quality && !quality.is_reliable) {
      triageResult.confidence = Math.max(30, triageResult.confidence - 20);
    }

    // Apply questionnaire confidence modifier (cold/flu reduces confidence)
    if (questionnaireData) {
      triageResult.confidence = Math.round(
        triageResult.confidence * questionnaireData.confidenceModifier
      );
      triageResult.confidence = Math.max(30, Math.min(95, triageResult.confidence));
    }

    // Recalculate triage level based on combined score (voice + questionnaire)
    const voiceScore = triageResult.score +
      (triageResult.scoreBreakdown?.whisperScore || 0) +
      (triageResult.scoreBreakdown?.werScore || 0);
    const totalScore = voiceScore + (questionnaireData?.score || 0);

    // Adjust level based on combined score (voice + questionnaire)
    // Higher thresholds to account for questionnaire points
    if (totalScore >= 18 && triageResult.level !== 'RED') {
      triageResult.level = 'RED';
      triageResult.message = 'SEEK IMMEDIATE EMERGENCY CARE';
      triageResult.action = 'Call emergency services (911/999) or go to the nearest Emergency Room immediately';
    } else if (totalScore >= 10 && triageResult.level === 'GREEN') {
      triageResult.level = 'YELLOW';
      triageResult.message = 'SCHEDULE URGENT MEDICAL EVALUATION';
      triageResult.action = 'Contact your doctor within 24-48 hours for evaluation';
    }

    // Special case: high questionnaire risk + significant voice abnormality = escalate
    // Only escalate if questionnaire score is ACTUALLY high (not just riskLevel mislabeled)
    // This prevents false escalation when questionnaire score is 0 but riskLevel is incorrectly 'high'
    if (questionnaireData?.riskLevel === 'high' &&
        (questionnaireData?.score || 0) >= 8 &&
        voiceScore >= 5 &&
        triageResult.level === 'GREEN') {
      triageResult.level = 'YELLOW';
      triageResult.message = 'FOLLOW-UP RECOMMENDED';
      triageResult.action = 'Multiple risk factors detected. Schedule a medical evaluation within the week.';
    }

    // Special case: confounding factors (cold/flu) - add context to message
    if (questionnaireData?.hasConfounding && triageResult.level !== 'RED') {
      triageResult.action += ' Note: Current health status (cold/fatigue) may affect voice analysis. Consider retesting after recovery.';
    }

    // CRITICAL: Sudden stroke warning signs + any voice abnormality
    // FAST protocol: Face, Arms, Speech, Time - act quickly
    if (questionnaireData?.suddenEvents &&
        (questionnaireData.suddenEvents.includes('sudden_weakness') ||
         questionnaireData.suddenEvents.includes('sudden_confusion')) &&
        voiceScore >= 2 && triageResult.level === 'GREEN') {
      triageResult.level = 'YELLOW';
      triageResult.message = '⚠️ STROKE WARNING SIGNS DETECTED';
      triageResult.action = 'Sudden weakness/confusion combined with speech changes detected. Seek medical evaluation immediately. If symptoms worsen, call 911/999.';
    }

    console.log('[API] Enhanced triage result:', {
      level: triageResult.level,
      voiceScore,
      questionnaireScore: questionnaireData?.score || 0,
      totalScore,
      confidence: triageResult.confidence,
      agreement: agreement.consensusLevel,
      methodsUsed: methodAssessments.length
    });

    const totalProcessingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      triage: triageResult,
      quality: quality,
      whisper: whisperData,
      wer: werResult,
      agreement: agreement,
      processing_time_ms: totalProcessingTime,
      backend_processing_time_ms: praatData.processing_time_ms,
      whisper_processing_time_ms: whisperData?.processing_time_ms
    });

  } catch (error) {
    console.error('[API] Unexpected error:', error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { success: false, error: 'Cannot connect to audio analysis backend. Please ensure the Python server is running.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error occurred during analysis' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analyze
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Nabrah Audio Analysis API',
    version: '2.0.0',
    features: [
      'Praat acoustic analysis',
      'Whisper transcription',
      'Word Error Rate (WER)',
      'Multi-method agreement scoring',
      'Audio quality metrics (SNR, VAD)'
    ],
    endpoints: {
      POST: '/api/analyze - Analyze audio file with enhanced multi-method triage'
    }
  });
}
