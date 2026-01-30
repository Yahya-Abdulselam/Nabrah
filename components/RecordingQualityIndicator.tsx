'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

interface RecordingQualityIndicatorProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

type QualityLevel = 'good' | 'low' | 'very_low' | 'none';

interface QualityState {
  level: QualityLevel;
  rmsDb: number;
  message: string;
}

/**
 * Real-time recording quality indicator
 *
 * Shows volume level and quality feedback during recording:
 * - Green: Good signal (RMS > -20dB)
 * - Yellow: Low signal (RMS -30 to -20dB)
 * - Red: Very low/no signal (RMS < -30dB)
 */
export function RecordingQualityIndicator({
  analyserNode,
  isRecording
}: RecordingQualityIndicatorProps) {
  const [quality, setQuality] = useState<QualityState>({
    level: 'none',
    rmsDb: -60,
    message: 'Waiting for audio...'
  });

  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyserNode || !isRecording) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const dataArray = new Float32Array(analyserNode.fftSize);

    const updateQuality = () => {
      analyserNode.getFloatTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Convert to dB (with floor to prevent -Infinity)
      const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -60;

      // Determine quality level
      let level: QualityLevel;
      let message: string;

      if (rmsDb > -20) {
        level = 'good';
        message = 'Good volume level';
      } else if (rmsDb > -30) {
        level = 'low';
        message = 'Speak a bit louder';
      } else if (rmsDb > -45) {
        level = 'very_low';
        message = 'Too quiet - speak louder';
      } else {
        level = 'none';
        message = 'No audio detected';
      }

      setQuality({ level, rmsDb, message });

      animationFrameRef.current = requestAnimationFrame(updateQuality);
    };

    updateQuality();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isRecording]);

  if (!isRecording) {
    return null;
  }

  const getColors = () => {
    switch (quality.level) {
      case 'good':
        return {
          bg: 'bg-green-100',
          border: 'border-green-500',
          text: 'text-green-700',
          icon: 'text-green-600',
          bar: 'bg-green-500'
        };
      case 'low':
        return {
          bg: 'bg-yellow-100',
          border: 'border-yellow-500',
          text: 'text-yellow-700',
          icon: 'text-yellow-600',
          bar: 'bg-yellow-500'
        };
      case 'very_low':
      case 'none':
      default:
        return {
          bg: 'bg-red-100',
          border: 'border-red-500',
          text: 'text-red-700',
          icon: 'text-red-600',
          bar: 'bg-red-500'
        };
    }
  };

  const colors = getColors();

  // Normalize RMS for visual display (map -60 to 0 dB to 0-100%)
  const normalizedLevel = Math.max(0, Math.min(100, ((quality.rmsDb + 60) / 60) * 100));

  const VolumeIcon = quality.level === 'good'
    ? Volume2
    : quality.level === 'low'
      ? Volume1
      : VolumeX;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        w-full p-3 rounded-lg border-2
        ${colors.bg} ${colors.border}
      `}
    >
      <div className="flex items-center gap-3">
        <VolumeIcon className={`w-5 h-5 ${colors.icon}`} />

        {/* Volume meter */}
        <div className="flex-1">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${colors.bar} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${normalizedLevel}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Level indicator bars */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((bar) => {
            const threshold = bar * 20; // 20, 40, 60, 80, 100
            const isActive = normalizedLevel >= threshold - 10;
            return (
              <motion.div
                key={bar}
                className={`
                  w-1 rounded-sm
                  ${isActive ? colors.bar : 'bg-gray-300'}
                `}
                style={{ height: `${8 + bar * 2}px` }}
                animate={{
                  opacity: isActive ? 1 : 0.4,
                  scale: isActive ? 1 : 0.9
                }}
                transition={{ duration: 0.1 }}
              />
            );
          })}
        </div>
      </div>

      {/* Status message */}
      <p className={`text-xs mt-2 ${colors.text} font-medium`}>
        {quality.message}
      </p>
    </motion.div>
  );
}
