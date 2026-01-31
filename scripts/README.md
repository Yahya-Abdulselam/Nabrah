# Development Scripts

This folder contains utility scripts for development and debugging.

## Clear Sync Queue

The `clearSyncQueue.ts` utility helps remove test data from IndexedDB that causes unwanted API calls on page load.

### Quick Method: Browser Console

Open your browser's DevTools console and paste:

```javascript
// Option 1: Clear just the sync queue (recommended)
(async () => {
  const db = await indexedDB.open('NabrahDB', 1);
  const tx = db.transaction('sync_queue', 'readwrite');
  await tx.objectStore('sync_queue').clear();
  console.log('✅ Sync queue cleared!');
  location.reload();
})();
```

```javascript
// Option 2: Clear entire database (WARNING: deletes all data)
indexedDB.deleteDatabase('NabrahDB');
location.reload();
```

### Using the TypeScript Utility

1. Add the utility to a component temporarily:

```typescript
import { clearSyncQueue } from '@/scripts/clearSyncQueue';

// Call it in useEffect or a button click handler
useEffect(() => {
  clearSyncQueue();
}, []);
```

2. Reload the page after clearing

### When to Use This

- You see unwanted POST `/api/analyze` requests on page load
- Console shows `[SyncManager] Analysis failed` errors
- Test recordings with "Yep...." or other test data appear in sync queue

### Verification

After clearing the sync queue:

1. Open DevTools → Application → IndexedDB → NabrahDB → sync_queue
2. Verify the table is empty
3. Reload the page
4. Verify no POST `/api/analyze` requests in Network tab
