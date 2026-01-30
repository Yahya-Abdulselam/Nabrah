// IndexedDB Schema for Nabrah PWA
// Database: nabrah-db
// Version: 1

export const DB_NAME = 'nabrah-db';
export const DB_VERSION = 1;

// Object Store Names
export const STORES = {
  RECORDINGS: 'recordings',
  TRIAGE_RESULTS: 'triage_results',
  QUEUE_PATIENTS: 'queue_patients',
  SYNC_QUEUE: 'sync_queue',
  APP_SETTINGS: 'app_settings',
} as const;

// Type Definitions
export type Language = 'en' | 'ar';
export type TriageLevel = 'RED' | 'YELLOW' | 'GREEN';
export type AnalysisSource = 'online' | 'offline';
export type SyncStatus = 'pending' | 'in_progress' | 'failed' | 'completed';
export type PatientStatus = 'pending' | 'reviewing' | 'completed' | 'referred';
export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type EntityType = 'recording' | 'triage_result' | 'queue_patient';

// Recording Data Structure
export interface RecordingData {
  id: string; // UUID
  audioBlob: Blob; // WAV file
  duration: number; // seconds
  sampleRate: number; // Hz
  language: Language;
  timestamp: string; // ISO string
  synced: boolean;
  metadata: {
    snr_db?: number;
    speech_percentage?: number;
    quality_is_reliable?: boolean;
  };
}

export interface RecordingFilters {
  language?: Language;
  synced?: boolean;
  startDate?: string;
  endDate?: string;
}

// Triage Result Data Structure
export interface TriageResultData {
  id: string; // UUID
  recordingId: string; // foreign key
  triageLevel: TriageLevel;
  triageScore: number;
  confidence: number;
  features: {
    // Praat features (online only)
    jitter_local?: number;
    shimmer_dda?: number;
    hnr?: number;
    speech_rate?: number;
    pause_ratio?: number;
    voice_breaks?: number;

    // Client-side features (offline)
    zero_crossing_rate?: number;
    spectral_centroid?: number;
    pause_count?: number;
    estimated_speech_rate?: number;
    rms_energy?: number;

    // Quality metrics
    snr_db?: number;
    speech_percentage?: number;
    clipping_detected?: boolean;
    low_snr?: boolean;
    insufficient_speech?: boolean;
  };
  flags: Array<{
    feature: string;
    message: string;
    severity: 'RED' | 'YELLOW';
    value?: number;
    threshold?: number;
  }>;
  timestamp: string; // ISO string
  synced: boolean;
  analysis_source: AnalysisSource;
  whisper_transcription?: string;
  whisper_confidence?: number;
  wer_score?: number;
  agreement_percentage?: number;
}

// Queue Patient Data Structure
export interface QueuePatientData {
  id: string; // UUID
  triageResultId: string; // foreign key
  status: PatientStatus;
  priority: number; // 1-10
  questionnaire_data?: Record<string, any>;
  notes?: string;
  reviewed_by?: string;
  referred_to?: string;
  timestamp: string; // ISO string
  synced: boolean;
}

export interface QueueFilters {
  status?: PatientStatus;
  minPriority?: number;
  maxPriority?: number;
  synced?: boolean;
}

// Sync Queue Item
export interface SyncQueueItem {
  id?: number; // autoIncrement
  entity_type: EntityType;
  entity_id: string; // UUID of the entity
  operation: SyncOperation;
  payload: any; // JSON data to sync
  retry_count: number;
  last_attempt?: string; // ISO string
  status: SyncStatus;
  error_message?: string;
}

// App Settings
export interface AppSetting {
  key: string;
  value: any;
}

export type SettingKey =
  | 'theme'
  | 'language'
  | 'offline_mode_enabled'
  | 'last_sync_timestamp'
  | 'cache_size_limit_mb';

// Database Schema Configuration
export const SCHEMA_CONFIG = {
  [STORES.RECORDINGS]: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
      { name: 'synced', keyPath: 'synced', unique: false },
      { name: 'language', keyPath: 'language', unique: false },
    ],
  },
  [STORES.TRIAGE_RESULTS]: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'recordingId', keyPath: 'recordingId', unique: false },
      { name: 'triageLevel', keyPath: 'triageLevel', unique: false },
      { name: 'synced', keyPath: 'synced', unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
      { name: 'analysis_source', keyPath: 'analysis_source', unique: false },
    ],
  },
  [STORES.QUEUE_PATIENTS]: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'triageResultId', keyPath: 'triageResultId', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'priority', keyPath: 'priority', unique: false },
      { name: 'synced', keyPath: 'synced', unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
    ],
  },
  [STORES.SYNC_QUEUE]: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'entity_type', keyPath: 'entity_type', unique: false },
      { name: 'last_attempt', keyPath: 'last_attempt', unique: false },
      { name: 'entity_id', keyPath: 'entity_id', unique: false },
    ],
  },
  [STORES.APP_SETTINGS]: {
    keyPath: 'key',
    autoIncrement: false,
    indexes: [],
  },
};

// Helper function to create/upgrade database
export function upgradeDatabase(db: IDBDatabase, oldVersion: number, newVersion: number | null) {
  console.log(`[DB] Upgrading database from version ${oldVersion} to ${newVersion}`);

  // Version 1: Initial schema
  if (oldVersion < 1) {
    // Create all object stores
    Object.entries(SCHEMA_CONFIG).forEach(([storeName, config]) => {
      if (!db.objectStoreNames.contains(storeName)) {
        console.log(`[DB] Creating object store: ${storeName}`);

        const store = db.createObjectStore(storeName, {
          keyPath: config.keyPath,
          autoIncrement: config.autoIncrement,
        });

        // Create indexes
        config.indexes.forEach((index) => {
          console.log(`[DB] Creating index: ${index.name} on ${storeName}`);
          store.createIndex(index.name, index.keyPath, { unique: index.unique });
        });
      }
    });
  }

  // Future version upgrades go here
  // if (oldVersion < 2) { ... }
}

// Validation helpers
export function validateRecording(data: Partial<RecordingData>): data is RecordingData {
  return !!(
    data.id &&
    data.audioBlob &&
    typeof data.duration === 'number' &&
    typeof data.sampleRate === 'number' &&
    data.language &&
    data.timestamp &&
    typeof data.synced === 'boolean'
  );
}

export function validateTriageResult(data: Partial<TriageResultData>): data is TriageResultData {
  return !!(
    data.id &&
    data.recordingId &&
    data.triageLevel &&
    typeof data.triageScore === 'number' &&
    typeof data.confidence === 'number' &&
    data.features &&
    Array.isArray(data.flags) &&
    data.timestamp &&
    typeof data.synced === 'boolean' &&
    data.analysis_source
  );
}

export function validateQueuePatient(data: Partial<QueuePatientData>): data is QueuePatientData {
  return !!(
    data.id &&
    data.triageResultId &&
    data.status &&
    typeof data.priority === 'number' &&
    data.priority >= 1 &&
    data.priority <= 10 &&
    data.timestamp &&
    typeof data.synced === 'boolean'
  );
}

export function validateSyncQueueItem(data: Partial<SyncQueueItem>): data is SyncQueueItem {
  return !!(
    data.entity_type &&
    data.entity_id &&
    data.operation &&
    data.payload !== undefined &&
    typeof data.retry_count === 'number' &&
    data.status
  );
}
