/**
 * Queue API Client
 *
 * Client for interacting with the patient queue backend endpoints.
 */

import {
  QueueResponse,
  Patient,
  AddPatientRequest,
  AddPatientResponse,
  UpdateStatusRequest,
  QueueStats,
  PatientStatus
} from './patientTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Fetch all patients in the queue
 */
export async function fetchQueue(statusFilter?: PatientStatus): Promise<QueueResponse> {
  const url = new URL(`${API_URL}/queue`);
  if (statusFilter) {
    url.searchParams.set('status', statusFilter);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to fetch queue');
  }

  return response.json();
}

/**
 * Add a patient to the queue
 */
export async function addPatientToQueue(
  data: AddPatientRequest
): Promise<AddPatientResponse> {
  const response = await fetch(`${API_URL}/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to add patient to queue');
  }

  return response.json();
}

/**
 * Get a specific patient by ID
 */
export async function fetchPatient(patientId: string): Promise<Patient> {
  const response = await fetch(`${API_URL}/queue/${patientId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Patient not found');
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to fetch patient');
  }

  const result = await response.json();
  return result.patient;
}

/**
 * Update a patient's status
 */
export async function updatePatientStatus(
  patientId: string,
  update: UpdateStatusRequest
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_URL}/queue/${patientId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(update)
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Patient not found');
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to update patient');
  }

  return response.json();
}

/**
 * Delete a patient from the queue
 */
export async function deletePatient(
  patientId: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_URL}/queue/${patientId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Patient not found');
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to delete patient');
  }

  return response.json();
}

/**
 * Get queue statistics
 */
export async function fetchQueueStats(): Promise<QueueStats> {
  const response = await fetch(`${API_URL}/queue/stats/summary`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to fetch queue stats');
  }

  const result = await response.json();
  return result.stats;
}

/**
 * Export queue as CSV
 */
export async function exportQueueCsv(): Promise<Blob> {
  const response = await fetch(`${API_URL}/queue/export/csv`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to export queue');
  }

  return response.blob();
}

/**
 * Download queue CSV
 */
export async function downloadQueueCsv(): Promise<void> {
  const blob = await exportQueueCsv();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nabrah_queue_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
