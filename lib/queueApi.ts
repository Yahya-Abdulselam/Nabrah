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
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries (default: 2)
 * @param retryableStatuses HTTP status codes that should trigger retry (default: [404])
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  retryableStatuses: number[] = [404]
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error contains status code (from fetch response)
      const statusMatch = lastError.message.match(/\((\d+)\)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : null;

      // Only retry on specific status codes
      const shouldRetry = status && retryableStatuses.includes(status);

      if (!shouldRetry || attempt === maxRetries) {
        // Don't retry, or max retries reached
        throw lastError;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = 500 * Math.pow(2, attempt);
      console.log(`[retryWithBackoff] Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

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
  console.log('[queueApi] Adding patient to queue:', API_URL);

  // Add 10-second timeout for queue requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('[queueApi] Server error:', response.status, error);
      throw new Error(error.detail || `Failed to add patient to queue (${response.status})`);
    }

    const result = await response.json();
    console.log('[queueApi] Patient added successfully:', result.patient_id);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds. Backend may be slow or unavailable.');
    }
    throw error;
  }
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
 * Includes retry logic with exponential backoff for 404 errors
 */
export async function deletePatient(
  patientId: string
): Promise<{ status: string; message: string }> {
  return retryWithBackoff(async () => {
    console.log(`[queueApi] DELETE /queue/${patientId}`);

    const response = await fetch(`${API_URL}/queue/${patientId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));

      if (response.status === 404) {
        console.warn(`[queueApi] Patient ${patientId} not found (404)`);
        throw new Error(`Patient not found (404)`);
      }

      throw new Error(error.detail || `Failed to delete patient (${response.status})`);
    }

    const result = await response.json();
    console.log(`[queueApi] Successfully deleted patient ${patientId}`);
    return result;
  }, 2, [404]); // Retry up to 2 times on 404 errors
}

/**
 * Get all patients (simplified - just returns patient array)
 * Used by SSE polling fallback
 */
export async function getAllPatients(): Promise<Patient[]> {
  const response = await fetch(`${API_URL}/queue`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to fetch patients');
  }

  const data = await response.json();
  return data.patients || [];
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
