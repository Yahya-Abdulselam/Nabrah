'use client';

import { useState } from 'react';
import { AudioRecorder } from '@/components/AudioRecorder';
import { PreScreeningQuestionnaire } from '@/components/PreScreeningQuestionnaire';
import { TriageResultEnhanced } from '@/components/TriageResultEnhanced';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TriageResult } from '@/lib/triageLogic';
import { WERResult } from '@/lib/werCalculator';
import { AgreementScore } from '@/lib/agreementScore';
import {
  QuestionnaireAnswers,
  QuestionnaireResult,
  calculateQuestionnaireScore
} from '@/lib/questionnaireLogic';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';

interface WhisperData {
  transcription: string;
  avg_logprob: number;
  confidence_score: number;
  no_speech_prob: number;
}

type ViewState = 'questionnaire' | 'recording' | 'analyzing' | 'result' | 'error';

export default function CheckPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [viewState, setViewState] = useState<ViewState>('questionnaire');
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers | null>(null);
  const [questionnaireResult, setQuestionnaireResult] = useState<QuestionnaireResult | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [whisperData, setWhisperData] = useState<WhisperData | null>(null);
  const [werResult, setWerResult] = useState<WERResult | null>(null);
  const [agreementScore, setAgreementScore] = useState<AgreementScore | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [isOfflineAnalysis, setIsOfflineAnalysis] = useState<boolean>(false);
  const [recordingId, setRecordingId] = useState<string | undefined>(undefined);
  const [triageResultId, setTriageResultId] = useState<string | undefined>(undefined);

  const handleQuestionnaireComplete = (answers: QuestionnaireAnswers) => {
    const result = calculateQuestionnaireScore(answers);
    setQuestionnaireAnswers(answers);
    setQuestionnaireResult(result);
    setViewState('recording');
  };

  const handleQuestionnaireSkip = () => {
    // Skip questionnaire - use null for questionnaire data
    setQuestionnaireAnswers(null);
    setQuestionnaireResult(null);
    setViewState('recording');
  };

  const handleOfflineAnalysisComplete = (result: any) => {
    console.log('[CheckPage] Offline analysis complete:', result);

    // Set offline analysis results
    setTriageResult(result);
    setIsOfflineAnalysis(true);
    setRecordingId(result.recordingId);
    setTriageResultId(result.triageResultId);
    setWhisperData(null); // No Whisper in offline mode
    setWerResult(null);
    setAgreementScore(null);
    setProcessingTime(0); // Offline analysis doesn't track backend time
    setViewState('result');
  };

  const handleRecordingComplete = async (audioBlob: Blob, language: 'en' | 'ar') => {
    setViewState('analyzing');
    setErrorMessage('');
    setIsOfflineAnalysis(false);

    try {
      // Create FormData with audio file and language
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('language', language);

      // Include questionnaire data if available
      if (questionnaireResult && questionnaireAnswers) {
        formData.append('questionnaire_score', questionnaireResult.totalScore.toString());
        formData.append('questionnaire_risk', questionnaireResult.riskLevel);
        formData.append('has_confounding', questionnaireResult.hasConfoundingFactors.toString());
        formData.append('confidence_modifier', questionnaireResult.confidenceModifier.toString());
        // Include sudden events for stroke warning detection
        if (questionnaireAnswers.suddenEvents && questionnaireAnswers.suddenEvents.length > 0) {
          formData.append('sudden_events', JSON.stringify(questionnaireAnswers.suddenEvents));
        }
      }

      console.log('Sending audio for analysis...', 'Language:', language);

      // Send to API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Handle backend unavailable (503) - trigger offline fallback
        if (response.status === 503) {
          throw new Error('Backend unavailable: ' + (data.error || 'Cannot connect to backend'));
        }

        // Handle quality check failure (422) specially
        if (response.status === 422 && data.status === 'quality_check_failed') {
          const qualityIssues = data.warnings?.map((w: any) => w.message).join(' ') || data.message;
          throw new Error(`Recording quality issue: ${qualityIssues}\n\nPlease try recording again in a quieter environment, speaking clearly during the entire recording.`);
        }
        throw new Error(data.error || data.message || 'Analysis failed');
      }

      console.log('Analysis complete:', data);

      // Set results
      setTriageResult(data.triage);
      setWhisperData(data.whisper || null);
      setWerResult(data.wer || null);
      setAgreementScore(data.agreement || null);
      setProcessingTime(data.processing_time_ms);
      setViewState('result');

    } catch (error) {
      console.error('Analysis error:', error);

      // Check if it's a network/connection error (backend unavailable)
      const isNetworkError = error instanceof TypeError ||
        (error instanceof Error && (
          error.message.includes('Backend unavailable') ||
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('connect') ||
          error.message.includes('ECONNREFUSED')
        ));

      // If it's a network error, fallback to offline analysis
      if (isNetworkError) {
        console.log('[CheckPage] Backend unreachable, falling back to offline analysis...');
        try {
          const { analyzeOffline } = await import('@/lib/analysis/offlineAnalyzer');
          const offlineResult = await analyzeOffline(audioBlob, language, questionnaireAnswers || undefined);

          // Set offline analysis results
          setTriageResult(offlineResult.triageResult);
          setIsOfflineAnalysis(true);
          setRecordingId(offlineResult.recordingId);
          setTriageResultId(offlineResult.triageResultId);
          setWhisperData(null);
          setWerResult(null);
          setAgreementScore(null);
          setProcessingTime(0);
          setViewState('result');
          return; // Success - don't show error
        } catch (offlineError) {
          console.error('[CheckPage] Offline analysis also failed:', offlineError);
          setErrorMessage('Both online and offline analysis failed. Please try again.');
          setViewState('error');
          return;
        }
      }

      // For other errors (quality check, etc), show the error normally
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unexpected error occurred during analysis');
      }

      setViewState('error');
    }
  };

  const handleRetry = () => {
    setViewState('questionnaire');
    setQuestionnaireAnswers(null);
    setQuestionnaireResult(null);
    setTriageResult(null);
    setWhisperData(null);
    setWerResult(null);
    setAgreementScore(null);
    setErrorMessage('');
    setProcessingTime(0);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  // Get step labels for progress indicator
  const getStepLabel = () => {
    switch (viewState) {
      case 'questionnaire': return 'Questions';
      case 'recording': return 'Record';
      case 'analyzing': return 'Analyze';
      case 'result': return 'Result';
      default: return '';
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Top Bar with Theme Toggle and Language Switcher */}
      <div className="fixed z-50 flex gap-2 ltr-force" style={{ top: '1rem', right: '1rem' }}>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={handleBackToHome}
            className="mb-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t('check.backToHome')}
          </Button>

          <h1 className={`text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2 ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('check.title')}
          </h1>
          <p className={`text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
            {viewState === 'questionnaire'
              ? t('check.questionnaireSubtitle')
              : t('check.recordingSubtitle')}
          </p>
        </motion.div>

        {/* Content Area */}
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Questionnaire State */}
            {viewState === 'questionnaire' && (
              <motion.div
                key="questionnaire"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <PreScreeningQuestionnaire
                  onComplete={handleQuestionnaireComplete}
                  onSkip={handleQuestionnaireSkip}
                />
              </motion.div>
            )}

            {/* Recording State */}
            {viewState === 'recording' && (
              <motion.div
                key="recording"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {/* Show questionnaire summary if completed */}
                {questionnaireResult && (
                  <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                        {t('check.healthBackground')}
                      </span>
                      <span className={`text-sm font-medium ${language === 'ar' ? 'font-arabic' : ''} ${
                        questionnaireResult.riskLevel === 'high'
                          ? 'text-red-600 dark:text-red-400'
                          : questionnaireResult.riskLevel === 'moderate'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                      }`}>
                        {questionnaireResult.riskLevel.charAt(0).toUpperCase() +
                          questionnaireResult.riskLevel.slice(1)} {t('check.riskLevel')}
                        ({questionnaireResult.totalScore ?? 0} pts)
                      </span>
                    </div>
                    {questionnaireResult.hasConfoundingFactors && (
                      <p className={`text-xs text-yellow-600 dark:text-yellow-400 mt-2 ${language === 'ar' ? 'font-arabic' : ''}`}>
                        {t('check.confoundingNote')}
                      </p>
                    )}
                  </div>
                )}
                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  onOfflineAnalysisComplete={handleOfflineAnalysisComplete}
                />
              </motion.div>
            )}

            {/* Analyzing State */}
            {viewState === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-slate-900/50 p-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="inline-block mb-6"
                >
                  <Loader2 className="h-16 w-16 text-indigo-600 dark:text-indigo-400" />
                </motion.div>

                <h2 className={`text-2xl font-semibold text-slate-900 dark:text-white mb-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('check.analyzing.title')}
                </h2>

                <div className={`space-y-2 text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {t('check.analyzing.extractingFeatures')}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.0 }}
                  >
                    {t('check.analyzing.analyzingPatterns')}
                  </motion.p>
                  {questionnaireResult && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 }}
                    >
                      {t('check.analyzing.combiningBackground')}
                    </motion.p>
                  )}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: questionnaireResult ? 2.0 : 1.5 }}
                  >
                    {t('check.analyzing.calculatingTriage')}
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5 }}
                  className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700"
                >
                  <p className={`text-sm text-slate-500 dark:text-slate-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('check.analyzing.timeEstimate')}
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* Result State */}
            {viewState === 'result' && triageResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {!isOfflineAnalysis && processingTime > 0 && (
                  <div className={`mb-4 text-center text-sm text-slate-500 dark:text-slate-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('check.completedIn')} {processingTime}ms
                  </div>
                )}
                <TriageResultEnhanced
                  data={triageResult}
                  whisper={whisperData || undefined}
                  wer={werResult || undefined}
                  agreement={agreementScore || undefined}
                  questionnaireResult={questionnaireResult || undefined}
                  isOfflineAnalysis={isOfflineAnalysis}
                  recordingId={recordingId}
                  triageResultId={triageResultId}
                />
              </motion.div>
            )}

            {/* Error State */}
            {viewState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-slate-900/50 p-12 text-center"
              >
                <AlertCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-6" />

                <h2 className={`text-2xl font-semibold text-slate-900 dark:text-white mb-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('check.error.title')}
                </h2>

                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
                  <p className={`text-red-800 dark:text-red-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {errorMessage}
                  </p>
                </div>

                <div className={`space-y-3 text-left text-sm text-slate-600 dark:text-slate-300 mb-8 ${language === 'ar' ? 'font-arabic' : ''} ${language === 'ar' ? 'text-right' : ''}`}>
                  <p className="font-semibold">{t('check.error.troubleshooting')}</p>
                  <ul className={`list-disc space-y-1 ${language === 'ar' ? 'mr-4 list-inside' : 'ml-4 list-inside'}`}>
                    <li>{t('check.error.step1')}</li>
                    <li>{t('check.error.step2')}</li>
                    <li>{t('check.error.step3')}</li>
                    <li>{t('check.error.step4')}</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={handleBackToHome}
                    className="flex-1 cursor-pointer"
                  >
                    <ArrowLeft className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                    {t('check.error.backToHome')}
                  </Button>
                  <Button
                    onClick={handleRetry}
                    className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {t('check.error.tryAgain')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 max-w-3xl mx-auto"
        >
          <div className="flex justify-center items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${viewState === 'questionnaire' ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <div className={`h-2 w-8 rounded-full ${viewState === 'recording' ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <div className={`h-2 w-8 rounded-full ${viewState === 'analyzing' ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <div className={`h-2 w-2 rounded-full ${viewState === 'result' ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
          </div>
          <div className={`flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 px-1 ${language === 'ar' ? 'font-arabic' : ''}`}>
            <span>{t('check.progress.questions')}</span>
            <span>{t('check.progress.record')}</span>
            <span>{t('check.progress.analyze')}</span>
            <span>{t('check.progress.result')}</span>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
