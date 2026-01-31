'use client';

import { useState } from 'react';
import { Patient, getStatusInfo, formatTimestamp, getPriorityLabel } from '@/lib/patientTypes';
import { updatePatientStatus, deletePatient } from '@/lib/queueApi';
import { useQueueStore } from '@/lib/queueStore';
import { useQueueSync } from '@/hooks/useQueueSync';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Trash2,
  Eye,
  Forward,
  Check,
  Loader2
} from 'lucide-react';

interface PatientCardProps {
  patient: Patient;
  onUpdate: () => void;
}

export function PatientCard({ patient, onUpdate }: PatientCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const { removePatient, rollbackRemove, isPatientDeleting, setDeleting } = useQueueStore();
  const queueSync = useQueueSync();
  const isDeleting = isPatientDeleting(patient.id);

  const statusInfo = getStatusInfo(patient.status);

  // Triage level styling
  const triageStyles = {
    RED: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-500 dark:border-red-600',
      text: 'text-red-700 dark:text-red-300',
      icon: AlertCircle
    },
    YELLOW: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-500 dark:border-yellow-600',
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: AlertTriangle
    },
    GREEN: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-500 dark:border-green-600',
      text: 'text-green-700 dark:text-green-300',
      icon: CheckCircle
    }
  };

  const style = triageStyles[patient.triage_level] || triageStyles.GREEN;
  const TriageIcon = style.icon;

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      await updatePatientStatus(patient.id, {
        status: newStatus as 'pending' | 'reviewing' | 'completed' | 'referred'
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // Prevent duplicate deletes
    if (isDeleting) {
      console.log('[PatientCard] Delete already in progress for:', patient.id);
      return;
    }

    if (!confirm('Are you sure you want to remove this patient from the queue?')) {
      return;
    }

    // Store patient data for potential rollback
    const patientCopy = { ...patient };

    try {
      // Optimistic update: remove from UI immediately
      await removePatient(patient.id);

      // Broadcast to other tabs
      queueSync.broadcastPatientRemoved(patient.id);

      // Show loading toast
      const loadingToast = toast.loading('Removing patient from queue...');

      // Call backend
      await deletePatient(patient.id);

      // Success!
      toast.dismiss(loadingToast);
      toast.success('Patient removed from queue', {
        description: `Patient ${patient.id} has been successfully removed.`
      });

      // Clear deleting flag
      setDeleting(patient.id, false);

    } catch (error) {
      console.error('[PatientCard] Failed to delete patient:', error);

      // Rollback: restore patient to queue
      rollbackRemove(patientCopy);

      // Show error toast
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to remove patient', {
        description: errorMessage.includes('404')
          ? 'Patient was already removed. The queue has been refreshed.'
          : 'Please try again or check your connection.',
        action: {
          label: 'Retry',
          onClick: () => handleDelete()
        }
      });

      // Clear deleting flag
      setDeleting(patient.id, false);
    }
  };

  return (
    <Card className={`${style.bg} ${style.border} border-l-4 transition-all hover:shadow-md`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TriageIcon className={`h-6 w-6 ${style.text}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{patient.id}</span>
                <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="h-3 w-3" />
                {formatTimestamp(patient.created_at)}
                <span className="mx-1">•</span>
                <span className="font-medium">
                  {getPriorityLabel(patient.priority)} (P{patient.priority})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`${style.bg} ${style.text} border ${style.border}`}>
              {patient.triage_level}
            </Badge>
            <span className="text-lg font-bold">
              {patient.triage_score} pts
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {/* Quick info row */}
        <div className="flex flex-wrap gap-4 text-sm mb-3">
          {patient.snr_db !== null && (
            <span className="text-gray-600 dark:text-gray-400">
              SNR: <span className="font-medium">{patient.snr_db} dB</span>
            </span>
          )}
          {patient.speech_percentage !== null && (
            <span className="text-gray-600 dark:text-gray-400">
              Speech: <span className="font-medium">{patient.speech_percentage}%</span>
            </span>
          )}
          {patient.wer_score !== null && (
            <span className="text-gray-600 dark:text-gray-400">
              WER: <span className="font-medium">{Math.round(patient.wer_score * 100)}%</span>
            </span>
          )}
          {patient.agreement_percentage !== null && (
            <span className="text-gray-600 dark:text-gray-400">
              Agreement: <span className="font-medium">{patient.agreement_percentage}%</span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {patient.status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('reviewing')}
              disabled={loading}
            >
              <Eye className="h-4 w-4 mr-1" />
              Start Review
            </Button>
          )}
          {patient.status === 'reviewing' && (
            <>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusChange('completed')}
                disabled={loading}
              >
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('referred')}
                disabled={loading}
              >
                <Forward className="h-4 w-4 mr-1" />
                Refer
              </Button>
            </>
          )}
          {(patient.status === 'completed' || patient.status === 'referred') && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleDelete}
              disabled={loading || isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              {isDeleting ? 'Removing...' : 'Remove'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Details
              </>
            )}
          </Button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Triage message */}
            <div>
              <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
                Triage Assessment
              </h4>
              <p className={`${style.text} font-medium`}>
                {patient.triage_message}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {patient.triage_action}
              </p>
            </div>

            {/* Flags */}
            {patient.flags && patient.flags.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Flags Detected
                </h4>
                <ul className="space-y-1">
                  {patient.flags.map((flag, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                    >
                      <span className="text-orange-500 dark:text-orange-400 mt-1">•</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Whisper transcription */}
            {patient.whisper_transcription && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Transcription
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                  "{patient.whisper_transcription}"
                </p>
              </div>
            )}

            {/* Features */}
            {patient.features && Object.keys(patient.features).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Acoustic Features
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(patient.features).map(([key, value]) => (
                    <div
                      key={key}
                      className="text-sm bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <span className="text-gray-500 dark:text-gray-400">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium ml-1 text-gray-900 dark:text-gray-100">
                        {typeof value === 'number' ? value.toFixed(2) : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {patient.notes && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                  {patient.notes}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-4">
                <span>Confidence: {patient.triage_confidence}%</span>
                {patient.reviewed_by && (
                  <span>Reviewed by: {patient.reviewed_by}</span>
                )}
                {patient.referred_to && (
                  <span>Referred to: {patient.referred_to}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
