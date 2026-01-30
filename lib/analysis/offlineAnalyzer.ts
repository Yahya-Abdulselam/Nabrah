// Offline Analysis Orchestrator
// Coordinates client-side audio analysis when backend is unavailable

import { v4 as uuidv4 } from 'uuid';
import {
  extractClientFeatures,
  blobToAudioBuffer,
  type ClientAudioFeatures,
} from '../audioFeatures/clientExtractor';
import {
  saveRecording,
  saveTriageResult,
  addToSyncQueue,
  type RecordingData,
  type TriageResultData,
  type Language,
} from '../db';
import { calculateOfflineTriage } from './offlineTriageLogic';

export interface OfflineAnalysisResult {
  recordingId: string;
  triageResultId: string;
  triageResult: TriageResultData;
  warning: string;
}

/**
 * Analyze audio blob offline (when backend unavailable)
 *
 * Flow:
 * 1. Convert Blob to AudioBuffer
 * 2. Extract client-side features
 * 3. Apply offline triage logic (conservative thresholds)
 * 4. Save to IndexedDB
 * 5. Add to sync queue for later validation
 * 6. Return result with offline disclaimer
 */
export async function analyzeOffline(
  audioBlob: Blob,
  language: Language,
  questionnaireData?: Record<string, any>
): Promise<OfflineAnalysisResult> {
  console.log('[OfflineAnalyzer] Starting offline analysis...');
  const startTime = performance.now();

  try {
    // Step 1: Convert Blob to AudioBuffer
    console.log('[OfflineAnalyzer] Converting blob to audio buffer...');
    const audioBuffer = await blobToAudioBuffer(audioBlob);

    // Step 2: Extract client-side features
    console.log('[OfflineAnalyzer] Extracting features...');
    const features = await extractClientFeatures(audioBuffer);

    // Step 3: Calculate offline triage
    console.log('[OfflineAnalyzer] Calculating triage...');
    const triage = calculateOfflineTriage(features, language);

    // Step 4: Create recording record
    const recordingId = uuidv4();
    const recording: RecordingData = {
      id: recordingId,
      audioBlob: audioBlob,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      language: language,
      timestamp: new Date().toISOString(),
      synced: false,
      metadata: {
        snr_db: features.snr_db,
        speech_percentage: features.speech_percentage,
        quality_is_reliable: !features.low_snr && !features.insufficient_speech,
      },
    };

    // Save recording to IndexedDB
    console.log('[OfflineAnalyzer] Saving recording to IndexedDB...');
    await saveRecording(recording);

    // Step 5: Create triage result record
    const triageResultId = uuidv4();
    const triageResult: TriageResultData = {
      id: triageResultId,
      recordingId: recordingId,
      triageLevel: triage.level,
      triageScore: triage.score,
      confidence: triage.confidence,
      features: {
        // Client-side features
        zero_crossing_rate: features.zero_crossing_rate,
        spectral_centroid: features.spectral_centroid,
        pause_count: features.pause_count,
        estimated_speech_rate: features.estimated_speech_rate,
        rms_energy: features.rms_energy,
        snr_db: features.snr_db,
        speech_percentage: features.speech_percentage,
        clipping_detected: features.clipping_detected,
        low_snr: features.low_snr,
        insufficient_speech: features.insufficient_speech,
      },
      flags: triage.flags.map((flag) => ({
        feature: flag.feature,
        message: flag.message,
        severity: flag.severity,
        value: flag.value,
        threshold: flag.threshold,
      })),
      timestamp: new Date().toISOString(),
      synced: false,
      analysis_source: 'offline',
    };

    // Save triage result to IndexedDB
    console.log('[OfflineAnalyzer] Saving triage result to IndexedDB...');
    await saveTriageResult(triageResult);

    // Step 6: Add to sync queue for later validation
    console.log('[OfflineAnalyzer] Adding to sync queue...');
    await addToSyncQueue({
      entity_type: 'recording',
      entity_id: recordingId,
      operation: 'CREATE',
      payload: {
        recording,
        triageResult,
        questionnaireData,
      },
      retry_count: 0,
      status: 'pending',
    });

    const processingTime = performance.now() - startTime;
    console.log(`[OfflineAnalyzer] Analysis complete in ${processingTime.toFixed(0)}ms`);

    // Return both the IndexedDB structure AND a component-friendly TriageResult
    return {
      recordingId,
      triageResultId,
      triageResult: {
        level: triage.level,
        score: triage.score,
        confidence: triage.confidence,
        message: triage.message,
        action: triage.action,
        flags: triage.flags,
        features: features,
        quality: {
          snr_db: features.snr_db,
          speech_percentage: features.speech_percentage,
          quality_is_reliable: !features.low_snr && !features.insufficient_speech,
        },
        timestamp: new Date().toISOString(),
      },
      warning:
        'This is an OFFLINE analysis using simplified algorithms. ' +
        'Results are less accurate than online analysis. ' +
        'Please reconnect to the internet for full Praat + Whisper analysis.',
    };
  } catch (error) {
    console.error('[OfflineAnalyzer] Analysis failed:', error);
    throw new Error(`Offline analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if offline analysis should be used
 * (based on network status and user preference)
 */
export function shouldUseOfflineAnalysis(): boolean {
  // Check if online
  if (!navigator.onLine) {
    return true;
  }

  // Check if user has explicitly enabled offline-only mode
  // (from settings - not implemented yet)
  // const offlineMode = localStorage.getItem('nabrah-offline-mode-enabled');
  // if (offlineMode === 'true') {
  //   return true;
  // }

  return false;
}

/**
 * Reanalyze a recording with online backend
 * (called when connection restored after offline analysis)
 */
export async function reanalyzeOnline(
  recordingId: string,
  apiUrl: string
): Promise<void> {
  console.log(`[OfflineAnalyzer] Reanalyzing recording ${recordingId} with backend...`);

  // This would call the backend API
  // Implementation depends on backend API structure
  // For now, just log the intent
  console.log('[OfflineAnalyzer] Reanalysis not yet implemented');

  // TODO: Implement actual reanalysis
  // 1. Get recording from IndexedDB
  // 2. Send to backend API
  // 3. Update triage result with online analysis
  // 4. Mark as synced
}
