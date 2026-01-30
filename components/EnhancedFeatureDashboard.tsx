'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AudioLines,
  Volume2,
  MessageSquare,
  Users,
  AlertCircle,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { AudioFeatures, AudioQuality } from '@/lib/triageLogic';
import { WERResult } from '@/lib/werCalculator';
import { AgreementScore, MethodAssessment } from '@/lib/agreementScore';

interface WhisperData {
  transcription: string;
  avg_logprob: number;
  confidence_score: number;
  no_speech_prob: number;
}

interface EnhancedFeatureDashboardProps {
  features: AudioFeatures;
  quality?: AudioQuality;
  whisper?: WhisperData;
  wer?: WERResult;
  agreement?: AgreementScore;
}

export function EnhancedFeatureDashboard({
  features,
  quality,
  whisper,
  wer,
  agreement
}: EnhancedFeatureDashboardProps) {
  // Helper to calculate feature progress (0-100)
  const getFeatureProgress = (value: number, max: number, inverse: boolean = false) => {
    const percent = Math.min(100, (value / max) * 100);
    return inverse ? 100 - percent : percent;
  };

  // Get severity color
  const getSeverityColor = (value: number, thresholds: { warning: number; danger: number }) => {
    if (value >= thresholds.danger) return 'text-red-600 dark:text-red-400';
    if (value >= thresholds.warning) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'concerning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'critical':
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Critical</Badge>;
      case 'concerning':
        return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Concerning</Badge>;
      default:
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Normal</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Acoustic Features */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <AudioLines className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Acoustic Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Jitter */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Jitter (frequency stability)</span>
              <span className={getSeverityColor(features.jitter_local, { warning: 1.5, danger: 2.0 })}>
                {features.jitter_local.toFixed(2)}%
              </span>
            </div>
            <Progress
              value={getFeatureProgress(features.jitter_local, 3)}
              className="h-2"
            />
          </div>

          {/* Shimmer */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Shimmer (amplitude stability)</span>
              <span className={getSeverityColor(features.shimmer_dda, { warning: 10, danger: 17 })}>
                {features.shimmer_dda.toFixed(2)}%
              </span>
            </div>
            <Progress
              value={getFeatureProgress(features.shimmer_dda, 25)}
              className="h-2"
            />
          </div>

          {/* HNR */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">HNR (voice clarity)</span>
              <span className={features.hnr < 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                {features.hnr.toFixed(1)} dB
              </span>
            </div>
            <Progress
              value={getFeatureProgress(features.hnr, 25)}
              className="h-2"
            />
          </div>

          {/* Speech Rate */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Speech rate</span>
              <span className={features.speech_rate < 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                {features.speech_rate.toFixed(1)} syl/s
              </span>
            </div>
            <Progress
              value={getFeatureProgress(features.speech_rate, 5)}
              className="h-2"
            />
          </div>

          {/* Pause Ratio */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Pause ratio</span>
              <span className={getSeverityColor(features.pause_ratio, { warning: 30, danger: 40 })}>
                {features.pause_ratio.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={getFeatureProgress(features.pause_ratio, 60)}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audio Quality */}
      {quality && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Volume2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Audio Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SNR */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Signal-to-Noise Ratio</span>
                <span className={quality.snr_db >= 15 ? 'text-green-600 dark:text-green-400' : quality.snr_db >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                  {quality.snr_db.toFixed(1)} dB
                </span>
              </div>
              <Progress
                value={getFeatureProgress(quality.snr_db, 25)}
                className="h-2"
              />
            </div>

            {/* Speech Percentage */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Speech content</span>
                <span className={quality.speech_percentage >= 40 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                  {quality.speech_percentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={quality.speech_percentage}
                className="h-2"
              />
            </div>

            {/* Reliability indicator */}
            <div className="flex items-center gap-2 pt-2">
              {quality.is_reliable ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <span className="text-sm text-green-600 dark:text-green-400">Audio quality is reliable</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">Audio quality may affect accuracy</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speech Analysis (Whisper + WER) */}
      {(whisper || wer) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Speech Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transcription */}
            {whisper?.transcription && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transcription:</p>
                <p className="text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 rounded-lg border border-gray-200 dark:border-gray-600 italic">
                  "{whisper.transcription}"
                </p>
              </div>
            )}

            {/* Confidence */}
            {whisper && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Speech clarity confidence</span>
                  <span className={whisper.confidence_score >= 70 ? 'text-green-600 dark:text-green-400' : whisper.confidence_score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                    {whisper.confidence_score.toFixed(0)}%
                  </span>
                </div>
                <Progress
                  value={whisper.confidence_score}
                  className="h-2"
                />
              </div>
            )}

            {/* WER */}
            {wer && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Word accuracy</span>
                  <span className={wer.wer <= 0.15 ? 'text-green-600 dark:text-green-400' : wer.wer <= 0.30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                    {Math.round((1 - wer.wer) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(1 - wer.wer) * 100}
                  className="h-2"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {wer.severity === 'normal'
                    ? 'Articulation is clear'
                    : wer.severity === 'mild'
                      ? 'Mild articulation difficulty detected'
                      : wer.severity === 'moderate'
                        ? 'Moderate speech difficulty detected'
                        : 'Severe speech impairment detected'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Method Agreement */}
      {agreement && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Method Agreement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agreement percentage */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Consensus level</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {agreement.agreementPercentage}% ({agreement.consensusLevel})
                </span>
              </div>
              <Progress
                value={agreement.agreementPercentage}
                className="h-2"
              />
            </div>

            {/* Overall verdict */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Overall assessment:</span>
              {getVerdictBadge(agreement.overallVerdict)}
            </div>

            {/* Method details */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
                Method Results
              </p>
              {agreement.methodDetails.map((method: MethodAssessment, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    {getVerdictIcon(method.verdict)}
                    <span className="text-gray-700 dark:text-gray-300">{method.name}</span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {method.details}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
