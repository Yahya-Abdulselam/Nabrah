'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { QueueSummary } from '@/components/QueueSummary';
import { PatientList } from '@/components/PatientList';
import { Button } from '@/components/ui/button';
import { fetchQueue, downloadQueueCsv } from '@/lib/queueApi';
import { Patient, QueueStats, PatientStatus } from '@/lib/patientTypes';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Mic,
  AlertCircle
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n';

export default function QueuePage() {
  const { t, language } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    by_level: { RED: 0, YELLOW: 0, GREEN: 0 },
    by_status: { pending: 0, reviewing: 0, completed: 0, referred: 0 },
    active_count: 0,
    total_count: 0
  });
  const [statusFilter, setStatusFilter] = useState<PatientStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchQueue();
      setPatients(response.patients);
      setStats(response.stats);
    } catch (err) {
      console.error('Failed to load queue:', err);
      setError(err instanceof Error ? err.message : t('queue.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, [loadQueue]);

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
              <Button
                variant="outline"
                size="sm"
                onClick={loadQueue}
                disabled={loading}
                className={`cursor-pointer ${language === 'ar' ? 'font-arabic' : ''}`}
              >
                <RefreshCw className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'} ${loading ? 'animate-spin' : ''}`} />
                {t('queue.refresh')}
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
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center"
          >
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 dark:text-red-400 mb-4" />
            <h3 className={`text-lg font-medium text-red-800 dark:text-red-300 mb-2 ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t('queue.failedToLoad')}
            </h3>
            <p className={`text-red-600 dark:text-red-400 mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>{error}</p>
            <Button variant="outline" onClick={loadQueue} className={`cursor-pointer ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t('common.retry')}
            </Button>
          </motion.div>
        ) : (
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
              {loading && patients.length === 0 ? (
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
        )}
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
