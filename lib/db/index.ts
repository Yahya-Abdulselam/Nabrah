// IndexedDB Wrapper Library for Nabrah
// Provides CRUD operations for all object stores

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  upgradeDatabase,
  validateRecording,
  validateTriageResult,
  validateQueuePatient,
  validateSyncQueueItem,
  type RecordingData,
  type RecordingFilters,
  type TriageResultData,
  type QueuePatientData,
  type QueueFilters,
  type SyncQueueItem,
  type AppSetting,
  type SettingKey,
} from './schema';

// Singleton database connection
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

// Initialize and open database
export async function initDB(): Promise<IDBDatabase> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return existing promise if opening
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[DB] Failed to open database:', request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[DB] Database opened successfully');
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;

      upgradeDatabase(db, oldVersion, newVersion);
    };
  });

  return dbPromise;
}

// Clear entire database
export async function clearDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbPromise = null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log('[DB] Database cleared');
      resolve();
    };
    request.onerror = () => {
      console.error('[DB] Failed to clear database:', request.error);
      reject(request.error);
    };
  });
}

// Get database size estimate
export async function getDBSize(): Promise<number> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0;
}

// Generic helper to execute a transaction
async function executeTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ========================================
// RECORDINGS CRUD Operations
// ========================================

export async function saveRecording(recording: RecordingData): Promise<string> {
  if (!validateRecording(recording)) {
    throw new Error('Invalid recording data');
  }

  await executeTransaction(STORES.RECORDINGS, 'readwrite', (store) =>
    store.put(recording)
  );

  console.log('[DB] Recording saved:', recording.id);
  return recording.id;
}

export async function getRecording(id: string): Promise<RecordingData | null> {
  const result = await executeTransaction<RecordingData | undefined>(
    STORES.RECORDINGS,
    'readonly',
    (store) => store.get(id)
  );

  return result || null;
}

export async function getAllRecordings(
  filters?: RecordingFilters
): Promise<RecordingData[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECORDINGS, 'readonly');
    const store = transaction.objectStore(STORES.RECORDINGS);
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result as RecordingData[];

      // Apply filters
      if (filters) {
        results = results.filter((recording) => {
          if (filters.language && recording.language !== filters.language) {
            return false;
          }
          if (filters.synced !== undefined && recording.synced !== filters.synced) {
            return false;
          }
          if (filters.startDate && recording.timestamp < filters.startDate) {
            return false;
          }
          if (filters.endDate && recording.timestamp > filters.endDate) {
            return false;
          }
          return true;
        });
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  await executeTransaction(STORES.RECORDINGS, 'readwrite', (store) =>
    store.delete(id)
  );

  console.log('[DB] Recording deleted:', id);
}

export async function updateRecording(
  id: string,
  updates: Partial<RecordingData>
): Promise<void> {
  const existing = await getRecording(id);
  if (!existing) {
    throw new Error(`Recording not found: ${id}`);
  }

  const updated = { ...existing, ...updates };
  if (!validateRecording(updated)) {
    throw new Error('Invalid recording data after update');
  }

  await saveRecording(updated);
}

// ========================================
// TRIAGE RESULTS CRUD Operations
// ========================================

export async function saveTriageResult(result: TriageResultData): Promise<string> {
  if (!validateTriageResult(result)) {
    throw new Error('Invalid triage result data');
  }

  await executeTransaction(STORES.TRIAGE_RESULTS, 'readwrite', (store) =>
    store.put(result)
  );

  console.log('[DB] Triage result saved:', result.id);
  return result.id;
}

export async function getTriageResult(id: string): Promise<TriageResultData | null> {
  const result = await executeTransaction<TriageResultData | undefined>(
    STORES.TRIAGE_RESULTS,
    'readonly',
    (store) => store.get(id)
  );

  return result || null;
}

export async function getTriageResultsByRecording(
  recordingId: string
): Promise<TriageResultData[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TRIAGE_RESULTS, 'readonly');
    const store = transaction.objectStore(STORES.TRIAGE_RESULTS);
    const index = store.index('recordingId');
    const request = index.getAll(recordingId);

    request.onsuccess = () => {
      const results = request.result as TriageResultData[];
      // Sort by timestamp (newest first)
      results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getAllTriageResults(): Promise<TriageResultData[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TRIAGE_RESULTS, 'readonly');
    const store = transaction.objectStore(STORES.TRIAGE_RESULTS);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as TriageResultData[];
      results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteTriageResult(id: string): Promise<void> {
  await executeTransaction(STORES.TRIAGE_RESULTS, 'readwrite', (store) =>
    store.delete(id)
  );

  console.log('[DB] Triage result deleted:', id);
}

// ========================================
// QUEUE PATIENTS CRUD Operations
// ========================================

export async function saveQueuePatient(patient: QueuePatientData): Promise<string> {
  if (!validateQueuePatient(patient)) {
    throw new Error('Invalid queue patient data');
  }

  await executeTransaction(STORES.QUEUE_PATIENTS, 'readwrite', (store) =>
    store.put(patient)
  );

  console.log('[DB] Queue patient saved:', patient.id);
  return patient.id;
}

export async function getQueuePatient(id: string): Promise<QueuePatientData | null> {
  const result = await executeTransaction<QueuePatientData | undefined>(
    STORES.QUEUE_PATIENTS,
    'readonly',
    (store) => store.get(id)
  );

  return result || null;
}

export async function getAllQueuePatients(
  filters?: QueueFilters
): Promise<QueuePatientData[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.QUEUE_PATIENTS, 'readonly');
    const store = transaction.objectStore(STORES.QUEUE_PATIENTS);
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result as QueuePatientData[];

      // Apply filters
      if (filters) {
        results = results.filter((patient) => {
          if (filters.status && patient.status !== filters.status) {
            return false;
          }
          if (
            filters.minPriority !== undefined &&
            patient.priority < filters.minPriority
          ) {
            return false;
          }
          if (
            filters.maxPriority !== undefined &&
            patient.priority > filters.maxPriority
          ) {
            return false;
          }
          if (filters.synced !== undefined && patient.synced !== filters.synced) {
            return false;
          }
          return true;
        });
      }

      // Sort by priority (highest first), then timestamp (newest first)
      results.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.timestamp.localeCompare(a.timestamp);
      });

      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function updateQueuePatient(
  id: string,
  updates: Partial<QueuePatientData>
): Promise<void> {
  const existing = await getQueuePatient(id);
  if (!existing) {
    throw new Error(`Queue patient not found: ${id}`);
  }

  const updated = { ...existing, ...updates };
  if (!validateQueuePatient(updated)) {
    throw new Error('Invalid queue patient data after update');
  }

  await saveQueuePatient(updated);
}

export async function deleteQueuePatient(id: string): Promise<void> {
  await executeTransaction(STORES.QUEUE_PATIENTS, 'readwrite', (store) =>
    store.delete(id)
  );

  console.log('[DB] Queue patient deleted:', id);
}

// ========================================
// SYNC QUEUE Operations
// ========================================

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  if (!validateSyncQueueItem(item as SyncQueueItem)) {
    throw new Error('Invalid sync queue item');
  }

  await executeTransaction(STORES.SYNC_QUEUE, 'readwrite', (store) =>
    store.add(item)
  );

  console.log('[DB] Added to sync queue:', item.entity_type, item.entity_id);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as SyncQueueItem[];
      // Sort by priority: pending first, then by retry count (fewer retries first)
      results.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.retry_count - b.retry_count;
      });
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function markSyncComplete(id: number): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem;
      if (item) {
        item.status = 'completed';
        const putRequest = store.put(item);
        putRequest.onsuccess = () => {
          console.log('[DB] Sync item marked complete:', id);
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error(`Sync item not found: ${id}`));
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function markSyncFailed(id: number, error: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem;
      if (item) {
        item.status = 'failed';
        item.retry_count += 1;
        item.last_attempt = new Date().toISOString();
        item.error_message = error;
        const putRequest = store.put(item);
        putRequest.onsuccess = () => {
          console.log('[DB] Sync item marked failed:', id, error);
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error(`Sync item not found: ${id}`));
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteSyncQueueItem(id: number): Promise<void> {
  await executeTransaction(STORES.SYNC_QUEUE, 'readwrite', (store) =>
    store.delete(id)
  );

  console.log('[DB] Sync queue item deleted:', id);
}

export async function clearCompletedSyncs(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('status');
    const request = index.openCursor(IDBKeyRange.only('completed'));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        console.log('[DB] Cleared completed sync items');
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// ========================================
// APP SETTINGS Operations
// ========================================

export async function getSetting<T>(key: SettingKey): Promise<T | null> {
  const result = await executeTransaction<AppSetting | undefined>(
    STORES.APP_SETTINGS,
    'readonly',
    (store) => store.get(key)
  );

  return result ? (result.value as T) : null;
}

export async function setSetting<T>(key: SettingKey, value: T): Promise<void> {
  const setting: AppSetting = { key, value };

  await executeTransaction(STORES.APP_SETTINGS, 'readwrite', (store) =>
    store.put(setting)
  );

  console.log('[DB] Setting saved:', key);
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  await executeTransaction(STORES.APP_SETTINGS, 'readwrite', (store) =>
    store.delete(key)
  );

  console.log('[DB] Setting deleted:', key);
}

export async function getAllSettings(): Promise<Record<string, any>> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.APP_SETTINGS, 'readonly');
    const store = transaction.objectStore(STORES.APP_SETTINGS);
    const request = store.getAll();

    request.onsuccess = () => {
      const settings = request.result as AppSetting[];
      const result: Record<string, any> = {};
      settings.forEach((setting) => {
        result[setting.key] = setting.value;
      });
      resolve(result);
    };

    request.onerror = () => reject(request.error);
  });
}

// ========================================
// Batch Operations
// ========================================

export async function batchSaveRecordings(recordings: RecordingData[]): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECORDINGS, 'readwrite');
    const store = transaction.objectStore(STORES.RECORDINGS);

    recordings.forEach((recording) => {
      if (!validateRecording(recording)) {
        reject(new Error(`Invalid recording data: ${recording.id}`));
        return;
      }
      store.put(recording);
    });

    transaction.oncomplete = () => {
      console.log('[DB] Batch saved recordings:', recordings.length);
      resolve();
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

// ========================================
// Statistics & Analytics
// ========================================

export async function getRecordingStats() {
  const recordings = await getAllRecordings();
  const triageResults = await getAllTriageResults();

  return {
    total_recordings: recordings.length,
    synced_recordings: recordings.filter((r) => r.synced).length,
    unsynced_recordings: recordings.filter((r) => !r.synced).length,
    total_triage_results: triageResults.length,
    online_analyses: triageResults.filter((r) => r.analysis_source === 'online').length,
    offline_analyses: triageResults.filter((r) => r.analysis_source === 'offline').length,
    red_results: triageResults.filter((r) => r.triageLevel === 'RED').length,
    yellow_results: triageResults.filter((r) => r.triageLevel === 'YELLOW').length,
    green_results: triageResults.filter((r) => r.triageLevel === 'GREEN').length,
  };
}
