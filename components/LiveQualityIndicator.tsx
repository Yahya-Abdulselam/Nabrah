'use client';

/**
 * Live Quality Indicator Component
 *
 * Displays real-time audio quality metrics during recording:
 * - Volume level (RMS)
 * - SNR (Signal-to-Noise Ratio)
 * - Voice Activity percentage
 * - Clipping detection
 *
 * Updates every 100ms during recording
 */

import React from 'react';
import { Mic, Radio, Volume2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LiveQualityMetrics,
  formatQualityMetrics,
  getQualityColor,
} from '@/lib/audioQuality';

interface LiveQualityIndicatorProps {
  metrics: LiveQualityMetrics;
  isRecording: boolean;
}

export function LiveQualityIndicator({ metrics, isRecording }: LiveQualityIndicatorProps) {
  const formatted = formatQualityMetrics(metrics);
  const colors = getQualityColor(metrics.quality_level);

  // Get status icon
  const StatusIcon =
    metrics.quality_level === 'excellent' || metrics.quality_level === 'good'
      ? CheckCircle2
      : metrics.quality_level === 'acceptable'
      ? AlertTriangle
      : XCircle;

  // Volume bar color based on RMS
  const getVolumeColor = () => {
    if (metrics.rms_db > -20) return 'bg-green-500';
    if (metrics.rms_db > -30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // SNR color based on level
  const getSNRColor = () => {
    if (metrics.snr_estimate_db >= 25) return 'text-green-600';
    if (metrics.snr_estimate_db >= 20) return 'text-green-600';
    if (metrics.snr_estimate_db >= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  // VAD color based on percentage
  const getVADColor = () => {
    if (metrics.voice_activity_pct >= 70) return 'text-green-600';
    if (metrics.voice_activity_pct >= 60) return 'text-green-600';
    if (metrics.voice_activity_pct >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Clipping color
  const getClippingColor = () => {
    if (metrics.clipping_pct < 0.1) return 'text-green-600';
    if (metrics.clipping_pct < 1.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isRecording) {
    return null;
  }

  return (
    <Card className={`border-2 ${colors.border} ${colors.bg} transition-all duration-300`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className={`h-4 w-4 ${colors.icon}`} />
          Recording Quality
          <span className={`ml-auto text-sm font-medium ${colors.text}`}>
            {formatted.status}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Volume Level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Volume</span>
            </div>
            <span className={`font-semibold ${getVolumeColor().replace('bg-', 'text-')}`}>
              {formatted.volume}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all ${getVolumeColor()}`}
              style={{ width: `${Math.min(100, Math.max(0, (metrics.rms_db + 45) * 2.22))}%` }}
            />
          </div>
        </div>

        {/* SNR */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-gray-600" />
            <span className="font-medium">SNR</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${getSNRColor()}`}>
              {formatted.snr}
            </span>
            <StatusIcon className={`h-4 w-4 ${getSNRColor()}`} />
          </div>
        </div>

        {/* Voice Activity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Voice Activity</span>
            </div>
            <span className={`font-semibold ${getVADColor()}`}>
              {formatted.vad}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all ${
                metrics.voice_activity_pct >= 60
                  ? 'bg-green-500'
                  : metrics.voice_activity_pct >= 40
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, metrics.voice_activity_pct))}%` }}
            />
          </div>
        </div>

        {/* Clipping */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gray-600" />
            <span className="font-medium">Clipping</span>
          </div>
          <span className={`font-semibold ${getClippingColor()}`}>
            {formatted.clipping}
          </span>
        </div>

        {/* Recommendations */}
        {metrics.recommendations.length > 0 && (
          <div className="mt-4 rounded-md bg-white/50 p-3 space-y-1">
            {metrics.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-gray-400">•</span>
                <span>{recommendation}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for minimal UI
 */
export function CompactQualityIndicator({ metrics, isRecording }: LiveQualityIndicatorProps) {
  if (!isRecording) {
    return null;
  }

  const colors = getQualityColor(metrics.quality_level);
  const StatusIcon =
    metrics.quality_level === 'excellent' || metrics.quality_level === 'good'
      ? CheckCircle2
      : metrics.quality_level === 'acceptable'
      ? AlertTriangle
      : XCircle;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors.border} ${colors.bg}`}>
      <StatusIcon className={`h-4 w-4 ${colors.icon}`} />
      <span className={`text-sm font-medium ${colors.text}`}>
        {metrics.quality_level === 'excellent' ? 'Excellent' :
         metrics.quality_level === 'good' ? 'Good' :
         metrics.quality_level === 'acceptable' ? 'Acceptable' : 'Poor'}
      </span>
      <span className="text-xs text-gray-600">
        SNR: {Math.round(metrics.snr_estimate_db)} dB
      </span>
    </div>
  );
}
