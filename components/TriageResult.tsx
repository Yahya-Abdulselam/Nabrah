'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  ClipboardList,
  Check,
  Loader2
} from 'lucide-react';
import { TriageResult as TriageData, getTriageColors } from '@/lib/triageLogic';
import { FeatureDashboard } from './FeatureDashboard';
import { EnhancedFeatureDashboard } from './EnhancedFeatureDashboard';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addPatientToQueue } from '@/lib/queueApi';
import { WERResult } from '@/lib/werCalculator';
import { AgreementScore } from '@/lib/agreementScore';
import { QuestionnaireResult } from '@/lib/questionnaireLogic';
import { useLanguage } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';

interface WhisperData {
  transcription: string;
  avg_logprob: number;
  confidence_score: number;
  no_speech_prob: number;
}

interface TriageResultProps {
  data: TriageData;
  whisper?: WhisperData;
  wer?: WERResult;
  agreement?: AgreementScore;
  questionnaireResult?: QuestionnaireResult;
}

/**
 * Get bilingual feature labels for Arabic
 * Shows both English and Arabic: "Jitter (الارتعاش)"
 */
function getFeatureLabel(key: string, language: Language): string {
  if (language === 'ar') {
    const bilingualLabels: Record<string, string> = {
      jitter_local: 'Jitter (الارتعاش)',
      shimmer_dda: 'Shimmer (الرجفان)',
      hnr: 'HNR (نسبة التوافقيات إلى الضوضاء)',
      speech_rate: 'Speech Rate (سرعة الكلام)',
      pause_ratio: 'Pause Ratio (نسبة التوقف)',
      voice_breaks: 'Voice Breaks (انقطاعات الصوت)',
      mean_intensity: 'Mean Intensity (شدة الصوت)',
    };
    return bilingualLabels[key] || key;
  }
  // English: just the formatted term
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Feature explanations for non-technical users in selected language
 */
const featureExplanations = {
  en: {
    jitter: "Voice steadiness: How consistent your vocal cords vibrate",
    shimmer: "Voice strength: How stable your voice volume is",
    hnr: "Voice clarity: Ratio of clear voice sound to background noise",
    speechRate: "Speaking speed: How many syllables you say per second",
    pauseRatio: "Breathing patterns: Percentage of silence during speaking",
    voiceBreaks: "Voice interruptions: Times when your voice stopped unexpectedly",
    meanIntensity: "Voice loudness: Average volume of your voice"
  },
  ar: {
    jitter: "ثبات الصوت: مدى انتظام اهتزاز الأحبال الصوتية",
    shimmer: "قوة الصوت: مدى استقرار مستوى صوتك",
    hnr: "وضوح الصوت: نسبة الصوت النقي إلى الضوضاء الخلفية",
    speechRate: "سرعة الكلام: عدد المقاطع التي تنطقها في الثانية",
    pauseRatio: "أنماط التنفس: نسبة الصمت أثناء الكلام",
    voiceBreaks: "انقطاعات الصوت: عدد المرات التي توقف فيها صوتك فجأة",
    meanIntensity: "قوة الصوت: متوسط مستوى صوتك"
  }
};

/**
 * Triage level explanations for non-technical users
 */
const triageLevelExplanations = {
  en: {
    RED: "Your voice shows significant changes that need immediate medical attention. This could indicate a serious condition affecting your speech or breathing.",
    YELLOW: "Your voice shows some concerning patterns. While not an emergency, you should see a doctor soon to evaluate these changes.",
    GREEN: "Your voice patterns appear normal. No urgent medical concerns detected at this time."
  },
  ar: {
    RED: "يُظهر صوتك تغيرات كبيرة تحتاج إلى رعاية طبية فورية. قد يشير هذا إلى حالة خطيرة تؤثر على نطقك أو تنفسك.",
    YELLOW: "يُظهر صوتك بعض الأنماط المثيرة للقلق. على الرغم من أنها ليست حالة طوارئ، يجب عليك زيارة الطبيب قريباً لتقييم هذه التغييرات.",
    GREEN: "تبدو أنماط صوتك طبيعية. لم يتم اكتشاف مخاوف طبية عاجلة في هذا الوقت."
  }
};

export function TriageResult({ data, whisper, wer, agreement, questionnaireResult }: TriageResultProps) {
  const { t, language } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [addedToQueue, setAddedToQueue] = useState<string | null>(null);
  const router = useRouter();

  const colors = getTriageColors(data.level);

  const icons = {
    RED: <AlertCircle className="h-20 w-20" />,
    YELLOW: <AlertTriangle className="h-20 w-20" />,
    GREEN: <CheckCircle className="h-20 w-20" />
  };

  const handleNewCheck = () => {
    // Force full page reload to reset all state
    window.location.href = '/check';
  };

  const handleAddToQueue = async () => {
    if (addedToQueue) return; // Already added

    setAddingToQueue(true);
    try {
      // Convert whisper data to include required fields
      const whisperData = whisper ? {
        ...whisper,
        language: 'en',
        duration_s: 5
      } : undefined;

      const response = await addPatientToQueue({
        triage: data,
        quality: data.quality,
        whisper: whisperData,
        wer: wer,
        agreement: agreement,
        features: data.features as unknown as Record<string, number>
      });
      setAddedToQueue(response.patient_id);
    } catch (error) {
      console.error('Failed to add to queue:', error);
      alert('Failed to add to queue. Please try again.');
    } finally {
      setAddingToQueue(false);
    }
  };

  const handleDownload = () => {
    // Create a formatted bilingual report
    const reportTitle = language === 'ar' ? 'تقرير فحص نبرة الصوتي' : 'NABRAH VOICE TRIAGE REPORT';
    const separator = language === 'ar' ? '=========================' : '==========================';

    const report = language === 'ar' ? `
${reportTitle}
${separator}

التاريخ: ${new Date(data.timestamp).toLocaleString('ar')}

مستوى التصنيف: ${data.level}
النتيجة: ${data.score}/20
درجة الثقة: ${data.confidence}%

الرسالة: ${data.message}

الإجراء الموصى به:
${data.action}

الأنماط المكتشفة:
${data.flags.map((flag, idx) => `${idx + 1}. ${flag}`).join('\n')}

الخصائص الصوتية:
- ${getFeatureLabel('jitter_local', language)}: ${data.features.jitter_local.toFixed(2)}%
  ${featureExplanations[language].jitter}

- ${getFeatureLabel('shimmer_dda', language)}: ${data.features.shimmer_dda.toFixed(2)}%
  ${featureExplanations[language].shimmer}

- ${getFeatureLabel('hnr', language)}: ${data.features.hnr.toFixed(2)} dB
  ${featureExplanations[language].hnr}

- ${getFeatureLabel('speech_rate', language)}: ${data.features.speech_rate.toFixed(2)} مقطع/ثانية
  ${featureExplanations[language].speechRate}

- ${getFeatureLabel('pause_ratio', language)}: ${data.features.pause_ratio.toFixed(2)}%
  ${featureExplanations[language].pauseRatio}

- ${getFeatureLabel('voice_breaks', language)}: ${data.features.voice_breaks}
  ${featureExplanations[language].voiceBreaks}

- ${getFeatureLabel('mean_intensity', language)}: ${data.features.mean_intensity.toFixed(2)} dB
  ${featureExplanations[language].meanIntensity}

ماذا يعني هذا:
${triageLevelExplanations[language][data.level]}

إخلاء المسؤولية الطبية:
هذه الأداة تدعم قرارات الفرز الطبي. لا تحل محل التشخيص الطبي المهني أو العلاج.
اطلب دائماً الرعاية الطبية الفورية في حالة الطوارئ.

---
تم الإنشاء بواسطة نبرة © 2026
    `.trim() : `
${reportTitle}
${separator}

Date: ${new Date(data.timestamp).toLocaleString()}

TRIAGE LEVEL: ${data.level}
Score: ${data.score}/20
Confidence: ${data.confidence}%

MESSAGE: ${data.message}

RECOMMENDED ACTION:
${data.action}

DETECTED PATTERNS:
${data.flags.map((flag, idx) => `${idx + 1}. ${flag}`).join('\n')}

ACOUSTIC FEATURES:
- ${getFeatureLabel('jitter_local', language)}: ${data.features.jitter_local.toFixed(2)}%
  ${featureExplanations[language].jitter}

- ${getFeatureLabel('shimmer_dda', language)}: ${data.features.shimmer_dda.toFixed(2)}%
  ${featureExplanations[language].shimmer}

- ${getFeatureLabel('hnr', language)}: ${data.features.hnr.toFixed(2)} dB
  ${featureExplanations[language].hnr}

- ${getFeatureLabel('speech_rate', language)}: ${data.features.speech_rate.toFixed(2)} syllables/second
  ${featureExplanations[language].speechRate}

- ${getFeatureLabel('pause_ratio', language)}: ${data.features.pause_ratio.toFixed(2)}%
  ${featureExplanations[language].pauseRatio}

- ${getFeatureLabel('voice_breaks', language)}: ${data.features.voice_breaks}
  ${featureExplanations[language].voiceBreaks}

- ${getFeatureLabel('mean_intensity', language)}: ${data.features.mean_intensity.toFixed(2)} dB
  ${featureExplanations[language].meanIntensity}

WHAT THIS MEANS:
${triageLevelExplanations[language][data.level]}

MEDICAL DISCLAIMER:
This tool supports triage decisions. It does not replace professional medical diagnosis or treatment.
Always seek immediate medical attention in case of emergency.

---
Generated by Nabrah © 2026
    `.trim();

    // Create and download text file
    const blob = new Blob([report], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nabrah-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-3xl mx-auto"
    >
      <Card className={`p-8 border-4 ${colors.border} bg-slate-800 dark:bg-slate-900`}>
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className={`flex justify-center mb-6 ${colors.icon}`}
        >
          {icons[data.level]}
        </motion.div>

        {/* Triage Level */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl md:text-6xl font-bold text-center mb-4 text-white"
        >
          {data.level}
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl md:text-2xl font-semibold text-center mb-6 text-white"
        >
          {data.message}
        </motion.p>

        {/* Confidence Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center mb-6"
        >
          <Badge className={`text-lg px-6 py-2 ${colors.badge} bg-white/10 text-white border-white/20`}>
            {data.confidence}% Confidence
          </Badge>
        </motion.div>

        {/* Quality Warnings */}
        {data.qualityWarnings && data.qualityWarnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mb-6"
          >
            {data.qualityWarnings.map((warning, idx) => (
              <div
                key={idx}
                className={`
                  flex items-center gap-3 p-3 rounded-lg mb-2
                  ${warning.severity === 'error'
                    ? 'bg-red-100 border border-red-300'
                    : warning.severity === 'warning'
                      ? 'bg-yellow-100 border border-yellow-300'
                      : 'bg-blue-100 border border-blue-300'
                  }
                `}
              >
                {warning.severity === 'error' ? (
                  <VolumeX className="h-5 w-5 text-red-600 flex-shrink-0" />
                ) : (
                  <Volume2 className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                )}
                <p className={`text-sm ${
                  warning.severity === 'error'
                    ? 'text-red-800'
                    : warning.severity === 'warning'
                      ? 'text-yellow-800'
                      : 'text-blue-800'
                }`}>
                  {warning.message}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Audio Quality Info */}
        {data.quality && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.58 }}
            className="flex justify-center gap-4 mb-6"
          >
            <Badge variant="outline" className="text-sm bg-white/10 text-white border-white/20">
              SNR: {data.quality.snr_db} dB
            </Badge>
            <Badge variant="outline" className="text-sm bg-white/10 text-white border-white/20">
              Speech: {data.quality.speech_percentage}%
            </Badge>
          </motion.div>
        )}

        {/* Questionnaire Risk Summary */}
        {questionnaireResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.58 }}
            className="bg-slate-700 dark:bg-slate-800 rounded-lg p-4 mb-4 border border-slate-600"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Health Background Risk</span>
              <span className={`text-sm font-semibold ${
                questionnaireResult.riskLevel === 'high'
                  ? 'text-red-400'
                  : questionnaireResult.riskLevel === 'moderate'
                    ? 'text-yellow-400'
                    : 'text-green-400'
              }`}>
                {questionnaireResult.riskLevel.charAt(0).toUpperCase() +
                  questionnaireResult.riskLevel.slice(1)} ({questionnaireResult.totalScore ?? 0} pts)
              </span>
            </div>
            {questionnaireResult.riskFactors.length > 0 && (
              <div className="text-xs text-slate-400">
                Risk factors: {questionnaireResult.riskFactors.slice(0, 3).join(', ')}
                {questionnaireResult.riskFactors.length > 3 && ` +${questionnaireResult.riskFactors.length - 3} more`}
              </div>
            )}
            {questionnaireResult.hasConfoundingFactors && (
              <div className="text-xs text-yellow-400 mt-1">
                Note: Current health status may affect voice analysis accuracy
              </div>
            )}
          </motion.div>
        )}

        {/* Score Display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-700 dark:bg-slate-800 rounded-lg p-4 mb-6 text-center border border-slate-600"
        >
          <p className="text-sm text-slate-300 mb-1">Triage Score</p>
          <p className="text-3xl font-bold text-white">{data.score} / 20</p>
          {questionnaireResult && (
            <p className="text-xs text-slate-400 mt-1">
              Combined: Voice ({data.score}) + Background ({questionnaireResult.totalScore}) = {data.score + questionnaireResult.totalScore}
            </p>
          )}
        </motion.div>

        {/* Action Required */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-slate-700 dark:bg-slate-800 rounded-lg p-6 mb-6 border-2 border-slate-600"
        >
          <h3 className="font-semibold text-white mb-2 text-lg">
            📋 {t('triage.recommendedAction')}
          </h3>
          <p className="text-slate-200 leading-relaxed">{data.action}</p>
        </motion.div>

        {/* What This Means - Layman Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className={`rounded-lg p-6 mb-6 border-2 ${
            data.level === 'RED'
              ? 'bg-red-900/30 border-red-600'
              : data.level === 'YELLOW'
                ? 'bg-yellow-900/30 border-yellow-600'
                : 'bg-green-900/30 border-green-600'
          }`}
        >
          <h3 className={`font-semibold mb-2 text-lg ${
            data.level === 'RED'
              ? 'text-red-50'
              : data.level === 'YELLOW'
                ? 'text-yellow-50'
                : 'text-green-50'
          }`}>
            💡 {language === 'ar' ? 'ماذا يعني هذا' : 'What This Means'}
          </h3>
          <p className={`leading-relaxed ${
            data.level === 'RED'
              ? 'text-red-100'
              : data.level === 'YELLOW'
                ? 'text-yellow-100'
                : 'text-green-100'
          } ${language === 'ar' ? 'font-arabic' : ''}`}>
            {triageLevelExplanations[language][data.level]}
          </p>
        </motion.div>

        {/* Detected Issues */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-6"
        >
          <h3 className="font-semibold text-white mb-3 text-lg">
            🔍 Detected Patterns:
          </h3>
          <ul className="space-y-2">
            {data.flags.map((flag, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + idx * 0.1 }}
                className="flex items-start gap-3 bg-slate-700 dark:bg-slate-800 rounded-lg p-3 border border-slate-600"
              >
                <span className="text-slate-300 font-medium">•</span>
                <span className="text-slate-200 flex-1">{flag}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Toggle Technical Details */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <Button
            variant="outline"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full mb-4 bg-slate-700 dark:bg-slate-800 hover:bg-slate-600 dark:hover:bg-slate-700 text-white border-slate-600"
          >
            {showDetails ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Hide Technical Details
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show Technical Details
              </>
            )}
          </Button>

          {/* Feature Dashboard */}
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              {(whisper || wer || agreement || data.quality) ? (
                <EnhancedFeatureDashboard
                  features={data.features}
                  quality={data.quality}
                  whisper={whisper}
                  wer={wer}
                  agreement={agreement}
                />
              ) : (
                <FeatureDashboard features={data.features} />
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col md:flex-row gap-4"
        >
          <Button
            variant="outline"
            onClick={handleDownload}
            className="flex-1 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border-slate-600"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button
            variant="outline"
            onClick={handleAddToQueue}
            disabled={addingToQueue || !!addedToQueue}
            className={`flex-1 ${addedToQueue ? 'bg-green-900/30 border-green-600 text-green-300' : 'bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border-slate-600'}`}
          >
            {addingToQueue ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : addedToQueue ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Added ({addedToQueue})
              </>
            ) : (
              <>
                <ClipboardList className="mr-2 h-4 w-4" />
                Add to Queue
              </>
            )}
          </Button>
          <Button
            onClick={handleNewCheck}
            className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            New Check
          </Button>
        </motion.div>

        {/* Queue link */}
        {addedToQueue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-center"
          >
            <Button
              variant="link"
              onClick={() => router.push('/queue')}
              className="text-blue-600 dark:text-blue-400"
            >
              View Patient Queue →
            </Button>
          </motion.div>
        )}
      </Card>

      {/* Medical Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Medical Disclaimer</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              This tool supports triage decisions and does not replace professional medical
              diagnosis or treatment. Always seek immediate medical attention in case of
              emergency. If you are experiencing a life-threatening emergency, call your
              local emergency services (911/999) immediately.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
