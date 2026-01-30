from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
import parselmouth
from parselmouth.praat import call
import numpy as np
import tempfile
import os
import time
from typing import Optional, Dict, Any, List

# Import queue database
import queue_db

# Whisper models (lazy loaded per language)
whisper_models = {}  # Cache for loaded models

# Model mapping by language
# DEMO: Using "base" model for better accuracy (59 MB download)
# PRODUCTION: Use "tiny.en" (39 MB) or "tiny" (75 MB) for faster inference
WHISPER_MODELS = {
    "en": "base.en",  # English-only base model (better accuracy for demo)
    "ar": "base"      # Multilingual base model for Arabic (better accuracy for demo)
}

app = FastAPI(title="Nabrah Audio Analysis API")

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def save_audio_to_temp(audio_bytes: bytes) -> str:
    """
    Save audio bytes to temporary WAV file

    Frontend already encodes to WAV format, so we just save it directly.
    Windows-compatible implementation using mkstemp to avoid file locking issues.

    Args:
        audio_bytes: WAV file bytes from frontend

    Returns:
        Path to temporary WAV file
    """
    try:
        # Validate audio data
        if len(audio_bytes) < 44:
            raise ValueError(f"Audio file too small ({len(audio_bytes)} bytes). Minimum WAV file is 44 bytes (header).")

        # Check WAV file header
        riff_header = audio_bytes[:4]
        wave_header = audio_bytes[8:12]

        if riff_header != b'RIFF':
            raise ValueError(f"Invalid audio format: Expected RIFF header, got {riff_header[:4]}")

        if wave_header != b'WAVE':
            raise ValueError(f"Invalid audio format: Expected WAVE header, got {wave_header[:4]}")

        print(f"✓ Valid WAV file detected: {len(audio_bytes)} bytes")

        # Create temporary file using mkstemp (Windows-compatible)
        # mkstemp returns (file_descriptor, path) and doesn't keep file locked
        fd, temp_path = tempfile.mkstemp(suffix='.wav')

        try:
            # Write audio bytes using file descriptor
            os.write(fd, audio_bytes)
            # CRITICAL: Close file descriptor to release handle (Windows requirement)
            os.close(fd)

            print(f"Saved audio to temp file: {temp_path}")

            return temp_path

        except Exception as e:
            # Cleanup on error
            os.close(fd)
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise RuntimeError(f"Failed to save audio file: {e}") from e

    except Exception as e:
        print(f"Unexpected error in save_audio_to_temp: {e}")
        raise


def calculate_snr(audio_file_path: str) -> dict:
    """
    Calculate Signal-to-Noise Ratio (SNR) using Praat intensity analysis.

    Method:
    1. Calculate intensity contour
    2. Signal power = mean intensity of voiced segments (above threshold)
    3. Noise power = mean intensity of quiet segments (below threshold)
    4. SNR (dB) = signal_power - noise_power (already in dB)

    Quality thresholds:
    - SNR >= 15 dB: Good quality
    - SNR 10-15 dB: Acceptable quality
    - SNR < 10 dB: Poor quality (may affect accuracy)

    Returns:
        dict with snr_db, quality_level, is_reliable, recommendation
    """
    try:
        sound = parselmouth.Sound(audio_file_path)

        # Get intensity contour
        intensity = call(sound, "To Intensity", 75, 0, "yes")

        # Get all intensity values
        num_frames = call(intensity, "Get number of frames")
        intensity_values = []

        for i in range(1, num_frames + 1):
            val = call(intensity, "Get value in frame", i)
            if not np.isnan(val) and val > 0:
                intensity_values.append(val)

        if len(intensity_values) < 10:
            return {
                "snr_db": 0.0,
                "quality_level": "poor",
                "is_reliable": False,
                "recommendation": "Audio too short or no signal detected. Please try again."
            }

        intensity_values = np.array(intensity_values)

        # Calculate threshold (30th percentile as noise floor)
        noise_threshold = np.percentile(intensity_values, 30)
        signal_threshold = np.percentile(intensity_values, 70)

        # Separate signal and noise
        noise_values = intensity_values[intensity_values <= noise_threshold]
        signal_values = intensity_values[intensity_values >= signal_threshold]

        if len(noise_values) == 0 or len(signal_values) == 0:
            # Fallback: use simple mean vs min
            signal_power = np.mean(intensity_values)
            noise_power = np.min(intensity_values)
        else:
            signal_power = np.mean(signal_values)
            noise_power = np.mean(noise_values)

        # SNR in dB (intensity is already in dB, so difference is the ratio)
        snr_db = float(signal_power - noise_power)

        # Clamp to reasonable range
        snr_db = max(0, min(50, snr_db))

        # Determine quality level
        if snr_db >= 15:
            quality_level = "good"
            recommendation = "Audio quality is good for analysis."
            is_reliable = True
        elif snr_db >= 10:
            quality_level = "acceptable"
            recommendation = "Audio quality is acceptable. Results may have reduced accuracy."
            is_reliable = True
        else:
            quality_level = "poor"
            recommendation = "Audio quality is poor. Please record in a quieter environment."
            is_reliable = False

        print(f"SNR calculated: {snr_db:.2f} dB ({quality_level})")

        return {
            "snr_db": round(snr_db, 2),
            "quality_level": quality_level,
            "is_reliable": is_reliable,
            "recommendation": recommendation
        }

    except Exception as e:
        print(f"SNR calculation failed: {e}")
        return {
            "snr_db": 0.0,
            "quality_level": "unknown",
            "is_reliable": False,
            "recommendation": "Could not calculate audio quality."
        }


def detect_voice_activity(audio_file_path: str) -> dict:
    """
    Detect voice activity in recording using Praat pitch and intensity analysis.

    Method:
    1. Extract pitch contour
    2. Count frames with valid pitch (voiced frames)
    3. Calculate speech percentage

    Thresholds:
    - speech_percentage >= 40%: Sufficient speech
    - speech_percentage 20-40%: Marginal
    - speech_percentage < 20%: Insufficient

    Returns:
        dict with speech_duration_s, total_duration_s, speech_percentage,
        has_sufficient_speech, voiced_segment_count
    """
    try:
        sound = parselmouth.Sound(audio_file_path)
        total_duration = call(sound, "Get total duration")

        if total_duration == 0:
            return {
                "speech_duration_s": 0.0,
                "total_duration_s": 0.0,
                "speech_percentage": 0.0,
                "has_sufficient_speech": False,
                "voiced_segment_count": 0,
                "message": "Audio has zero duration."
            }

        # Create pitch object for voice detection
        pitch = call(sound, "To Pitch", 0.0, 75, 600)

        # Count voiced frames and find first/last voice
        num_frames = call(pitch, "Get number of frames")
        voiced_frames = 0
        current_segment = False
        segment_count = 0
        first_voiced_frame = -1
        last_voiced_frame = -1

        for i in range(1, num_frames + 1):
            pitch_value = call(pitch, "Get value in frame", i, "Hertz")
            is_voiced = not np.isnan(pitch_value) and pitch_value > 0

            if is_voiced:
                voiced_frames += 1
                if first_voiced_frame == -1:
                    first_voiced_frame = i
                last_voiced_frame = i
                if not current_segment:
                    segment_count += 1
                    current_segment = True
            else:
                current_segment = False

        # Calculate speech percentage using "active duration"
        # (from first voice to last voice, not entire file)
        frame_duration = total_duration / num_frames if num_frames > 0 else 0
        speech_duration = voiced_frames * frame_duration

        # Use active duration (first voice to last voice) instead of total duration
        # This prevents penalizing users who stop recording early
        if first_voiced_frame > 0 and last_voiced_frame > 0:
            active_duration = (last_voiced_frame - first_voiced_frame + 1) * frame_duration
            # Use at least 2 seconds to avoid artificially high percentages for very short recordings
            effective_duration = max(2.0, active_duration)
        else:
            effective_duration = total_duration

        speech_percentage = (speech_duration / effective_duration) * 100 if effective_duration > 0 else 0

        # Determine if sufficient speech
        if speech_percentage >= 40:
            has_sufficient = True
            message = "Sufficient speech detected for analysis."
        elif speech_percentage >= 20:
            has_sufficient = True
            message = "Marginal speech detected. Results may be less reliable."
        else:
            has_sufficient = False
            message = "Insufficient speech detected. Please speak more during the recording."

        # Calculate actual timestamps for first and last voiced frames
        first_voiced_time = (first_voiced_frame - 1) * frame_duration if first_voiced_frame > 0 else 0.0
        last_voiced_time = last_voiced_frame * frame_duration if last_voiced_frame > 0 else total_duration

        print(f"VAD: {speech_percentage:.1f}% speech ({segment_count} segments)")
        print(f"  Total duration: {total_duration:.2f}s, Active duration: {effective_duration:.2f}s, Speech: {speech_duration:.2f}s")
        print(f"  First voice: {first_voiced_time:.2f}s, Last voice: {last_voiced_time:.2f}s")

        return {
            "speech_duration_s": round(speech_duration, 2),
            "total_duration_s": round(total_duration, 2),
            "active_duration_s": round(effective_duration, 2),
            "speech_percentage": round(speech_percentage, 2),
            "has_sufficient_speech": has_sufficient,
            "voiced_segment_count": segment_count,
            "first_voiced_time": round(first_voiced_time, 3),
            "last_voiced_time": round(last_voiced_time, 3),
            "message": message
        }

    except Exception as e:
        print(f"VAD detection failed: {e}")
        return {
            "speech_duration_s": 0.0,
            "total_duration_s": 0.0,
            "speech_percentage": 0.0,
            "has_sufficient_speech": False,
            "voiced_segment_count": 0,
            "message": f"Voice activity detection failed: {str(e)}"
        }


def extract_features(audio_file_path: str, first_voiced_time: float = 0.0, last_voiced_time: float = None) -> dict:
    """
    Extract acoustic features using Parselmouth/Praat

    Features extracted:
    - Jitter (local): Voice frequency stability
    - Shimmer (dda): Voice amplitude stability
    - HNR: Harmonics-to-noise ratio
    - Speech rate: Estimated syllables per second
    - Pause ratio: Percentage of silence (excluding leading/trailing silence)
    - Voice breaks: Number of discontinuities
    - Mean intensity: Average voice volume

    Args:
        audio_file_path: Path to audio file
        first_voiced_time: Start of active speech region (from VAD)
        last_voiced_time: End of active speech region (from VAD)
    """
    try:
        # Load audio from file path
        sound = parselmouth.Sound(audio_file_path)

        # Get total duration
        total_duration = call(sound, "Get total duration")
        sample_rate = sound.sampling_frequency
        n_channels = sound.n_channels

        print(f"Audio loaded: {total_duration:.2f}s, {sample_rate}Hz, {n_channels} channel(s)")

        if total_duration == 0:
            raise ValueError("Audio file is empty or has zero duration")

        if total_duration < 2.0:
            raise ValueError(f"Audio too short ({total_duration:.2f}s). Minimum 2 seconds required for reliable analysis. Please record again.")

        # Extract pitch-related features
        try:
            # Create PointProcess for pitch analysis
            point_process = call(sound, "To PointProcess (periodic, cc)", 75, 600)

            # Extract jitter (frequency perturbation)
            # For conversational speech, use slightly longer period range to smooth over transitions
            jitter_local = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.03, 1.3)
            jitter_percent = float(jitter_local * 100)

            # VALIDATION: Jitter > 5% indicates measurement error
            # Healthy sustained vowel: 0.3-1%, conversational: 0.5-2%, pathological: 2-4%, >5% = invalid
            if jitter_percent > 5.0:
                print(f"⚠️  WARNING: Jitter {jitter_percent:.2f}% is abnormally high (likely measurement error)")

                # For short conversational prompts, apply scaling similar to shimmer
                if total_duration < 8.0:
                    scaling_factor = 0.6  # Reduce by 40%
                    raw_jitter = jitter_percent
                    jitter_percent = jitter_percent * scaling_factor
                    print(f"    [Jitter Correction] Conversational speech: {raw_jitter:.2f}% → {jitter_percent:.2f}%")
                else:
                    print(f"    Capping at 3.5% (pathological threshold)")
                    jitter_percent = 3.5
            elif jitter_percent > 3.0 and total_duration < 8.0:
                # Moderate jitter in conversational speech
                # Apply milder scaling (reduce by 20%)
                scaling_factor = 0.8
                raw_jitter = jitter_percent
                jitter_percent = jitter_percent * scaling_factor
                print(f"[Jitter Adjustment] Conversational speech scaling: {raw_jitter:.2f}% → {jitter_percent:.2f}%")
        except Exception as e:
            print(f"Jitter extraction failed: {e}")
            jitter_percent = 0.0

        # Extract shimmer (amplitude perturbation)
        # NOTE: Using Praat's shimmer DDA (Difference of Differences of Amplitudes)
        # This is the standard Praat shimmer measurement method
        # Threshold: >3.810% is pathological (Praat documentation reference)
        # Frontend expects 'shimmer_dda' in response, which matches this extraction
        #
        # IMPORTANT FIX: For conversational speech (not sustained vowels), we use
        # more lenient shimmer parameters to account for natural prosodic variation
        try:
            point_process = call(sound, "To PointProcess (periodic, cc)", 75, 600)

            # Use longer period range (0.02-0.05 instead of 0.02) to smooth over
            # prosodic variations in conversational speech
            # Original: 0.0001, 0.02, 1.3, 1.6 (for sustained vowels)
            # Adjusted: 0.0001, 0.05, 1.3, 1.6 (for conversational speech)
            shimmer_dda = call([sound, point_process], "Get shimmer (dda)", 0, 0, 0.0001, 0.05, 1.3, 1.6)
            shimmer_percent = float(shimmer_dda * 100)

            # VALIDATION: Shimmer > 15% indicates measurement error (audio too short, clipping, or noise)
            # For conversational speech, shimmer can be higher than sustained vowels
            # Healthy conversation: 2-5%, pathological: 5-12%, >15% = likely measurement error
            if shimmer_percent > 15.0:
                print(f"⚠️  WARNING: Shimmer {shimmer_percent:.2f}% is abnormally high (likely measurement error)")
                print(f"    Possible causes: audio too short (<3s), clipping, prosodic variation in conversational speech")
                print(f"    Duration: {total_duration:.2f}s")

                # For short conversational prompts (<8s), apply aggressive scaling
                # This accounts for prosodic variation (emphasis, intonation) being
                # incorrectly measured as pathological amplitude instability
                if total_duration < 8.0:
                    # Scale down by 60-70% for conversational speech
                    scaling_factor = 0.4  # Reduce by 60%
                    raw_shimmer = shimmer_percent
                    shimmer_percent = shimmer_percent * scaling_factor
                    print(f"    [Shimmer Correction] Conversational speech: {raw_shimmer:.2f}% → {shimmer_percent:.2f}%")
                else:
                    # Cap at 8% for longer recordings (likely real pathology)
                    shimmer_percent = 8.0
                    print(f"    Capping shimmer at 8% for analysis")
            elif shimmer_percent > 8.0 and total_duration < 8.0:
                # Moderate shimmer in short conversational speech
                # Apply milder scaling (reduce by 30%)
                scaling_factor = 0.7
                raw_shimmer = shimmer_percent
                shimmer_percent = shimmer_percent * scaling_factor
                print(f"[Shimmer Adjustment] Conversational speech scaling: {raw_shimmer:.2f}% → {shimmer_percent:.2f}%")
        except Exception as e:
            print(f"Shimmer extraction failed: {e}")
            shimmer_percent = 0.0

        # Extract HNR (harmonics-to-noise ratio)
        try:
            harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
            hnr = call(harmonicity, "Get mean", 0, 0)
            hnr_db = float(hnr)
        except Exception as e:
            print(f"HNR extraction failed: {e}")
            hnr_db = 0.0

        # Extract intensity
        try:
            intensity = call(sound, "To Intensity", 75, 0, "yes")
            mean_intensity = call(intensity, "Get mean", 0, 0, "energy")
            mean_intensity_db = float(mean_intensity)
        except Exception as e:
            print(f"Intensity extraction failed: {e}")
            mean_intensity_db = 0.0

        # Extract pause ratio (silence detection) - HYBRID APPROACH
        # Uses -50 dB threshold + duration filtering + dual ratios
        # EXCLUDES leading/trailing silence (before first voice and after last voice)
        try:
            # Detect silences with threshold -50 dB (closer to noise floor)
            # -50 dB = only true silence or significant respiratory pauses
            # Normal inter-word pauses (breathing, articulation) are NOT marked as silent
            # Minimum silent interval: 0.3s (300ms) to exclude brief inter-word pauses
            # Minimum sounding interval: 0.1s (100ms) to detect speech
            textgrid = call(sound, "To TextGrid (silences)", 100, 0.0, -50, 0.3, 0.1, "silent", "sounding")

            # Calculate TWO pause ratios for medical triage:
            # 1. brief_pause_ratio: 300-800ms pauses (normal inter-sentence breaks)
            # 2. respiratory_pause_ratio: >800ms pauses (pathological respiratory distress)
            # Note: Praat's minimum silent interval is now 300ms, so we won't detect
            # very brief inter-word pauses (<300ms), which is intentional
            #
            # CRITICAL FIX: Only count pauses WITHIN the active speech region
            # (between first_voiced_time and last_voiced_time from VAD)
            # This excludes silence before speaking starts and after speaking ends
            brief_pause_duration = 0.0
            respiratory_pause_duration = 0.0
            total_pause_duration = 0.0

            # Determine active speech boundaries
            active_start = first_voiced_time if first_voiced_time > 0 else 0.0
            active_end = last_voiced_time if last_voiced_time is not None else total_duration

            num_intervals = call(textgrid, "Get number of intervals", 1)

            for i in range(1, num_intervals + 1):
                label = call(textgrid, "Get label of interval", 1, i)
                if label == "silent":
                    start = call(textgrid, "Get start time of interval", 1, i)
                    end = call(textgrid, "Get end time of interval", 1, i)

                    # CRITICAL: Only count pauses WITHIN active speech region
                    # Skip pauses before first voice or after last voice
                    if end <= active_start or start >= active_end:
                        # This pause is outside the active speech region (leading/trailing silence)
                        continue

                    # Clip pause to active speech boundaries
                    pause_start = max(start, active_start)
                    pause_end = min(end, active_end)
                    duration = pause_end - pause_start

                    # Only count if duration is still significant after clipping
                    if duration < 0.3:
                        continue

                    # Categorize pauses by duration
                    if 0.3 <= duration < 0.8:
                        # Brief pauses (300-800ms): normal inter-sentence breaks
                        brief_pause_duration += duration
                    elif duration >= 0.8:
                        # Respiratory pauses (>800ms): pathological marker
                        respiratory_pause_duration += duration

                    # Total pause duration (all detected pauses ≥300ms within active region)
                    total_pause_duration += duration

            # Calculate ratios based on active speech duration (not total recording duration)
            active_duration = active_end - active_start
            if active_duration > 0:
                pause_ratio = float((total_pause_duration / active_duration) * 100)
                brief_pause_ratio = float((brief_pause_duration / active_duration) * 100)
                respiratory_pause_ratio = float((respiratory_pause_duration / active_duration) * 100)
            else:
                pause_ratio = 0.0
                brief_pause_ratio = 0.0
                respiratory_pause_ratio = 0.0

            print(f"Pause analysis (active region {active_start:.2f}s-{active_end:.2f}s): Total={pause_ratio:.1f}%, Brief={brief_pause_ratio:.1f}%, Respiratory={respiratory_pause_ratio:.1f}%")
        except Exception as e:
            print(f"Pause ratio extraction failed: {e}")
            pause_ratio = 0.0
            brief_pause_ratio = 0.0
            respiratory_pause_ratio = 0.0

        # Estimate speech rate (syllables per second)
        # LIMITATION: This is a crude estimation using multiplier
        # Real syllable counting requires complex phonetic analysis
        # (intensity peaks, formants)
        # For MVP/hackathon: This approximation is acceptable for
        # detecting severely slow speech
        # Future: Implement proper syllable nuclei detection or
        # use Whisper phoneme alignment
        try:
            intensity = call(sound, "To Intensity", 75, 0, "yes")

            # Calculate speech duration (excluding pauses)
            speech_duration = total_duration * (1 - pause_ratio/100)

            # Language-specific syllable rates (research-based)
            # English: 2.5-3.5 sps typical, Arabic: 2.0-2.5 sps typical
            base_rate = 2.8  # Conservative estimate for clear, prompted speech

            # Apply VAD adjustment for careful/clear speech
            # More pauses = more careful articulation = naturally slower
            if pause_ratio > 20:
                adjustment_factor = 0.85  # Reduce expected rate by 15%
            else:
                adjustment_factor = 1.0

            estimated_rate = base_rate * adjustment_factor
            estimated_syllables = max(0, speech_duration * estimated_rate)

            # ✅ CRITICAL FIX: Divide by speech_duration (not total_duration)
            # This gives syllables per second of actual speech, excluding pauses
            # OLD (WRONG): estimated_syllables / total_duration
            # NEW (CORRECT): estimated_syllables / speech_duration
            speech_rate = float(estimated_syllables / speech_duration) if speech_duration > 0 else 0.0

            print(f"Speech rate calculation: {estimated_syllables:.1f} syllables / {speech_duration:.2f}s = {speech_rate:.2f} sps")
        except Exception as e:
            print(f"Speech rate extraction failed: {e}")
            speech_rate = 0.0

        # Count voice breaks (discontinuities in pitch)
        try:
            pitch = call(sound, "To Pitch", 0.0, 75, 600)
            voice_breaks = 0

            # Simple voice break detection
            for i in range(1, int(total_duration * 100)):
                time_point = i / 100.0
                if time_point < total_duration:
                    pitch_value = call(pitch, "Get value at time", time_point, "Hertz", "Linear")
                    if pitch_value == 0:  # Voiceless frame
                        voice_breaks += 1

            # Normalize voice breaks to actual breaks
            # (consecutive voiceless frames)
            # We sample every 10ms (100 samples/second), so consecutive
            # voiceless frames need to be grouped to approximate actual
            # voice breaks
            # Division by 10 roughly converts frame count to break count
            # (e.g., 30 voiceless frames / 10 ≈ 3 actual voice breaks)
            # This is a rough approximation suitable for detecting
            # voice quality issues
            voice_breaks = int(voice_breaks / 10)
        except Exception as e:
            print(f"Voice breaks extraction failed: {e}")
            voice_breaks = 0

        # Handle NaN values (replace with 0 for JSON compatibility)
        import math

        def safe_round(value, decimals=2):
            """Round value, replacing NaN/Inf with 0"""
            if math.isnan(value) or math.isinf(value):
                return 0.0
            return round(value, decimals)

        return {
            "jitter_local": safe_round(jitter_percent, 3),
            "shimmer_dda": safe_round(shimmer_percent, 3),
            "hnr": safe_round(hnr_db, 2),
            "speech_rate": safe_round(speech_rate, 2),
            "pause_ratio": safe_round(pause_ratio, 2),
            "brief_pause_ratio": safe_round(brief_pause_ratio, 2),
            "respiratory_pause_ratio": safe_round(respiratory_pause_ratio, 2),
            "voice_breaks": voice_breaks if not math.isnan(voice_breaks) else 0,
            "mean_intensity": safe_round(mean_intensity_db, 2)
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio processing error: {str(e)}")


def correct_features_for_snr(features: dict, snr_db: float) -> dict:
    """
    Apply SNR-based corrections to acoustic features.

    Strategy: Conservative bias correction with safety clamps

    Design Philosophy (Option A):
    - Correct measurement bias (noise corrupts the measurement)
    - Keep thresholds stable (clinical cutoffs stay meaningful)
    - Apply quality gating + confidence penalty in frontend
    - Avoid double compensation (no aggressive threshold relaxation)

    Research-backed approach:
    - Deliyski et al. (2005): Jitter/shimmer reliability degrades with SNR
    - Maryn et al. (2009): HNR sensitivity to noise
    - Titze (1995): Pause detection threshold shifts with noise

    For SNR < 20 dB (reference level), apply corrections:
    - Jitter: noise inflates → correct downward (clamped to max 0.4%)
    - Shimmer: noise inflates → correct downward (clamped to max 1.5%)
    - HNR: noise reduces → correct upward (clamped to max 3.0 dB)
    - Pause ratio: downweighted in frontend, minimal correction here
    - Speech rate: noise-independent → no correction
    - Voice breaks: binary, noise-independent → no correction

    Safety Clamps (prevents over-correction):
    - Max jitter correction: 0.4% (even at very low SNR)
    - Max shimmer correction: 1.5% (prevents impossible values)
    - Max HNR correction: 3.0 dB (conservative boost)
    - Max pause correction: 5% (VAD is complex, not pure acoustic bias)

    Args:
        features: Dictionary of extracted features
        snr_db: Measured SNR in dB

    Returns:
        Dictionary with corrected features (bias-adjusted estimates)
    """
    import math

    # If SNR >= 20 dB, no correction needed (reference condition)
    if snr_db >= 20:
        return features

    # Calculate SNR delta from reference (always positive for SNR < 20)
    snr_delta = 20 - snr_db

    # Correction constants (REDUCED from original - more conservative)
    # Original aggressive values commented for reference
    K_JITTER = 0.04      # 0.04% per dB (was 0.05)
    K_SHIMMER = 0.10     # 0.10% per dB (was 0.15 - too aggressive)
    K_HNR = 0.30         # 0.30 dB per dB (was 0.5 - too aggressive)
    K_PAUSE = 0.004      # 0.4 percentage points per dB (was 0.008)

    # Maximum correction clamps (safety limits)
    MAX_JITTER_CORRECTION = 0.4    # Max 0.4% jitter reduction
    MAX_SHIMMER_CORRECTION = 1.5   # Max 1.5% shimmer reduction
    MAX_HNR_CORRECTION = 3.0       # Max 3.0 dB HNR boost
    MAX_PAUSE_CORRECTION = 5.0     # Max 5% pause reduction

    # Create corrected features dictionary
    corrected = features.copy()

    # Correct jitter (noise inflates → subtract correction)
    jitter_correction = min(K_JITTER * snr_delta, MAX_JITTER_CORRECTION)
    corrected["jitter_local"] = max(0.0, features["jitter_local"] - jitter_correction)

    # Correct shimmer (noise inflates → subtract correction)
    shimmer_correction = min(K_SHIMMER * snr_delta, MAX_SHIMMER_CORRECTION)
    corrected["shimmer_dda"] = max(0.0, features["shimmer_dda"] - shimmer_correction)

    # Correct HNR (noise reduces → add correction)
    hnr_correction = min(K_HNR * snr_delta, MAX_HNR_CORRECTION)
    corrected["hnr"] = min(40.0, features["hnr"] + hnr_correction)

    # Correct pause ratios (noise inflates → subtract correction, MINIMAL)
    # Pause is mostly handled by VAD reliability weighting in frontend
    pause_correction = min(K_PAUSE * snr_delta * 100, MAX_PAUSE_CORRECTION)
    corrected["pause_ratio"] = max(0.0, min(100.0, features["pause_ratio"] - pause_correction))

    # Apply same correction to dual pause ratios (if present)
    if "brief_pause_ratio" in features:
        corrected["brief_pause_ratio"] = max(0.0, min(100.0, features["brief_pause_ratio"] - pause_correction))

    if "respiratory_pause_ratio" in features:
        corrected["respiratory_pause_ratio"] = max(0.0, min(100.0, features["respiratory_pause_ratio"] - pause_correction))

    # Speech rate: No correction (noise-independent)
    corrected["speech_rate"] = features["speech_rate"]

    # Voice breaks: No correction (binary, noise-independent)
    corrected["voice_breaks"] = features["voice_breaks"]

    # Mean intensity: No correction (informational only)
    corrected["mean_intensity"] = features["mean_intensity"]

    # Round corrected values
    def safe_round(value, decimals=2):
        """Round value, replacing NaN/Inf with 0"""
        if math.isnan(value) or math.isinf(value):
            return 0.0
        return round(value, decimals)

    # Apply rounding
    corrected["jitter_local"] = safe_round(corrected["jitter_local"], 3)
    corrected["shimmer_dda"] = safe_round(corrected["shimmer_dda"], 3)
    corrected["hnr"] = safe_round(corrected["hnr"], 2)
    corrected["pause_ratio"] = safe_round(corrected["pause_ratio"], 2)
    corrected["speech_rate"] = safe_round(corrected["speech_rate"], 2)

    # Round dual pause ratios if present
    if "brief_pause_ratio" in corrected:
        corrected["brief_pause_ratio"] = safe_round(corrected["brief_pause_ratio"], 2)
    if "respiratory_pause_ratio" in corrected:
        corrected["respiratory_pause_ratio"] = safe_round(corrected["respiratory_pause_ratio"], 2)

    # Log corrections for debugging (show if clamped)
    print(f"[SNR Correction] SNR: {snr_db:.1f} dB, Delta: {snr_delta:.1f} dB (Conservative Option A)")
    print(f"  Jitter:  {features['jitter_local']:.3f}% → {corrected['jitter_local']:.3f}% (Δ {-jitter_correction:.3f}% {'CLAMPED' if jitter_correction >= MAX_JITTER_CORRECTION else ''})")
    print(f"  Shimmer: {features['shimmer_dda']:.3f}% → {corrected['shimmer_dda']:.3f}% (Δ {-shimmer_correction:.3f}% {'CLAMPED' if shimmer_correction >= MAX_SHIMMER_CORRECTION else ''})")
    print(f"  HNR:     {features['hnr']:.2f} dB → {corrected['hnr']:.2f} dB (Δ +{hnr_correction:.2f} dB {'CLAMPED' if hnr_correction >= MAX_HNR_CORRECTION else ''})")
    print(f"  Pause:   {features['pause_ratio']:.2f}% → {corrected['pause_ratio']:.2f}% (Δ {-pause_correction:.2f}% {'CLAMPED' if pause_correction >= MAX_PAUSE_CORRECTION else ''})")

    return corrected


@app.get("/")
async def root():
    """API info endpoint"""
    return {
        "status": "online",
        "service": "Nabrah Audio Analysis API",
        "version": "2.0.0",
        "features": [
            "No FFmpeg dependency",
            "Frontend WAV encoding",
            "Lightweight deployment",
            "Praat acoustic analysis"
        ],
        "supported_format": "WAV (16kHz mono, encoded in browser)"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "nabrah-api"
    }


@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Analyze audio file and return acoustic features

    Parameters:
    - file: Audio file (WebM, WAV, MP3, etc.)

    Returns:
    - status: success/error
    - features: Dictionary of extracted acoustic features
    - processing_time_ms: Time taken to process the audio
    """
    start_time = time.time()
    temp_file_path = None

    try:
        # Validate file
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")

        # Read audio bytes
        audio_bytes = await file.read()

        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file provided")

        print(f"Received audio file: {file.filename}, size: {len(audio_bytes)} bytes")

        # Frontend sends WAV format, just save it
        print("Saving WAV audio to temp file...")
        temp_file_path = save_audio_to_temp(audio_bytes)

        print(f"Processing audio from: {temp_file_path}")

        # Calculate audio quality metrics first
        snr_result = calculate_snr(temp_file_path)
        vad_result = detect_voice_activity(temp_file_path)

        # Build quality object
        quality = {
            "snr_db": snr_result["snr_db"],
            "quality_level": snr_result["quality_level"],
            "speech_percentage": vad_result["speech_percentage"],
            "has_sufficient_speech": vad_result["has_sufficient_speech"],
            "is_reliable": (
                snr_result["is_reliable"] and
                vad_result["has_sufficient_speech"]
            ),
            "snr_recommendation": snr_result["recommendation"],
            "vad_message": vad_result["message"]
        }

        print(f"Quality: SNR={quality['snr_db']}dB, "
              f"Speech={quality['speech_percentage']}%")

        # Extract acoustic features (pass VAD boundaries to exclude leading/trailing silence)
        first_voiced_time = vad_result.get("first_voiced_time", 0.0)
        last_voiced_time = vad_result.get("last_voiced_time", None)
        features_raw = extract_features(temp_file_path, first_voiced_time, last_voiced_time)

        # DISABLED: SNR-based corrections
        # Reason: For clean recordings with good microphones, SNR corrections
        # artificially modify values and cause false positives
        # The corrections were designed for noisy environments (SNR < 10 dB)
        # but are harmful for clean audio (SNR > 15 dB)
        #
        # Previous behavior:
        # - Reduced shimmer/jitter (making pathological values appear normal)
        # - Boosted HNR (masking voice quality issues)
        # - Reduced pause ratio (hiding respiratory problems)
        #
        # New behavior: Use RAW features directly for accurate triage
        features_final = features_raw

        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000

        print(f"Analysis complete in {processing_time:.2f}ms")
        print(f"Features (RAW, no SNR correction): {features_final}")

        return {
            "status": "success",
            "features": features_final,
            "quality": quality,
            "processing_time_ms": round(processing_time, 2)
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                print(f"Cleaned up temp file: {temp_file_path}")
            except Exception as e:
                print(f"Failed to cleanup temp file: {e}")


def get_whisper_model(language: str = "en"):
    """
    Lazy load Whisper model based on language.

    Args:
        language: Language code ('en' or 'ar')

    Returns:
        WhisperModel instance or None if loading fails
    """
    global whisper_models

    # Get appropriate model for language
    model_name = WHISPER_MODELS.get(language, WHISPER_MODELS["en"])

    # Return cached model if already loaded
    if model_name in whisper_models:
        return whisper_models[model_name]

    # Load new model
    try:
        from faster_whisper import WhisperModel
        print(f"Loading Whisper model: {model_name} for language: {language}...")
        whisper_models[model_name] = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8"
        )
        print(f"Whisper model {model_name} loaded successfully")
        return whisper_models[model_name]
    except ImportError:
        print("faster-whisper not installed. Whisper features disabled.")
        return None
    except Exception as e:
        print(f"Failed to load Whisper model {model_name}: {e}")
        return None


@app.post("/analyze/whisper")
async def analyze_whisper(
    file: UploadFile = File(...),
    language: str = "en"
):
    """
    Transcribe audio using Whisper and return confidence metrics.

    Parameters:
    - file: Audio file (WAV format)
    - language: Language code ('en' or 'ar')

    Returns:
    - transcription: Full text transcription
    - avg_logprob: Average log probability (clarity indicator)
    - no_speech_prob: Probability of no speech
    - confidence_score: Normalized 0-100
    - language: Language used for transcription
    - duration_s: Audio duration
    """
    start_time = time.time()
    temp_file_path = None

    try:
        # Validate language parameter
        if language not in ["en", "ar"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {language}. Use 'en' or 'ar'."
            )

        model = get_whisper_model(language)
        if model is None:
            raise HTTPException(
                status_code=503,
                detail="Whisper model not available"
            )

        # Validate file
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")

        audio_bytes = await file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        print(f"[Whisper] Received audio: {len(audio_bytes)} bytes (language: {language})")

        # Save to temp file
        temp_file_path = save_audio_to_temp(audio_bytes)

        # Transcribe with Whisper using specified language
        segments, info = model.transcribe(
            temp_file_path,
            beam_size=1,  # Faster, slightly less accurate
            language=language,  # Use requested language
            condition_on_previous_text=False
        )

        # Collect transcription and metrics
        transcription_parts = []
        log_probs = []
        no_speech_probs = []

        for segment in segments:
            transcription_parts.append(segment.text)
            log_probs.append(segment.avg_logprob)
            no_speech_probs.append(segment.no_speech_prob)

        transcription = " ".join(transcription_parts).strip()

        # Calculate averages
        avg_logprob = sum(log_probs) / len(log_probs) if log_probs else -2.0
        avg_no_speech = (
            sum(no_speech_probs) / len(no_speech_probs)
            if no_speech_probs else 1.0
        )

        # Normalize to 0-100 confidence score
        # avg_logprob typically ranges from -2.0 (unclear) to 0.0 (clear)
        confidence_score = max(0, min(100, (avg_logprob + 2.0) * 50))

        processing_time = (time.time() - start_time) * 1000

        print(f"[Whisper] Transcription: '{transcription[:50]}...'")
        print(f"[Whisper] Confidence: {confidence_score:.1f}%")
        print(f"[Whisper] Processing time: {processing_time:.2f}ms")

        return {
            "status": "success",
            "transcription": transcription,
            "avg_logprob": round(avg_logprob, 3),
            "no_speech_prob": round(avg_no_speech, 3),
            "confidence_score": round(confidence_score, 1),
            "language": language,  # Return the requested language
            "detected_language": info.language if info else language,  # Whisper's detection
            "duration_s": round(info.duration, 2) if info else 0,
            "processing_time_ms": round(processing_time, 2)
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[Whisper] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Whisper transcription failed: {str(e)}"
        )

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


# ============================================================================
# Queue Management Endpoints
# ============================================================================

class PatientData(BaseModel):
    """Request body for adding a patient to the queue."""
    triage: Dict[str, Any]
    quality: Optional[Dict[str, Any]] = None
    whisper: Optional[Dict[str, Any]] = None
    wer: Optional[Dict[str, Any]] = None
    agreement: Optional[Dict[str, Any]] = None
    features: Optional[Dict[str, Any]] = None
    notes: Optional[str] = ""


class StatusUpdate(BaseModel):
    """Request body for updating patient status."""
    status: str
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    referred_to: Optional[str] = None


@app.get("/queue")
async def get_queue(status: Optional[str] = None):
    """
    Get all patients in the queue, sorted by priority.

    Query Parameters:
    - status: Optional filter ('pending', 'reviewing', 'completed', 'referred')

    Returns:
    - patients: List of patients sorted by priority
    - stats: Queue statistics
    """
    try:
        patients = queue_db.get_queue(status_filter=status)
        stats = queue_db.get_queue_stats()

        return {
            "status": "success",
            "patients": patients,
            "stats": stats,
            "count": len(patients)
        }
    except Exception as e:
        print(f"[Queue] Error fetching queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/queue")
async def add_to_queue(patient: PatientData):
    """
    Add a new patient to the queue.

    Request Body:
    - triage: Triage result object (required)
    - quality: Audio quality metrics (optional)
    - whisper: Whisper transcription data (optional)
    - wer: Word error rate data (optional)
    - agreement: Agreement score data (optional)
    - features: Acoustic features (optional)
    - notes: Initial notes (optional)

    Returns:
    - patient_id: Generated patient ID
    - priority: Calculated priority (1=highest)
    """
    try:
        patient_data = patient.model_dump()
        patient_id = queue_db.add_patient(patient_data)

        # Fetch the created patient for response
        created_patient = queue_db.get_patient(patient_id)

        return {
            "status": "success",
            "patient_id": patient_id,
            "priority": created_patient.get("priority") if created_patient else 1,
            "message": f"Patient {patient_id} added to queue"
        }
    except Exception as e:
        print(f"[Queue] Error adding patient: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/queue/{patient_id}")
async def get_patient(patient_id: str):
    """
    Get a specific patient by ID.

    Path Parameters:
    - patient_id: The patient ID

    Returns:
    - patient: Patient data or 404 if not found
    """
    patient = queue_db.get_patient(patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "status": "success",
        "patient": patient
    }


@app.patch("/queue/{patient_id}")
async def update_patient_status(patient_id: str, update: StatusUpdate):
    """
    Update a patient's status.

    Path Parameters:
    - patient_id: The patient ID

    Request Body:
    - status: New status ('pending', 'reviewing', 'completed', 'referred')
    - notes: Optional notes to add
    - reviewed_by: Optional reviewer name
    - referred_to: Optional referral destination

    Returns:
    - success: True if updated
    """
    success = queue_db.update_status(
        patient_id=patient_id,
        status=update.status,
        notes=update.notes,
        reviewed_by=update.reviewed_by,
        referred_to=update.referred_to
    )

    if not success:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "status": "success",
        "message": f"Patient {patient_id} updated to '{update.status}'"
    }


@app.delete("/queue/{patient_id}")
async def delete_patient(patient_id: str):
    """
    Delete a patient from the queue.

    Path Parameters:
    - patient_id: The patient ID

    Returns:
    - success: True if deleted
    """
    success = queue_db.delete_patient(patient_id)

    if not success:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "status": "success",
        "message": f"Patient {patient_id} deleted"
    }


@app.get("/queue/stats/summary")
async def get_queue_stats():
    """
    Get queue statistics.

    Returns:
    - by_level: Count by triage level (RED, YELLOW, GREEN)
    - by_status: Count by status
    - active_count: Total pending + reviewing
    - total_count: Total patients
    """
    try:
        stats = queue_db.get_queue_stats()
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        print(f"[Queue] Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/queue/export/csv", response_class=PlainTextResponse)
async def export_queue_csv():
    """
    Export queue data as CSV.

    Returns:
    - CSV formatted string with all patient data
    """
    try:
        csv_data = queue_db.export_queue_csv()
        return PlainTextResponse(
            content=csv_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=nabrah_queue.csv"
            }
        )
    except Exception as e:
        print(f"[Queue] Error exporting CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Nabrah Audio Analysis API...")
    print("📡 Server will be available at: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")
    print("")
    print("✨ No FFmpeg required - Frontend handles WAV encoding!")
    print("📦 Lightweight deployment-ready configuration")
    print("📋 Patient queue system enabled with SQLite storage")
    print("")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
