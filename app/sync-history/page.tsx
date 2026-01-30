'use client';

import { useState } from 'react';
import { useRecordings } from '@/lib/db/hooks';
import { useSyncStatus } from '@/lib/db/hooks';
import { useSync, useNetworkStatus } from '@/lib/sync/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Download,
  Cloud,
  CloudOff,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { formatBytes } from '@/lib/db/quotaManager';

export default function SyncHistoryPage() {
  const { recordings, loading: recordingsLoading, refresh: refreshRecordings } = useRecordings();
  const { syncQueue, stats, loading: syncLoading, refresh: refreshSync } = useSyncStatus();
  const { triggerSync, isSyncing } = useSync();
  const { isOnline } = useNetworkStatus();
  const [filter, setFilter] = useState<'all' | 'synced' | 'unsynced'>('all');

  const filteredRecordings = recordings.filter((r) => {
    if (filter === 'synced') return r.synced;
    if (filter === 'unsynced') return !r.synced;
    return true;
  });

  const handleSync = async () => {
    try {
      await triggerSync();
      await refreshRecordings();
      await refreshSync();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleRefresh = async () => {
    await refreshRecordings();
    await refreshSync();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Sync History
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your offline recordings and sync status
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={recordingsLoading || syncLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${recordingsLoading || syncLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>

              {isOnline && stats.pending > 0 && (
                <Button size="sm" onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Sync {stats.pending} Items
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Network Status Banner */}
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <>
                  <Cloud className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Online
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Data will sync automatically
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CloudOff className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Offline
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Data will sync when you're back online
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Synced</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Failed</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({recordings.length})
          </Button>
          <Button
            variant={filter === 'synced' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('synced')}
          >
            Synced ({recordings.filter((r) => r.synced).length})
          </Button>
          <Button
            variant={filter === 'unsynced' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unsynced')}
          >
            Unsynced ({recordings.filter((r) => !r.synced).length})
          </Button>
        </div>

        {/* Recordings List */}
        <div className="space-y-3">
          {recordingsLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 mx-auto animate-spin text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400 mt-2">Loading recordings...</p>
            </div>
          ) : filteredRecordings.length === 0 ? (
            <Card className="p-12 text-center">
              <CloudOff className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No recordings found</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Record a voice sample to see it here
              </p>
            </Card>
          ) : (
            filteredRecordings.map((recording) => (
              <Card key={recording.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={recording.synced ? 'default' : 'secondary'}>
                        {recording.synced ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Synced
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        )}
                      </Badge>

                      <Badge variant="outline">{recording.language.toUpperCase()}</Badge>

                      {recording.metadata.quality_is_reliable === false && (
                        <Badge variant="destructive">Poor Quality</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Duration:</span>{' '}
                        {recording.duration.toFixed(1)}s
                      </div>
                      <div>
                        <span className="font-medium">Size:</span>{' '}
                        {formatBytes(recording.audioBlob.size)}
                      </div>
                      {recording.metadata.snr_db && (
                        <div>
                          <span className="font-medium">SNR:</span>{' '}
                          {recording.metadata.snr_db.toFixed(1)} dB
                        </div>
                      )}
                      {recording.metadata.speech_percentage && (
                        <div>
                          <span className="font-medium">Speech:</span>{' '}
                          {recording.metadata.speech_percentage.toFixed(0)}%
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(recording.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Delete">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
