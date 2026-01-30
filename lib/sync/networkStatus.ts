// Network Status Manager
// Monitors online/offline status and triggers sync

import { getSyncManager } from './syncManager';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface NetworkStatusEvent {
  status: NetworkStatus;
  timestamp: Date;
  previousStatus?: NetworkStatus;
}

export class NetworkStatusManager {
  private currentStatus: NetworkStatus = 'unknown';
  private listeners: Set<(event: NetworkStatusEvent) => void> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    // Initialize status
    this.currentStatus = navigator.onLine ? 'online' : 'offline';

    // Setup event listeners
    this.setupListeners();

    console.log(`[NetworkStatus] Initial status: ${this.currentStatus}`);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    // Online event
    window.addEventListener('online', this.handleOnline.bind(this));

    // Offline event
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Visibility change (check status when tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkStatus();
      }
    });

    // Periodic status check (every 30 seconds when online)
    setInterval(() => {
      if (this.currentStatus === 'online') {
        this.checkStatus();
      }
    }, 30000);
  }

  private handleOnline(): void {
    console.log('[NetworkStatus] Browser reports online');
    const previousStatus = this.currentStatus;
    this.currentStatus = 'online';
    this.reconnectAttempts = 0;

    // Emit status change event
    this.emit({
      status: 'online',
      timestamp: new Date(),
      previousStatus,
    });

    // Trigger sync after coming online
    this.scheduleSync();
  }

  private handleOffline(): void {
    console.log('[NetworkStatus] Browser reports offline');
    const previousStatus = this.currentStatus;
    this.currentStatus = 'offline';

    this.emit({
      status: 'offline',
      timestamp: new Date(),
      previousStatus,
    });
  }

  // Check actual network status (ping backend)
  async checkStatus(): Promise<NetworkStatus> {
    try {
      const syncManager = getSyncManager();
      const isOnline = await syncManager.isOnline();

      const newStatus: NetworkStatus = isOnline ? 'online' : 'offline';

      if (newStatus !== this.currentStatus) {
        console.log(`[NetworkStatus] Status changed: ${this.currentStatus} → ${newStatus}`);
        const previousStatus = this.currentStatus;
        this.currentStatus = newStatus;

        this.emit({
          status: newStatus,
          timestamp: new Date(),
          previousStatus,
        });

        if (newStatus === 'online') {
          this.scheduleSync();
        }
      }

      return newStatus;
    } catch (error) {
      console.error('[NetworkStatus] Status check failed:', error);
      return this.currentStatus;
    }
  }

  // Get current status
  isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  // Schedule sync when online
  scheduleSync(delayMs: number = 2000): void {
    if (this.currentStatus !== 'online') {
      console.log('[NetworkStatus] Cannot schedule sync: offline');
      return;
    }

    console.log(`[NetworkStatus] Scheduling sync in ${delayMs}ms...`);

    setTimeout(async () => {
      try {
        const syncManager = getSyncManager();
        await syncManager.syncAll();
      } catch (error) {
        console.error('[NetworkStatus] Auto-sync failed:', error);
        this.handleSyncFailure();
      }
    }, delayMs);
  }

  // Handle sync failure (retry with exponential backoff)
  private handleSyncFailure(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[NetworkStatus] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const backoffDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(
      `[NetworkStatus] Retry sync in ${backoffDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.scheduleSync(backoffDelay);
  }

  // Event listeners
  onOnline(callback: () => void): void {
    const listener = (event: NetworkStatusEvent) => {
      if (event.status === 'online') {
        callback();
      }
    };
    this.listeners.add(listener as any);
  }

  onOffline(callback: () => void): void {
    const listener = (event: NetworkStatusEvent) => {
      if (event.status === 'offline') {
        callback();
      }
    };
    this.listeners.add(listener as any);
  }

  onChange(callback: (event: NetworkStatusEvent) => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: (event: NetworkStatusEvent) => void): void {
    this.listeners.delete(callback);
  }

  private emit(event: NetworkStatusEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  // Cleanup
  destroy(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    this.listeners.clear();
  }
}

// Singleton instance
let networkStatusInstance: NetworkStatusManager | null = null;

export function getNetworkStatusManager(): NetworkStatusManager {
  if (!networkStatusInstance) {
    networkStatusInstance = new NetworkStatusManager();
  }
  return networkStatusInstance;
}
