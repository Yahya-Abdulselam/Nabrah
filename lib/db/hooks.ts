// React Hooks for IndexedDB Operations
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllRecordings,
  getTriageResultsByRecording,
  getAllQueuePatients,
  getSyncQueue,
  getRecordingStats,
  type RecordingData,
  type RecordingFilters,
  type TriageResultData,
  type QueuePatientData,
  type QueueFilters,
  type SyncQueueItem,
} from './index';

// Hook to manage recordings
export function useRecordings(filters?: RecordingFilters) {
  const [recordings, setRecordings] = useState<RecordingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllRecordings(filters);
      setRecordings(data);
    } catch (err) {
      console.error('[Hook] Failed to load recordings:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    recordings,
    loading,
    error,
    refresh,
  };
}

// Hook to manage triage results for a recording
export function useTriageResults(recordingId?: string) {
  const [triageResults, setTriageResults] = useState<TriageResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!recordingId) {
      setTriageResults([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getTriageResultsByRecording(recordingId);
      setTriageResults(data);
    } catch (err) {
      console.error('[Hook] Failed to load triage results:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [recordingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    triageResults,
    loading,
    error,
    refresh,
  };
}

// Hook to manage queue patients
export function useQueuePatients(filters?: QueueFilters) {
  const [patients, setPatients] = useState<QueuePatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllQueuePatients(filters);
      setPatients(data);
    } catch (err) {
      console.error('[Hook] Failed to load queue patients:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    patients,
    loading,
    error,
    refresh,
  };
}

// Hook to manage sync status
export function useSyncStatus() {
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSyncQueue();
      setSyncQueue(data);
    } catch (err) {
      console.error('[Hook] Failed to load sync queue:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Auto-refresh every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const stats = {
    pending: syncQueue.filter((item) => item.status === 'pending').length,
    inProgress: syncQueue.filter((item) => item.status === 'in_progress').length,
    failed: syncQueue.filter((item) => item.status === 'failed').length,
    completed: syncQueue.filter((item) => item.status === 'completed').length,
    total: syncQueue.length,
  };

  return {
    syncQueue,
    stats,
    loading,
    error,
    refresh,
  };
}

// Hook to manage offline mode state
export function useOfflineMode() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setWasOffline(true);

      // Trigger sync event
      const event = new CustomEvent('network-online');
      window.dispatchEvent(event);

      // Clear "was offline" flag after 5 seconds
      setTimeout(() => setWasOffline(false), 5000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOffline,
    wasOffline,
    isOnline: !isOffline,
  };
}

// Hook to manage storage information
export function useStorageInfo() {
  const [usage, setUsage] = useState(0);
  const [quota, setQuota] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setUsage(estimate.usage || 0);
        setQuota(estimate.quota || 0);
      }
    } catch (err) {
      console.error('[Hook] Failed to get storage info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
  const usageMB = usage / (1024 * 1024);
  const quotaMB = quota / (1024 * 1024);

  return {
    usage,
    quota,
    usagePercent,
    usageMB,
    quotaMB,
    loading,
    refresh,
  };
}

// Hook to get database statistics
export function useDBStats() {
  const [stats, setStats] = useState({
    total_recordings: 0,
    synced_recordings: 0,
    unsynced_recordings: 0,
    total_triage_results: 0,
    online_analyses: 0,
    offline_analyses: 0,
    red_results: 0,
    yellow_results: 0,
    green_results: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecordingStats();
      setStats(data);
    } catch (err) {
      console.error('[Hook] Failed to load DB stats:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    stats,
    loading,
    error,
    refresh,
  };
}

// Hook to manage IndexedDB initialization state
export function useIndexedDB() {
  const [isReady, setIsReady] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if IndexedDB is supported
    if (typeof window === 'undefined' || !window.indexedDB) {
      setIsSupported(false);
      setError(new Error('IndexedDB not supported'));
      return;
    }

    // Initialize database
    import('./index')
      .then((db) => db.initDB())
      .then(() => {
        setIsReady(true);
        console.log('[Hook] IndexedDB initialized');
      })
      .catch((err) => {
        console.error('[Hook] IndexedDB initialization failed:', err);
        setError(err);
      });
  }, []);

  return {
    isReady,
    isSupported,
    error,
  };
}
