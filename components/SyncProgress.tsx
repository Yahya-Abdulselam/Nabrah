'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle, XCircle, Cloud } from 'lucide-react';
import { useSync } from '@/lib/sync/hooks';
import { Progress } from './ui/progress';
import { useState, useEffect } from 'react';

export function SyncProgress() {
  const { isSyncing, syncProgress, lastSyncResult, syncError } = useSync();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.success && !isSyncing) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000); // Dismiss after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [lastSyncResult, isSyncing]);

  // Auto-dismiss error message after 5 seconds
  useEffect(() => {
    if (syncError && !isSyncing) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 5000); // Dismiss after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [syncError, isSyncing]);

  // Don't show if not syncing and no active notifications
  if (!isSyncing && !showSuccess && !showError) {
    return null;
  }

  return (
    <AnimatePresence>
      {isSyncing && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Syncing data...
                </h3>
                {syncProgress && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {syncProgress.current} of {syncProgress.total} items
                    {syncProgress.currentItem && (
                      <span className="block truncate">
                        {syncProgress.currentItem}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <span className="text-sm font-medium text-blue-600">
                {syncProgress?.percentage.toFixed(0) || 0}%
              </span>
            </div>

            {syncProgress && (
              <Progress value={syncProgress.percentage} className="h-2" />
            )}
          </div>
        </motion.div>
      )}

      {/* Success message */}
      {showSuccess && lastSyncResult && lastSyncResult.success && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow-lg border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                  Sync complete!
                </h3>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {lastSyncResult.syncedItems} items synced successfully
                </p>
              </div>
              <button
                onClick={() => setShowSuccess(false)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error message */}
      {showError && syncError && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-lg border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-900 dark:text-red-100">
                  Sync failed
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  {syncError.message}
                </p>
              </div>
              <button
                onClick={() => setShowError(false)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Compact sync status for header
export function SyncStatusBadge() {
  const { isSyncing, syncProgress } = useSync();

  if (!isSyncing) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300">
      <Cloud className="h-3 w-3 animate-pulse" />
      <span>
        Syncing{syncProgress && ` (${syncProgress.percentage.toFixed(0)}%)`}
      </span>
    </div>
  );
}
