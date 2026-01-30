'use client';

import { AlertCircle, WifiOff, Info } from 'lucide-react';
import { useNetworkStatus } from '@/lib/sync/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface OfflineBannerProps {
  variant?: 'info' | 'warning' | 'error';
  message?: string;
  showOnlineMessage?: boolean;
}

export function OfflineBanner({
  variant = 'warning',
  message,
  showOnlineMessage = true,
}: OfflineBannerProps) {
  const { isOnline, isOffline } = useNetworkStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    // Detect when connection is restored (transition from offline to online)
    if (!previousOnlineStatus.current && isOnline && showOnlineMessage) {
      // Show "back online" message
      setShowBackOnline(true);

      // Hide after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

    // Update previous status
    previousOnlineStatus.current = isOnline;
  }, [isOnline, showOnlineMessage]);

  // Show offline banner when offline
  if (isOffline) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-0 right-0 z-40 bg-yellow-50 border-b-2 border-yellow-400 px-4 py-3 shadow-lg"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900">
                {message || "You're offline"}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Recordings will be analyzed with simplified algorithms. Connect to internet for full Praat + Whisper analysis.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Show reconnected banner briefly (3 seconds) when coming back online
  if (showBackOnline) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-40 bg-green-50 border-b-2 border-green-400 px-4 py-3 shadow-lg"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <Info className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                Back online! Data will sync automatically.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}

// Analysis-specific offline banner
export function OfflineAnalysisBanner() {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-900">
            Offline Analysis - Limited Accuracy
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul className="list-disc list-inside space-y-1">
              <li>Uses simplified algorithms (no Praat or Whisper)</li>
              <li>Less accurate than online analysis</li>
              <li>Cannot detect all speech abnormalities</li>
              <li>No voice transcription available</li>
            </ul>
          </div>
          <p className="mt-3 text-sm font-medium text-yellow-800">
            💡 For best results, connect to the internet and reanalyze with full backend processing.
          </p>
        </div>
      </div>
    </div>
  );
}
