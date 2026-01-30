'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AudioFeatures, getFeatureThresholds, formatFeatureValue } from '@/lib/triageLogic';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface FeatureDashboardProps {
  features: AudioFeatures;
}

export function FeatureDashboard({ features }: FeatureDashboardProps) {
  const featureData = getFeatureThresholds(features);

  return (
    <Card className="p-6 bg-white dark:bg-gray-800 border-2 dark:border-gray-700">
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        Acoustic Feature Analysis
      </h3>

      <div className="space-y-6">
        {featureData.map((feature) => {
          // Determine if value is abnormal
          const isAbnormal = feature.inverse
            ? feature.value < feature.threshold
            : feature.value > feature.threshold;

          // Calculate percentage for progress bar
          let percentage: number;
          if (feature.inverse) {
            // For inverse features (lower is worse), show relative to threshold
            percentage = Math.min(100, (feature.value / feature.threshold) * 100);
          } else {
            // For normal features (higher is worse), show relative to threshold
            percentage = Math.min(100, (feature.value / (feature.threshold * 1.5)) * 100);
          }

          return (
            <div key={feature.name} className="space-y-2">
              {/* Feature Name and Value */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{feature.name}</span>
                  {isAbnormal ? (
                    <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                  )}
                </div>
                <span className={`font-semibold ${isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatFeatureValue(feature.value, feature.unit)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <Progress
                  value={percentage}
                  className={`h-3 ${isAbnormal ? '[&>div]:bg-red-500 dark:[&>div]:bg-red-400' : '[&>div]:bg-green-500 dark:[&>div]:bg-green-400'}`}
                />
                {/* Threshold Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500"
                  style={{
                    left: feature.inverse
                      ? '100%'
                      : `${Math.min(100, (feature.threshold / (feature.threshold * 1.5)) * 100)}%`
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full" />
                </div>
              </div>

              {/* Description and Threshold */}
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{feature.description}</span>
                <span>
                  Threshold: {formatFeatureValue(feature.threshold, feature.unit)}
                </span>
              </div>

              {/* Status Message */}
              {isAbnormal && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 text-xs text-red-800 dark:text-red-300">
                  ⚠️ Value {feature.inverse ? 'below' : 'above'} normal threshold
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded" />
            <span className="text-gray-600 dark:text-gray-400">Normal range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 dark:bg-red-400 rounded" />
            <span className="text-gray-600 dark:text-gray-400">Abnormal range</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Activity icon component (lucide-react import)
function Activity({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
