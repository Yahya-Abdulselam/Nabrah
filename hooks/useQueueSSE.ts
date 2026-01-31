'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueueStore, Patient } from '@/lib/queueStore';
import { getAllPatients } from '@/lib/queueApi';

interface UseQueueSSEReturn {
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const SSE_ENDPOINT = `${API_URL}/queue/events`;
const POLLING_FALLBACK_INTERVAL = 5000; // 5 seconds

export function useQueueSSE(): UseQueueSSEReturn {
  const pathname = usePathname();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const { setPatients, setLoading, setError: setStoreError } = useQueueStore();

  // Polling fallback when SSE is unavailable
  const startPolling = useCallback(() => {
    console.log('[useQueueSSE] Starting polling fallback (every 5s)');

    const poll = async () => {
      try {
        const patients = await getAllPatients();
        setPatients(patients);
        setError(null);
      } catch (err) {
        console.error('[useQueueSSE] Polling error:', err);
        setError('Failed to fetch queue updates');
        setStoreError('Failed to fetch queue updates');
      }
    };

    // Initial poll
    poll();

    // Set up interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(poll, POLLING_FALLBACK_INTERVAL);
  }, [setPatients, setError, setStoreError]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[useQueueSSE] Stopping polling fallback');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Stop polling if active
    stopPolling();

    try {
      console.log('[useQueueSSE] Connecting to SSE endpoint:', SSE_ENDPOINT);
      const eventSource = new EventSource(SSE_ENDPOINT);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useQueueSSE] ✓ SSE connection opened');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0; // Reset reconnect counter
      };

      eventSource.addEventListener('queue_update', (event) => {
        try {
          const patients: Patient[] = JSON.parse(event.data);
          console.log('[useQueueSSE] Received queue update:', patients.length, 'patients');
          setPatients(patients);
          setError(null);
        } catch (err) {
          console.error('[useQueueSSE] Failed to parse SSE data:', err);
        }
      });

      eventSource.onerror = (err) => {
        console.error('[useQueueSSE] SSE connection error:', err);
        setIsConnected(false);
        eventSource.close();

        // Exponential backoff reconnection
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Max 30s

        if (reconnectAttemptsRef.current <= 5) {
          console.log(`[useQueueSSE] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current}/5)...`);
          setError(`Connection lost. Reconnecting in ${delay / 1000}s...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log('[useQueueSSE] Max reconnect attempts reached. Falling back to polling.');
          setError('Real-time updates unavailable. Using polling mode.');
          startPolling();
        }
      };
    } catch (err) {
      console.error('[useQueueSSE] Failed to create EventSource:', err);
      setError('Failed to connect. Using polling mode.');
      setIsConnected(false);
      startPolling();
    }
  }, [setPatients, setError, stopPolling, startPolling]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    console.log('[useQueueSSE] Manual reconnect triggered');
    reconnectAttemptsRef.current = 0;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    connect();
  }, [connect]);

  // Initialize connection on mount - but ONLY on /queue page
  useEffect(() => {
    // Route guard: Only connect SSE on /queue page
    if (pathname !== '/queue') {
      console.log('[useQueueSSE] Not on /queue page, skipping SSE connection');
      setLoading(false);
      return;
    }

    console.log('[useQueueSSE] On /queue page, initializing SSE connection');
    setLoading(true);
    connect();

    // Cleanup on unmount
    return () => {
      console.log('[useQueueSSE] Cleaning up SSE connection');

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setLoading(false);
    };
  }, [connect, setLoading, pathname]);

  return {
    isConnected,
    error,
    reconnect,
  };
}
