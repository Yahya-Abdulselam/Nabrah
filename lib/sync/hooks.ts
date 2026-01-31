// React Hooks for Sync Operations
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSyncManager, type SyncResult, type SyncProgress, type SyncEvent } from './syncManager';
import { getNetworkStatusManager, type NetworkStatus, type NetworkStatusEvent } from './networkStatus';

// Hook for network status
export function useNetworkStatus() {
  // Initialize as unknown to prevent false indicators
  const [isOnline, setIsOnline] = useState(true); // Optimistic - assume online until proven otherwise
  const [status, setStatus] = useState<NetworkStatus>('unknown');
  const [lastStatusChange, setLastStatusChange] = useState<Date | null>(null);

  useEffect(() => {
    const networkManager = getNetworkStatusManager();

    // Immediately get current status (don't wait)
    const currentStatus = networkManager.getStatus();

    // If status is already determined (not unknown), update immediately
    if (currentStatus !== 'unknown') {
      setStatus(currentStatus);
      setIsOnline(currentStatus === 'online');
    } else {
      // Status is unknown, wait for verification then update
      setTimeout(() => {
        const verifiedStatus = networkManager.getStatus();
        setStatus(verifiedStatus);
        setIsOnline(verifiedStatus === 'online');
      }, 1000); // Give backend check time to complete
    }

    // Listen for status changes
    const handleStatusChange = (event: NetworkStatusEvent) => {
      console.log('[useNetworkStatus] Status changed:', event.status);
      setStatus(event.status);
      setIsOnline(event.status === 'online');
      setLastStatusChange(event.timestamp);
    };

    networkManager.onChange(handleStatusChange);

    // Cleanup
    return () => {
      networkManager.removeListener(handleStatusChange);
    };
  }, []);

  const triggerSync = useCallback(() => {
    const networkManager = getNetworkStatusManager();
    networkManager.scheduleSync(0); // Immediate
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    status,
    lastStatusChange,
    triggerSync,
  };
}

// Hook for sync operations
export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  useEffect(() => {
    const syncManager = getSyncManager();

    // Listen for sync events
    const handleSyncEvent = (event: SyncEvent) => {
      switch (event.type) {
        case 'start':
          setIsSyncing(true);
          setSyncProgress(null);
          setSyncError(null);
          break;

        case 'progress':
          if (event.progress) {
            setSyncProgress(event.progress);
          }
          break;

        case 'complete':
          setIsSyncing(false);
          if (event.result) {
            setLastSyncResult(event.result);
          }
          setSyncProgress(null);
          break;

        case 'error':
          setIsSyncing(false);
          if (event.error) {
            setSyncError(event.error);
          }
          setSyncProgress(null);
          break;
      }
    };

    syncManager.on('start', handleSyncEvent);
    syncManager.on('progress', handleSyncEvent);
    syncManager.on('complete', handleSyncEvent);
    syncManager.on('error', handleSyncEvent);

    // Cleanup
    return () => {
      syncManager.off('start', handleSyncEvent);
      syncManager.off('progress', handleSyncEvent);
      syncManager.off('complete', handleSyncEvent);
      syncManager.off('error', handleSyncEvent);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    try {
      setSyncError(null);
      const syncManager = getSyncManager();
      const result = await syncManager.syncAll();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sync failed');
      setSyncError(err);
      throw err;
    }
  }, []);

  const retryFailedSyncs = useCallback(async () => {
    try {
      setSyncError(null);
      const syncManager = getSyncManager();
      const result = await syncManager.retryFailedSyncs();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Retry failed');
      setSyncError(err);
      throw err;
    }
  }, []);

  return {
    isSyncing,
    syncProgress,
    lastSyncResult,
    syncError,
    triggerSync,
    retryFailedSyncs,
  };
}

// Combined hook for network status + sync
export function useOfflineSync() {
  const network = useNetworkStatus();
  const sync = useSync();

  // Auto-sync when coming online
  useEffect(() => {
    if (network.isOnline && network.lastStatusChange) {
      // Wait 2 seconds after coming online, then sync
      const timeoutId = setTimeout(() => {
        sync.triggerSync().catch((error) => {
          console.error('[useOfflineSync] Auto-sync failed:', error);
        });
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [network.isOnline, network.lastStatusChange]);

  return {
    ...network,
    ...sync,
  };
}

// Hook for listening to sync requests from service worker
export function useServiceWorkerSync() {
  const { triggerSync } = useSync();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen for sw-sync-requested custom event
    const handleSyncRequest = (event: Event) => {
      console.log('[useServiceWorkerSync] Sync requested by service worker');
      triggerSync().catch((error) => {
        console.error('[useServiceWorkerSync] Sync failed:', error);
      });
    };

    window.addEventListener('sw-sync-requested', handleSyncRequest);

    return () => {
      window.removeEventListener('sw-sync-requested', handleSyncRequest);
    };
  }, [triggerSync]);
}
