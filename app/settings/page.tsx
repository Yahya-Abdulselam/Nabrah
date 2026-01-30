'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Trash2,
  Download,
  HardDrive,
  Wifi,
  Database,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useStorageInfo } from '@/lib/db/hooks';
import { getQuotaManager, formatBytes } from '@/lib/db/quotaManager';
import { clearDB } from '@/lib/db';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { usageMB, quotaMB, usagePercent, refresh } = useStorageInfo();
  const [offlineMode, setOfflineMode] = useState(false);
  const [wifiOnlySync, setWifiOnlySync] = useState(false);
  const [storageLimitMB, setStorageLimitMB] = useState(100);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Load settings from localStorage
    const savedOfflineMode = localStorage.getItem('nabrah-offline-mode-enabled');
    const savedWifiOnly = localStorage.getItem('nabrah-wifi-only-sync');
    const savedLimit = localStorage.getItem('nabrah-storage-limit-mb');

    if (savedOfflineMode) setOfflineMode(savedOfflineMode === 'true');
    if (savedWifiOnly) setWifiOnlySync(savedWifiOnly === 'true');
    if (savedLimit) setStorageLimitMB(parseInt(savedLimit));
  }, []);

  const handleOfflineModeToggle = (enabled: boolean) => {
    setOfflineMode(enabled);
    localStorage.setItem('nabrah-offline-mode-enabled', enabled.toString());
  };

  const handleWifiOnlyToggle = (enabled: boolean) => {
    setWifiOnlySync(enabled);
    localStorage.setItem('nabrah-wifi-only-sync', enabled.toString());
  };

  const handleStorageLimitChange = (limit: number) => {
    setStorageLimitMB(limit);
    localStorage.setItem('nabrah-storage-limit-mb', limit.toString());

    const quotaManager = getQuotaManager();
    quotaManager.setLimit(limit);
  };

  const handleClearCache = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    try {
      await clearDB();
      localStorage.removeItem('nabrah-offline-mode-enabled');
      localStorage.removeItem('nabrah-wifi-only-sync');
      localStorage.removeItem('nabrah-storage-limit-mb');

      alert('All offline data cleared successfully');
      router.push('/');
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data. Please try again.');
    } finally {
      setShowClearConfirm(false);
    }
  };

  const handleExportData = async () => {
    // TODO: Implement data export
    alert('Data export feature coming soon');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Offline Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure offline mode and storage preferences
          </p>
        </div>

        {/* Storage Usage */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Storage Usage
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Used Storage</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {usageMB.toFixed(1)} MB / {quotaMB.toFixed(0)} MB
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usagePercent > 90
                      ? 'bg-red-600'
                      : usagePercent > 75
                      ? 'bg-yellow-600'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {usagePercent.toFixed(1)}% used
              </p>
            </div>

            {usagePercent > 90 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-900">
                    <p className="font-medium">Storage almost full</p>
                    <p className="text-xs mt-1">
                      Consider clearing old synced recordings or increasing the storage limit.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Storage Limit Selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Storage Limit
              </label>
              <select
                value={storageLimitMB}
                onChange={(e) => handleStorageLimitChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value={50}>50 MB</option>
                <option value={100}>100 MB (Default)</option>
                <option value={200}>200 MB</option>
                <option value={500}>500 MB</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Offline Mode Settings */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Wifi className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Offline Mode
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Always Use Offline Analysis
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Use client-side analysis even when online (faster but less accurate)
                </p>
              </div>
              <Switch checked={offlineMode} onCheckedChange={handleOfflineModeToggle} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  WiFi Only Sync
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Only sync data when connected to WiFi (saves mobile data)
                </p>
              </div>
              <Switch checked={wifiOnlySync} onCheckedChange={handleWifiOnlyToggle} />
            </div>
          </div>
        </Card>

        {/* Data Management */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Data Management
            </h2>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Data (JSON)
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={handleClearCache}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showClearConfirm ? 'Click Again to Confirm' : 'Clear All Offline Data'}
            </Button>

            {showClearConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-900">
                  ⚠️ This will permanently delete all offline recordings, triage results, and
                  queue data. This action cannot be undone.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Info */}
        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>Nabrah PWA v1.0.0</p>
          <p className="mt-1">
            Offline-first emergency voice triage system
          </p>
        </div>
      </div>
    </div>
  );
}
