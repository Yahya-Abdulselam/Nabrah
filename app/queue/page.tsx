'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { QueueSummary } from '@/components/QueueSummary';
import { PatientList } from '@/components/PatientList';
import { Button } from '@/components/ui/button';
import { fetchQueue, downloadQueueCsv } from '@/lib/queueApi';
import { QueueStats, PatientStatus } from '@/lib/patientTypes';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Mic,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n';
import { useQueueStore } from '@/lib/queueStore';
import { useQueueSSE } from '@/hooks/useQueueSSE';
import { useQueueSync } from '@/hooks/useQueueSync';

export default function QueuePage() {
  const { t, language } = useLanguage();

  // Use Zustand store for queue state
  const { patients, isLoading, error: storeError } = useQueueStore();

  // Initialize SSE connection for real-time updates
  const { isConnected, error: sseError, reconnect } = useQueueSSE();

  // Initialize multi-tab sync
  const queueSync = useQueueSync();

  const [stats, setStats] = useState<QueueStats>({
    by_level: { RED: 0, YELLOW: 0, GREEN: 0 },
    by_status: { pending: 0, reviewing: 0, completed: 0, referred: 0 },
    active_count: 0,
    total_count: 0
  });
  const [statusFilter, setStatusFilter] = useState<PatientStatus | 'all'>('all');
  const [exporting, setExporting] = useState(false);

  // Calculate stats from patients
  useEffect(() => {
    const newStats: QueueStats = {
      by_level: { RED: 0, YELLOW: 0, GREEN: 0 },
      by_status: { pending: 0, reviewing: 0, completed: 0, referred: 0 },
      active_count: 0,
      total_count: patients.length
    };

    patients.forEach(p => {
      if (p.triage_level) newStats.by_level[p.triage_level]++;
      // if (p.status) newStats.by_status[p.status]++;
    });

    setStats(newStats);
  }, [patients]);

  // Manual refresh (fallback)
  const loadQueue = useCallback(async () => {
    try {
      const response = await fetchQueue();
      useQueueStore.getState().setPatients(response.patients);
      queueSync.broadcastQueueRefreshed(response.patients);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  }, [queueSync]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadQueueCsv();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {/* Theme Toggle and Language Switcher - Fixed position */}
      <div className="fixed z-50 flex gap-2 ltr-force" style={{ top: '1rem', right: '1rem' }}>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className={`cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  <ArrowLeft className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                  {t('common.backToHome')}
                </Button>
              </Link>
              <div>
                <h1 className={`text-2xl font-bold text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('queue.title')}
                </h1>
                <p className={`text-sm text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('queue.subtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-12">
              {/* Connection status indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                isConnected
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
              } ${language === 'ar' ? 'font-arabic' : ''}`}>
                {isConnected ? (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>Polling</span>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={isConnected ? loadQueue : reconnect}
                disabled={isLoading}
                className={`cursor-pointer ${language === 'ar' ? 'font-arabic' : ''}`}
              >
                <RefreshCw className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'} ${isLoading ? 'animate-spin' : ''}`} />
                {isConnected ? t('queue.refresh') : 'Reconnect'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || patients.length === 0}
                className={`cursor-pointer ${language === 'ar' ? 'font-arabic' : ''}`}
              >
                <Download className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {t('queue.exportCsv')}
              </Button>
              <Link href="/">
                <Button size="sm" className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  <Mic className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                  {t('queue.newCheck')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {storeError || sseError ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6"
          >
            <AlertCircle className="h-8 w-8 mx-auto text-yellow-500 dark:text-yellow-400 mb-2" />
            <p className={`text-center text-yellow-800 dark:text-yellow-300 text-sm ${language === 'ar' ? 'font-arabic' : ''}`}>
              {storeError || sseError}
            </p>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
            {/* Summary cards */}
            <section>
              <h2 className={`text-lg font-semibold text-slate-800 dark:text-white mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('queue.overview')}
              </h2>
              <QueueSummary stats={stats} />
            </section>

            {/* Patient list */}
            <section>
              <h2 className={`text-lg font-semibold text-slate-800 dark:text-white mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('queue.patients')}
              </h2>
              {isLoading && patients.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-500 animate-spin mb-4" />
                  <p className={`text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('queue.loading')}
                  </p>
                </div>
              ) : (
                <PatientList
                  patients={patients}
                  statusFilter={statusFilter}
                  onFilterChange={setStatusFilter}
                  onRefresh={loadQueue}
                />
              )}
            </section>
          </motion.div>
        </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 mt-auto py-4">
        <div className={`max-w-7xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
          <p>
            {t('queue.title')} •{' '}
            <span className="text-slate-400 dark:text-slate-500">
              {t('queue.autoRefresh')}
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
