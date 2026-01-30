'use client';

import { useEffect, useState } from 'react';

interface ServiceWorkerRegistrationState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function ServiceWorkerRegistration() {
  const [swState, setSwState] = useState<ServiceWorkerRegistrationState>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    registration: null,
  });

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    setSwState((prev) => ({ ...prev, isSupported: true }));

    // Register service worker
    registerServiceWorker();

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] Service worker controller changed - reloading page');
      window.location.reload();
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[App] Service worker registered:', registration.scope);

      setSwState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
      }));

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log('[App] Service worker update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker installed, update available
            console.log('[App] Service worker update available');
            setSwState((prev) => ({ ...prev, isUpdateAvailable: true }));
          }
        });
      });

      // Check for updates periodically (every 1 hour)
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      // Register periodic background sync (if supported)
      if ('periodicSync' in registration) {
        try {
          // @ts-ignore - periodicSync types not yet in TypeScript
          await registration.periodicSync.register('periodic-sync-nabrah', {
            minInterval: 12 * 60 * 60 * 1000, // 12 hours
          });
          console.log('[App] Periodic background sync registered');
        } catch (error) {
          console.log('[App] Periodic background sync not available:', error);
        }
      }

      // Register background sync for data sync
      if ('sync' in registration) {
        // Sync will be triggered when online
        console.log('[App] Background sync available');
      }

    } catch (error) {
      console.error('[App] Service worker registration failed:', error);
    }
  };

  const handleSWMessage = (event: MessageEvent) => {
    console.log('[App] Message from service worker:', event.data);

    if (event.data.type === 'SYNC_REQUESTED') {
      // Service worker requested a sync - trigger sync manager
      const syncEvent = new CustomEvent('sw-sync-requested', {
        detail: { timestamp: event.data.timestamp },
      });
      window.dispatchEvent(syncEvent);
    }
  };

  const handleUpdateClick = () => {
    if (!swState.registration?.waiting) return;

    // Tell the waiting service worker to skip waiting
    swState.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Page will reload automatically via controllerchange event
  };

  // Show update notification UI
  if (swState.isUpdateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <div>
          <p className="font-medium">Update Available</p>
          <p className="text-sm text-blue-100">A new version of Nabrah is ready</p>
        </div>
        <button
          onClick={handleUpdateClick}
          className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
        >
          Update
        </button>
      </div>
    );
  }

  // No UI needed when everything is normal
  return null;
}

// Hook for components to interact with service worker
export function useServiceWorker() {
  const [isOnline, setIsOnline] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set initial online status
    setIsOnline(navigator.onLine);

    // Get service worker registration
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
    });

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    if (!registration) {
      console.warn('[App] Service worker not registered yet');
      return;
    }

    if ('sync' in registration) {
      try {
        // @ts-ignore - sync types not yet in TypeScript
        await registration.sync.register('sync-nabrah-data');
        console.log('[App] Background sync registered');
      } catch (error) {
        console.error('[App] Background sync failed:', error);
      }
    }
  };

  const cacheUrls = async (urls: string[]): Promise<boolean> => {
    if (!registration?.active) {
      console.warn('[App] Service worker not active');
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };

      registration.active.postMessage(
        { type: 'CACHE_URLS', urls },
        [messageChannel.port2]
      );
    });
  };

  const clearCache = async (): Promise<boolean> => {
    if (!registration?.active) {
      console.warn('[App] Service worker not active');
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };

      registration.active.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  };

  return {
    isOnline,
    registration,
    triggerSync,
    cacheUrls,
    clearCache,
  };
}
