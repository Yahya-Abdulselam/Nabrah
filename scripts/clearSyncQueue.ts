// Development Utility: Clear Sync Queue
// Run this in browser console to clear all pending sync items from IndexedDB

import { getSyncQueue, deleteSyncQueueItem } from '@/lib/db';

/**
 * Clears all items from the sync queue in IndexedDB
 * Useful for removing test data that causes unwanted API calls
 */
export async function clearSyncQueue() {
  try {
    const queue = await getSyncQueue();
    console.log(`[clearSyncQueue] Found ${queue.length} items in sync queue`);

    if (queue.length === 0) {
      console.log('[clearSyncQueue] Sync queue is already empty');
      return;
    }

    let deletedCount = 0;
    for (const item of queue) {
      if (item.id !== undefined) {
        await deleteSyncQueueItem(item.id);
        deletedCount++;
        console.log(`[clearSyncQueue] Deleted item ${item.id}: ${item.entity_type} ${item.entity_id}`);
      }
    }

    console.log(`[clearSyncQueue] Successfully cleared ${deletedCount} items from sync queue!`);
  } catch (error) {
    console.error('[clearSyncQueue] Failed to clear sync queue:', error);
    throw error;
  }
}

/**
 * Alternative: Clear entire NabrahDB database
 * WARNING: This will delete ALL data including recordings, triage results, queue patients, etc.
 */
export async function clearEntireDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('NabrahDB');

    request.onsuccess = () => {
      console.log('[clearEntireDatabase] Database deleted successfully');
      resolve();
    };

    request.onerror = () => {
      console.error('[clearEntireDatabase] Failed to delete database:', request.error);
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('[clearEntireDatabase] Database deletion blocked. Close all tabs and try again.');
    };
  });
}

// Browser console usage:
// 1. Import the function:
//    import { clearSyncQueue } from './scripts/clearSyncQueue';
//
// 2. Run it:
//    clearSyncQueue().then(() => console.log('Done!'));
//
// 3. Or clear entire DB:
//    clearEntireDatabase().then(() => location.reload());
