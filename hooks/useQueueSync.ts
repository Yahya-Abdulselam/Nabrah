'use client';

import { useEffect, useRef } from 'react';
import { useQueueStore, Patient } from '@/lib/queueStore';

const CHANNEL_NAME = 'nabrah_queue_sync';

interface QueueSyncMessage {
  type: 'patient_added' | 'patient_removed' | 'patient_updated' | 'queue_refreshed';
  payload?: any;
}

/**
 * Hook for synchronizing queue state across browser tabs using BroadcastChannel API.
 *
 * Usage:
 *   useQueueSync();
 *
 * Features:
 *   - Broadcasts queue changes to all tabs
 *   - Receives updates from other tabs
 *   - Falls back gracefully if BroadcastChannel not supported
 */
export function useQueueSync() {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const { setPatients, addPatient, removePatient } = useQueueStore();

  useEffect(() => {
    // Check if BroadcastChannel is supported
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      console.log('[useQueueSync] BroadcastChannel not supported. Multi-tab sync disabled.');
      return;
    }

    try {
      console.log('[useQueueSync] Initializing multi-tab sync');
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      // Listen for messages from other tabs
      channel.onmessage = (event: MessageEvent<QueueSyncMessage>) => {
        const { type, payload } = event.data;
        console.log('[useQueueSync] Received message from another tab:', type, payload);

        switch (type) {
          case 'patient_added':
            if (payload?.patient) {
              addPatient(payload.patient);
            }
            break;

          case 'patient_removed':
            if (payload?.patientId) {
              // Use store's removePatient but skip broadcast (to avoid loops)
              const state = useQueueStore.getState();
              const updatedPatients = state.patients.filter(p => p.id !== payload.patientId);
              setPatients(updatedPatients);
            }
            break;

          case 'queue_refreshed':
            if (payload?.patients) {
              setPatients(payload.patients);
            }
            break;

          default:
            console.warn('[useQueueSync] Unknown message type:', type);
        }
      };

      channel.onerror = (error) => {
        console.error('[useQueueSync] BroadcastChannel error:', error);
      };

      console.log('[useQueueSync] ✓ Multi-tab sync initialized');
    } catch (error) {
      console.error('[useQueueSync] Failed to initialize BroadcastChannel:', error);
    }

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        console.log('[useQueueSync] Closing BroadcastChannel');
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [setPatients, addPatient, removePatient]);

  // Helper functions to broadcast changes (exported for use in components)
  return {
    broadcastPatientAdded: (patient: Patient) => {
      if (channelRef.current) {
        const message: QueueSyncMessage = {
          type: 'patient_added',
          payload: { patient },
        };
        channelRef.current.postMessage(message);
        console.log('[useQueueSync] Broadcasted patient_added:', patient.id);
      }
    },

    broadcastPatientRemoved: (patientId: string) => {
      if (channelRef.current) {
        const message: QueueSyncMessage = {
          type: 'patient_removed',
          payload: { patientId },
        };
        channelRef.current.postMessage(message);
        console.log('[useQueueSync] Broadcasted patient_removed:', patientId);
      }
    },

    broadcastQueueRefreshed: (patients: Patient[]) => {
      if (channelRef.current) {
        const message: QueueSyncMessage = {
          type: 'queue_refreshed',
          payload: { patients },
        };
        channelRef.current.postMessage(message);
        console.log('[useQueueSync] Broadcasted queue_refreshed:', patients.length, 'patients');
      }
    },
  };
}
