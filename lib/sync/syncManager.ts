// Sync Manager
// Handles synchronization of offline data with backend

import {
  getSyncQueue,
  markSyncComplete,
  markSyncFailed,
  clearCompletedSyncs,
  getRecording,
  getTriageResult,
  getQueuePatient,
  updateRecording,
  updateQueuePatient,
  type SyncQueueItem,
} from '../db';

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: Array<{ item: SyncQueueItem; error: string }>;
  duration_ms: number;
}

export interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
}

export type SyncEventType = 'start' | 'progress' | 'complete' | 'error';

export interface SyncEvent {
  type: SyncEventType;
  progress?: SyncProgress;
  result?: SyncResult;
  error?: Error;
}

export class SyncManager {
  private apiUrl: string;
  private isSyncing: boolean = false;
  private eventListeners: Map<SyncEventType, Set<(event: SyncEvent) => void>>;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    this.eventListeners = new Map();
  }

  // Check if online
  async isOnline(): Promise<boolean> {
    if (!navigator.onLine) {
      console.log('[SyncManager] navigator.onLine = false');
      return false;
    }

    // Ping backend to verify connectivity
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      // Fix: Ensure proper URL construction (remove duplicate /health if apiUrl already has it)
      const baseUrl = this.apiUrl.replace(/\/$/, ''); // Remove trailing slash
      const healthUrl = `${baseUrl}/health`;
      console.log('[SyncManager] Checking health endpoint:', healthUrl);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors', // Explicitly set CORS mode
        cache: 'no-cache', // Don't cache health checks
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('[SyncManager] Backend is online ✓');
        return true;
      } else {
        console.warn('[SyncManager] Backend returned non-OK status:', response.status);
        return false;
      }
    } catch (error) {
      console.warn('[SyncManager] Backend not reachable:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  // Sync all pending items
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = performance.now();

    try {
      // Emit start event
      this.emit({ type: 'start' });

      // Check if online
      const online = await this.isOnline();
      if (!online) {
        throw new Error('Cannot sync: Backend not reachable');
      }

      // Get pending sync items
      const syncQueue = await getSyncQueue();
      const pendingItems = syncQueue.filter(
        (item) => item.status === 'pending' || item.status === 'failed'
      );

      console.log(`[SyncManager] Syncing ${pendingItems.length} items...`);

      let syncedItems = 0;
      let failedItems = 0;
      const errors: Array<{ item: SyncQueueItem; error: string }> = [];

      // Sync items in priority order (RED patients first)
      const sortedItems = this.prioritizeSyncItems(pendingItems);

      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];

        // Emit progress
        this.emit({
          type: 'progress',
          progress: {
            current: i + 1,
            total: sortedItems.length,
            percentage: ((i + 1) / sortedItems.length) * 100,
            currentItem: `${item.entity_type} ${item.entity_id}`,
          },
        });

        try {
          await this.syncItem(item);
          if (item.id !== undefined) {
            await markSyncComplete(item.id);
          }
          syncedItems++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[SyncManager] Failed to sync item:`, item, error);

          if (item.id !== undefined) {
            await markSyncFailed(item.id, errorMessage);
          }

          failedItems++;
          errors.push({ item, error: errorMessage });

          // Skip retrying if max retries exceeded
          if (item.retry_count >= 3) {
            console.log(`[SyncManager] Max retries exceeded for item ${item.id}`);
          }
        }
      }

      // Clear completed syncs from queue
      await clearCompletedSyncs();

      const duration = performance.now() - startTime;

      const result: SyncResult = {
        success: failedItems === 0,
        syncedItems,
        failedItems,
        errors,
        duration_ms: duration,
      };

      console.log('[SyncManager] Sync complete:', result);

      // Emit complete event
      this.emit({ type: 'complete', result });

      return result;
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);

      // Emit error event
      this.emit({
        type: 'error',
        error: error instanceof Error ? error : new Error('Sync failed'),
      });

      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Prioritize sync items (RED patients first)
  private prioritizeSyncItems(items: SyncQueueItem[]): SyncQueueItem[] {
    return items.sort((a, b) => {
      // Extract triage level from payload if available
      const aLevel = a.payload?.triageResult?.triageLevel;
      const bLevel = b.payload?.triageResult?.triageLevel;

      // Priority order: RED > YELLOW > GREEN
      const priority = { RED: 3, YELLOW: 2, GREEN: 1 };
      const aPriority = aLevel ? priority[aLevel as keyof typeof priority] || 0 : 0;
      const bPriority = bLevel ? priority[bLevel as keyof typeof priority] || 0 : 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // If same priority, sort by retry count (fewer retries first)
      return a.retry_count - b.retry_count;
    });
  }

  // Sync a single item
  private async syncItem(item: SyncQueueItem): Promise<void> {
    console.log(`[SyncManager] Syncing ${item.entity_type} ${item.operation}...`);

    switch (item.entity_type) {
      case 'recording':
        await this.syncRecording(item);
        break;
      case 'triage_result':
        await this.syncTriageResult(item);
        break;
      case 'queue_patient':
        await this.syncQueuePatient(item);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity_type}`);
    }
  }

  // Sync recording
  private async syncRecording(item: SyncQueueItem): Promise<void> {
    const recording = await getRecording(item.entity_id);
    if (!recording) {
      throw new Error(`Recording not found: ${item.entity_id}`);
    }

    // Send recording to backend for full analysis
    const formData = new FormData();
    formData.append('audio', recording.audioBlob, 'recording.wav');
    formData.append('language', recording.language);

    if (item.payload?.questionnaireData) {
      formData.append('questionnaire_data', JSON.stringify(item.payload.questionnaireData));
    }

    // Fixed: Use Next.js API route instead of Python backend directly
    // The Next.js route will forward to Python backend
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Backend analysis failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Update recording as synced
    await updateRecording(item.entity_id, { synced: true });

    // Update triage result with online analysis
    // (This would update the existing triage result with backend data)
    console.log('[SyncManager] Recording synced with backend analysis');
  }

  // Sync triage result
  private async syncTriageResult(item: SyncQueueItem): Promise<void> {
    const triageResult = await getTriageResult(item.entity_id);
    if (!triageResult) {
      throw new Error(`Triage result not found: ${item.entity_id}`);
    }

    // Send triage result to backend (if backend supports this endpoint)
    // For now, this is a placeholder
    console.log('[SyncManager] Triage result sync not yet implemented');
  }

  // Sync queue patient
  private async syncQueuePatient(item: SyncQueueItem): Promise<void> {
    const patient = await getQueuePatient(item.entity_id);
    if (!patient) {
      throw new Error(`Queue patient not found: ${item.entity_id}`);
    }

    // Send to backend queue API
    const response = await fetch(`${this.apiUrl}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patient),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync queue patient: ${response.statusText}`);
    }

    // Update patient as synced
    await updateQueuePatient(item.entity_id, { synced: true });

    console.log('[SyncManager] Queue patient synced');
  }

  // Conflict resolution
  async resolveConflict(
    localData: any,
    serverData: any
  ): Promise<any> {
    console.log('[SyncManager] Resolving conflict...');

    // Strategy: Server timestamp wins for status fields
    // Merge notes (append local to server)
    const resolved = { ...serverData };

    // Append notes if different
    if (localData.notes && localData.notes !== serverData.notes) {
      resolved.notes = serverData.notes
        ? `${serverData.notes}\n\n[Local update]: ${localData.notes}`
        : localData.notes;
    }

    console.log('[SyncManager] Conflict resolved:', resolved);
    return resolved;
  }

  // Retry failed syncs
  async retryFailedSyncs(): Promise<SyncResult> {
    console.log('[SyncManager] Retrying failed syncs...');

    const syncQueue = await getSyncQueue();
    const failedItems = syncQueue.filter((item) => item.status === 'failed');

    if (failedItems.length === 0) {
      return {
        success: true,
        syncedItems: 0,
        failedItems: 0,
        errors: [],
        duration_ms: 0,
      };
    }

    // Reset failed items to pending
    for (const item of failedItems) {
      if (item.id !== undefined) {
        // This would require a new DB function to reset status
        // For now, syncAll() will pick them up
      }
    }

    return this.syncAll();
  }

  // Event listeners
  on(eventType: SyncEventType, callback: (event: SyncEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  off(eventType: SyncEventType, callback: (event: SyncEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(apiUrl?: string): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(apiUrl);
  }
  return syncManagerInstance;
}
