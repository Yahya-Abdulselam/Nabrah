'use client';

import { QueueStats } from '@/lib/patientTypes';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface QueueSummaryProps {
  stats: QueueStats;
}

export function QueueSummary({ stats }: QueueSummaryProps) {
  const { t, language } = useLanguage();

  const summaryCards = [
    {
      label: t('queue.criticalRed'),
      count: stats.by_level.RED,
      icon: AlertCircle,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-400',
      iconColor: 'text-red-500 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    {
      label: t('queue.urgentYellow'),
      count: stats.by_level.YELLOW,
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      iconColor: 'text-yellow-500 dark:text-yellow-400',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    },
    {
      label: t('queue.routineGreen'),
      count: stats.by_level.GREEN,
      icon: CheckCircle,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-400',
      iconColor: 'text-green-500 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      label: t('queue.activeCases'),
      count: stats.active_count,
      icon: Users,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-400',
      iconColor: 'text-blue-500 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {summaryCards.map((card, index) => (
        <Card
          key={index}
          className={`${card.bgColor} ${card.borderColor} border-2`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium text-gray-600 dark:text-gray-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {card.label}
                </p>
                <p className={`text-3xl font-bold ${card.textColor}`}>
                  {card.count}
                </p>
              </div>
              <card.icon className={`h-8 w-8 ${card.iconColor}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
