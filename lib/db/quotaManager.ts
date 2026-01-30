// Storage Quota Manager for IndexedDB
// Manages storage limits, cleanup, and space allocation

import {
  getAllRecordings,
  deleteRecording,
  deleteTriageResult,
  getTriageResultsByRecording,
  getDBSize,
  type RecordingData,
} from './index';

export interface StorageEstimate {
  usage: number; // bytes used
  quota: number; // bytes available
  usagePercent: number;
  usageMB: number;
  quotaMB: number;
}

export interface CleanupResult {
  deletedRecordings: number;
  deletedTriageResults: number;
  freedBytes: number;
  freedMB: number;
}

// Default storage limit (100MB)
const DEFAULT_STORAGE_LIMIT_MB = 100;
const DEFAULT_STORAGE_LIMIT_BYTES = DEFAULT_STORAGE_LIMIT_MB * 1024 * 1024;

// Warning threshold (90% of quota)
const WARNING_THRESHOLD = 0.9;

export class QuotaManager {
  private limitBytes: number;

  constructor(limitMB: number = DEFAULT_STORAGE_LIMIT_MB) {
    this.limitBytes = limitMB * 1024 * 1024;
  }

  // Get current storage estimate
  async getStorageEstimate(): Promise<StorageEstimate> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;

      return {
        usage,
        quota,
        usagePercent: quota > 0 ? (usage / quota) * 100 : 0,
        usageMB: usage / (1024 * 1024),
        quotaMB: quota / (1024 * 1024),
      };
    }

    // Fallback if Storage API not available
    const usage = await getDBSize();
    return {
      usage,
      quota: this.limitBytes,
      usagePercent: (usage / this.limitBytes) * 100,
      usageMB: usage / (1024 * 1024),
      quotaMB: this.limitBytes / (1024 * 1024),
    };
  }

  // Check if approaching quota limit
  async isApproachingQuota(): Promise<boolean> {
    const estimate = await this.getStorageEstimate();
    return estimate.usagePercent >= WARNING_THRESHOLD * 100;
  }

  // Check if quota exceeded
  async isQuotaExceeded(): Promise<boolean> {
    const estimate = await this.getStorageEstimate();
    return estimate.usage >= this.limitBytes;
  }

  // Enforce quota by cleaning up old data
  async enforceQuota(): Promise<CleanupResult> {
    const estimate = await this.getStorageEstimate();

    if (estimate.usage < this.limitBytes * WARNING_THRESHOLD) {
      // No cleanup needed
      return {
        deletedRecordings: 0,
        deletedTriageResults: 0,
        freedBytes: 0,
        freedMB: 0,
      };
    }

    console.log('[QuotaManager] Storage usage high, starting cleanup...');

    // Calculate how much space we need to free
    const targetUsage = this.limitBytes * 0.7; // Target 70% usage
    const spaceToFree = estimate.usage - targetUsage;

    let result: CleanupResult = {
      deletedRecordings: 0,
      deletedTriageResults: 0,
      freedBytes: 0,
      freedMB: 0,
    };

    // Strategy 1: Delete old synced recordings (oldest first)
    if (result.freedBytes < spaceToFree) {
      const cleanupResult = await this.cleanupSyncedRecordings();
      result.deletedRecordings += cleanupResult.deletedRecordings;
      result.deletedTriageResults += cleanupResult.deletedTriageResults;
      result.freedBytes += cleanupResult.freedBytes;
    }

    // Strategy 2: Delete old recordings (older than 30 days)
    if (result.freedBytes < spaceToFree) {
      const cleanupResult = await this.cleanupOldRecordings(30);
      result.deletedRecordings += cleanupResult.deletedRecordings;
      result.deletedTriageResults += cleanupResult.deletedTriageResults;
      result.freedBytes += cleanupResult.freedBytes;
    }

    result.freedMB = result.freedBytes / (1024 * 1024);

    console.log('[QuotaManager] Cleanup complete:', result);
    return result;
  }

  // Cleanup synced recordings (already backed up to server)
  async cleanupSyncedRecordings(): Promise<CleanupResult> {
    const recordings = await getAllRecordings({ synced: true });

    // Sort by timestamp (oldest first)
    recordings.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let deletedRecordings = 0;
    let deletedTriageResults = 0;
    let freedBytes = 0;

    for (const recording of recordings) {
      try {
        // Estimate blob size (approximate)
        const blobSize = recording.audioBlob.size;

        // Delete associated triage results
        const triageResults = await getTriageResultsByRecording(recording.id);
        for (const result of triageResults) {
          await deleteTriageResult(result.id);
          deletedTriageResults++;
        }

        // Delete recording
        await deleteRecording(recording.id);
        deletedRecordings++;
        freedBytes += blobSize;

        console.log(`[QuotaManager] Deleted synced recording: ${recording.id}`);
      } catch (err) {
        console.error('[QuotaManager] Failed to delete recording:', err);
      }
    }

    return {
      deletedRecordings,
      deletedTriageResults,
      freedBytes,
      freedMB: freedBytes / (1024 * 1024),
    };
  }

  // Cleanup recordings older than N days
  async cleanupOldRecordings(olderThanDays: number): Promise<CleanupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    const recordings = await getAllRecordings();

    // Filter recordings older than cutoff
    const oldRecordings = recordings.filter(
      (r) => r.timestamp < cutoffISO && r.synced // Only delete if synced
    );

    let deletedRecordings = 0;
    let deletedTriageResults = 0;
    let freedBytes = 0;

    for (const recording of oldRecordings) {
      try {
        const blobSize = recording.audioBlob.size;

        // Delete associated triage results
        const triageResults = await getTriageResultsByRecording(recording.id);
        for (const result of triageResults) {
          await deleteTriageResult(result.id);
          deletedTriageResults++;
        }

        // Delete recording
        await deleteRecording(recording.id);
        deletedRecordings++;
        freedBytes += blobSize;

        console.log(`[QuotaManager] Deleted old recording: ${recording.id}`);
      } catch (err) {
        console.error('[QuotaManager] Failed to delete recording:', err);
      }
    }

    return {
      deletedRecordings,
      deletedTriageResults,
      freedBytes,
      freedMB: freedBytes / (1024 * 1024),
    };
  }

  // Ensure there's enough space for a new recording
  async ensureSpaceForNewRecording(sizeBytes: number): Promise<boolean> {
    const estimate = await this.getStorageEstimate();

    // Check if adding this recording would exceed quota
    if (estimate.usage + sizeBytes > this.limitBytes) {
      console.log('[QuotaManager] Not enough space, attempting cleanup...');

      // Try to free up space
      const cleanupResult = await this.enforceQuota();

      // Re-check after cleanup
      const newEstimate = await this.getStorageEstimate();
      if (newEstimate.usage + sizeBytes > this.limitBytes) {
        console.error('[QuotaManager] Still not enough space after cleanup');
        return false;
      }
    }

    return true;
  }

  // Calculate estimated recording size (based on duration and sample rate)
  estimateRecordingSize(durationSeconds: number, sampleRate: number): number {
    // WAV file size estimate: sample_rate * duration * 2 (16-bit) * channels (1 for mono)
    // Add 10% overhead for WAV headers and encoding
    const estimatedSize = sampleRate * durationSeconds * 2 * 1.1;
    return Math.ceil(estimatedSize);
  }

  // Get cleanup recommendations
  async getCleanupRecommendations(): Promise<{
    shouldCleanup: boolean;
    urgency: 'none' | 'low' | 'medium' | 'high';
    recommendations: string[];
    estimatedFreeable: number;
  }> {
    const estimate = await this.getStorageEstimate();
    const recordings = await getAllRecordings();
    const syncedRecordings = recordings.filter((r) => r.synced);

    // Calculate freeable space
    let estimatedFreeable = 0;
    syncedRecordings.forEach((r) => {
      estimatedFreeable += r.audioBlob.size;
    });

    const recommendations: string[] = [];
    let urgency: 'none' | 'low' | 'medium' | 'high' = 'none';
    let shouldCleanup = false;

    if (estimate.usagePercent >= 95) {
      urgency = 'high';
      shouldCleanup = true;
      recommendations.push('Critical: Storage almost full. Immediate cleanup required.');
      recommendations.push(`Delete ${syncedRecordings.length} synced recordings to free ${(estimatedFreeable / (1024 * 1024)).toFixed(1)}MB`);
    } else if (estimate.usagePercent >= 90) {
      urgency = 'medium';
      shouldCleanup = true;
      recommendations.push('Storage usage high. Cleanup recommended.');
      recommendations.push(`${syncedRecordings.length} synced recordings can be safely deleted`);
    } else if (estimate.usagePercent >= 75) {
      urgency = 'low';
      recommendations.push('Storage usage moderate. Consider cleanup soon.');
    } else {
      recommendations.push('Storage usage healthy. No action needed.');
    }

    return {
      shouldCleanup,
      urgency,
      recommendations,
      estimatedFreeable,
    };
  }

  // Set new storage limit
  setLimit(limitMB: number) {
    this.limitBytes = limitMB * 1024 * 1024;
    console.log(`[QuotaManager] Storage limit set to ${limitMB}MB`);
  }

  // Get current limit
  getLimit(): { bytes: number; mb: number } {
    return {
      bytes: this.limitBytes,
      mb: this.limitBytes / (1024 * 1024),
    };
  }
}

// Singleton instance
let quotaManagerInstance: QuotaManager | null = null;

export function getQuotaManager(limitMB?: number): QuotaManager {
  if (!quotaManagerInstance) {
    quotaManagerInstance = new QuotaManager(limitMB);
  }
  return quotaManagerInstance;
}

// Helper function to format bytes to human-readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
