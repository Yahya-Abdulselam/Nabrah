/**
 * Patient and Queue Types
 *
 * TypeScript interfaces for the clinical queue management system.
 */

import { TriageResult, AudioQuality } from './triageLogic';
import { WERResult } from './werCalculator';
import { AgreementScore } from './agreementScore';

export type PatientStatus = 'pending' | 'reviewing' | 'completed' | 'referred';

export interface WhisperData {
  transcription: string;
  avg_logprob: number;
  no_speech_prob: number;
  confidence_score: number;
  language: string;
  duration_s: number;
}

export interface Patient {
  id: string;
  created_at: string;
  updated_at: string;

  // Triage result fields
  triage_level: 'RED' | 'YELLOW' | 'GREEN';
  triage_score: number;
  triage_confidence: number;
  triage_message: string;
  triage_action: string;

  // Audio quality fields
  snr_db: number | null;
  speech_percentage: number | null;
  quality_is_reliable: boolean;

  // Whisper fields
  whisper_transcription: string | null;
  whisper_confidence: number | null;
  whisper_avg_logprob: number | null;

  // WER fields
  wer_score: number | null;
  wer_severity: string | null;

  // Agreement fields
  agreement_percentage: number | null;
  agreement_consensus: string | null;
  agreement_verdict: string | null;

  // Parsed JSON fields
  flags: string[];
  detailedFlags: Array<{
    severity: string;
    message: string;
    points: number;
  }>;
  features: Record<string, number>;

  // Queue management
  status: PatientStatus;
  priority: number;
  notes: string;
  reviewed_by: string | null;
  referred_to: string | null;
}

export interface QueueStats {
  by_level: {
    RED: number;
    YELLOW: number;
    GREEN: number;
  };
  by_status: Record<PatientStatus, number>;
  active_count: number;
  total_count: number;
}

export interface QueueResponse {
  status: string;
  patients: Patient[];
  stats: QueueStats;
  count: number;
}

export interface AddPatientRequest {
  triage: TriageResult;
  quality?: AudioQuality;
  whisper?: WhisperData;
  wer?: WERResult;
  agreement?: AgreementScore;
  features?: Record<string, number>;
  notes?: string;
}

export interface AddPatientResponse {
  status: string;
  patient_id: string;
  priority: number;
  message: string;
}

export interface UpdateStatusRequest {
  status: PatientStatus;
  notes?: string;
  reviewed_by?: string;
  referred_to?: string;
}

/**
 * Get priority label from priority number
 */
export function getPriorityLabel(priority: number): string {
  if (priority <= 3) return 'Critical';
  if (priority <= 6) return 'Urgent';
  return 'Routine';
}

/**
 * Get status display info
 */
export function getStatusInfo(status: PatientStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: 'text-blue-700', bgColor: 'bg-blue-100' };
    case 'reviewing':
      return { label: 'In Review', color: 'text-purple-700', bgColor: 'bg-purple-100' };
    case 'completed':
      return { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' };
    case 'referred':
      return { label: 'Referred', color: 'text-orange-700', bgColor: 'bg-orange-100' };
    default:
      return { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
