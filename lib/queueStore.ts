import { create } from 'zustand';

export interface Patient {
  id: string;
  name: string;
  age: number;
  triage_level: 'RED' | 'YELLOW' | 'GREEN';
  score: number;
  confidence: number;
  timestamp: string;
  features?: {
    jitter_local: number;
    shimmer_dda: number;
    hnr: number;
    intensity_mean: number;
    pause_ratio: number;
    speech_rate: number;
    voice_breaks: number;
  };
  analysis_summary?: string;
}

interface QueueState {
  // State
  patients: Patient[];
  isLoading: boolean;
  error: string | null;
  deletingIds: Set<string>; // Track which patients are being deleted

  // Actions
  setPatients: (patients: Patient[]) => void;
  addPatient: (patient: Patient) => void;
  removePatient: (patientId: string) => Promise<void>;
  rollbackRemove: (patient: Patient) => void; // Rollback if delete fails
  updatePatient: (patientId: string, updates: Partial<Patient>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDeleting: (patientId: string, isDeleting: boolean) => void;
  isPatientDeleting: (patientId: string) => boolean;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  // Initial state
  patients: [],
  isLoading: false,
  error: null,
  deletingIds: new Set(),

  // Set all patients (replaces existing list)
  setPatients: (patients) => set({ patients, error: null }),

  // Add a new patient
  addPatient: (patient) => set((state) => ({
    patients: [patient, ...state.patients], // Add to front of queue
    error: null,
  })),

  // Optimistically remove patient
  removePatient: async (patientId) => {
    const state = get();

    // Prevent duplicate deletes
    if (state.deletingIds.has(patientId)) {
      console.log('[QueueStore] Patient already being deleted:', patientId);
      return;
    }

    // Find patient before removing (for potential rollback)
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) {
      console.warn('[QueueStore] Patient not found in store:', patientId);
      return;
    }

    // Mark as deleting
    get().setDeleting(patientId, true);

    // Optimistically remove from UI
    set((state) => ({
      patients: state.patients.filter(p => p.id !== patientId),
      error: null,
    }));

    console.log('[QueueStore] Optimistically removed patient:', patientId);
  },

  // Rollback if delete fails
  rollbackRemove: (patient) => {
    console.log('[QueueStore] Rolling back delete for patient:', patient.id);

    set((state) => {
      // Add patient back if not already present
      const exists = state.patients.some(p => p.id === patient.id);
      if (exists) {
        return state;
      }

      // Re-insert patient in original position (or at end if position unknown)
      return {
        patients: [...state.patients, patient],
        error: null,
      };
    });

    // Remove from deleting set
    get().setDeleting(patient.id, false);
  },

  // Update specific patient fields
  updatePatient: (patientId, updates) => set((state) => ({
    patients: state.patients.map(p =>
      p.id === patientId ? { ...p, ...updates } : p
    ),
  })),

  // Set loading state
  setLoading: (loading) => set({ isLoading: loading }),

  // Set error state
  setError: (error) => set({ error }),

  // Mark patient as being deleted (for UI feedback)
  setDeleting: (patientId, isDeleting) => set((state) => {
    const newDeletingIds = new Set(state.deletingIds);
    if (isDeleting) {
      newDeletingIds.add(patientId);
    } else {
      newDeletingIds.delete(patientId);
    }
    return { deletingIds: newDeletingIds };
  }),

  // Check if patient is currently being deleted
  isPatientDeleting: (patientId) => {
    return get().deletingIds.has(patientId);
  },
}));
