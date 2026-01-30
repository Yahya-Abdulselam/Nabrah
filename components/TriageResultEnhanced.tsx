'use client';

import { TriageResult } from './TriageResult';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { TriageResult as TriageData } from '@/lib/triageLogic';
import { WERResult } from '@/lib/werCalculator';
import { AgreementScore } from '@/lib/agreementScore';
import { QuestionnaireResult } from '@/lib/questionnaireLogic';
import { useNetworkStatus } from '@/lib/sync/hooks';
import { OfflineAnalysisBanner } from './OfflineBanner';
import { useState } from 'react';

interface WhisperData {
  transcription: string;
  avg_logprob: number;
  confidence_score: number;
  no_speech_prob: number;
}

interface TriageResultEnhancedProps {
  data: TriageData;
  whisper?: WhisperData;
  wer?: WERResult;
  agreement?: AgreementScore;
  questionnaireResult?: QuestionnaireResult;
  isOfflineAnalysis?: boolean;
  recordingId?: string;
  triageResultId?: string;
}

export function TriageResultEnhanced({
  data,
  whisper,
  wer,
  agreement,
  questionnaireResult,
  isOfflineAnalysis = false,
  recordingId,
  triageResultId,
}: TriageResultEnhancedProps) {
  const { isOnline } = useNetworkStatus();
  const [reanalyzing, setReanalyzing] = useState(false);

  const handleReanalyze = async () => {
    if (!recordingId || !isOnline) return;

    setReanalyzing(true);
    try {
      // TODO: Implement reanalysis with backend
      // This would fetch the recording from IndexedDB
      // and send it to the backend for full Praat + Whisper analysis
      console.log('Reanalyzing recording:', recordingId);

      // Placeholder - would redirect to new result
      // window.location.reload();
    } catch (error) {
      console.error('Reanalysis failed:', error);
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Offline Analysis Banner */}
      {isOfflineAnalysis && <OfflineAnalysisBanner />}

      {/* Analysis Source Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isOfflineAnalysis ? 'secondary' : 'default'}>
            {isOfflineAnalysis ? (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Offline Analysis
              </>
            ) : (
              <>Online Analysis</>
            )}
          </Badge>

          {/* Confidence Modifier for Offline */}
          {isOfflineAnalysis && (
            <span className="text-xs text-gray-500">
              Confidence: {data.confidence}% (offline estimation)
            </span>
          )}
        </div>

        {/* Reanalyze Button (show if offline result and now online) */}
        {isOfflineAnalysis && isOnline && recordingId && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReanalyze}
            disabled={reanalyzing}
          >
            {reanalyzing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                Reanalyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-2" />
                Reanalyze with Full Analysis
              </>
            )}
          </Button>
        )}
      </div>

      {/* Offline Limitations Warning */}
      {isOfflineAnalysis && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Limited Offline Analysis</p>
              <p className="text-xs mt-1 text-blue-700">
                This result was generated using simplified client-side algorithms.
                Features analyzed: voice noise, quality indicators, speech patterns.
                Missing: Full Praat jitter/shimmer, Whisper transcription, detailed HNR.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Original Triage Result Component */}
      <TriageResult
        data={data}
        whisper={whisper}
        wer={wer}
        agreement={agreement}
        questionnaireResult={questionnaireResult}
      />

      {/* Additional Offline Info Footer */}
      {isOfflineAnalysis && (
        <div className="text-center text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">
          <p>
            This recording has been saved locally and will be analyzed with full
            Praat + Whisper algorithms when you reconnect to the internet.
          </p>
          {triageResultId && (
            <p className="mt-1 font-mono text-gray-400">
              Recording ID: {triageResultId?.slice(0, 8)}...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
