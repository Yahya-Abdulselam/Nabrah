/**
 * Queue API with Offline Fallback
 *
 * Wraps queueApi to add IndexedDB offline support
 */

import { v4 as uuidv4 } from 'uuid';
import {
  saveQueuePatient,
  getAllQueuePatients,
  getQueuePatient,
  updateQueuePatient,
  addToSyncQueue,
  type QueuePatientData,
} from './db';
import {
  fetchQueue,
  addPatientToQueue as addPatientToQueueOnline,
  fetchPatient,
  updatePatientStatus as updatePatientStatusOnline,
  type AddPatientRequest,
  type UpdateStatusRequest,
} from './queueApi';

/**
 * Check if online
 */
function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Fetch queue with offline fallback
 */
export async function fetchQueueWithFallback(statusFilter?: string) {
  if (isOnline()) {
    try {
      return await fetchQueue(statusFilter as any);
    } catch (error) {
      console.log('[QueueAPI] Online fetch failed, falling back to offline:', error);
    }
  }

  // Offline fallback: get from IndexedDB
  console.log('[QueueAPI] Using offline data');
  const patients = await getAllQueuePatients({
    status: statusFilter as any,
  });

  return {
    patients: patients.map((p) => ({
      id: p.id,
      triage_level: p.triageResultId, // This would need proper mapping
      status: p.status,
      priority: p.priority,
      timestamp: p.timestamp,
      // Add other fields as needed
    })),
    total: patients.length,
  };
}

/**
 * Add patient to queue with offline support
 */
export async function addPatientToQueueOffline(
  data: AddPatientRequest
): Promise<{ patient_id: string }> {
  const patientId = uuidv4();

  // Create queue patient record
  const queuePatient: QueuePatientData = {
    id: patientId,
    triageResultId: '', // Would be filled from triage result
    status: 'pending',
    priority: calculatePriority(data.triage.level),
    questionnaire_data: data,
    timestamp: new Date().toISOString(),
    synced: false,
  };

  // Save to IndexedDB
  await saveQueuePatient(queuePatient);

  if (isOnline()) {
    // Try to sync immediately if online
    try {
      const response = await addPatientToQueueOnline(data);
      // Update with server-generated ID
      await updateQueuePatient(patientId, {
        id: response.patient_id,
        synced: true,
      });
      return response;
    } catch (error) {
      console.log('[QueueAPI] Online add failed, queued for sync:', error);

      // Add to sync queue
      await addToSyncQueue({
        entity_type: 'queue_patient',
        entity_id: patientId,
        operation: 'CREATE',
        payload: data,
        retry_count: 0,
        status: 'pending',
      });
    }
  } else {
    // Offline: add to sync queue
    await addToSyncQueue({
      entity_type: 'queue_patient',
      entity_id: patientId,
      operation: 'CREATE',
      payload: data,
      retry_count: 0,
      status: 'pending',
    });
  }

  return { patient_id: patientId };
}

/**
 * Fetch patient with offline fallback
 */
export async function fetchPatientWithFallback(patientId: string) {
  if (isOnline()) {
    try {
      return await fetchPatient(patientId);
    } catch (error) {
      console.log('[QueueAPI] Online fetch failed, falling back to offline:', error);
    }
  }

  // Offline fallback
  const patient = await getQueuePatient(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  return patient;
}

/**
 * Update patient status with offline support
 */
export async function updatePatientStatusOffline(
  patientId: string,
  data: UpdateStatusRequest
) {
  // Update in IndexedDB
  await updateQueuePatient(patientId, {
    status: data.status as any,
    notes: data.notes,
    reviewed_by: data.reviewed_by,
    referred_to: data.referred_to,
  });

  if (isOnline()) {
    try {
      await updatePatientStatusOnline(patientId, data);
      // Mark as synced
      await updateQueuePatient(patientId, { synced: true });
      return;
    } catch (error) {
      console.log('[QueueAPI] Online update failed, queued for sync:', error);
    }
  }

  // Add to sync queue
  await addToSyncQueue({
    entity_type: 'queue_patient',
    entity_id: patientId,
    operation: 'UPDATE',
    payload: data,
    retry_count: 0,
    status: 'pending',
  });
}

/**
 * Calculate priority from triage level
 */
function calculatePriority(triageLevel: string): number {
  switch (triageLevel) {
    case 'RED':
      return 10;
    case 'YELLOW':
      return 5;
    case 'GREEN':
      return 1;
    default:
      return 1;
  }
}
