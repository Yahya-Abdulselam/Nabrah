'use client';

import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '@/lib/sync/hooks';
import { Badge } from './ui/badge';
import { useState, useEffect, useRef } from 'react';

export function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    // Detect when connection is restored (transition from offline to online)
    if (!previousOnlineStatus.current && isOnline) {
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
  }, [isOnline]);

  // Show offline badge if offline
  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge
          variant="destructive"
          className="flex items-center gap-2 px-3 py-2 shadow-lg"
        >
          <WifiOff className="h-4 w-4" />
          <span>Offline</span>
        </Badge>
      </div>
    );
  }

  // Show "back online" message briefly (3 seconds)
  if (showBackOnline) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge
          variant="default"
          className="flex items-center gap-2 px-3 py-2 shadow-lg bg-green-600 hover:bg-green-700"
        >
          <Wifi className="h-4 w-4" />
          <span>Back Online</span>
        </Badge>
      </div>
    );
  }

  // Show nothing when online (after the brief "back online" message disappears)
  return null;
}
