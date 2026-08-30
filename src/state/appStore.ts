import { create } from 'zustand';

import type { LocalProfile, VoiceDraft } from '@/src/domain/types';

interface AppState {
  dbRevision: number;
  profile: LocalProfile | null;
  initialized: boolean;
  initializationError: string | null;
  isOnline: boolean;
  syncState: 'disabled' | 'idle' | 'syncing' | 'offline' | 'error';
  syncMessage: string | null;
  voiceDrafts: VoiceDraft[];
  voiceTranscript: string;
  lastDeletedTransactionId: string | null;
  bumpDbRevision: () => void;
  setProfile: (profile: LocalProfile | null) => void;
  setInitialized: (initialized: boolean, error?: string | null) => void;
  setOnline: (online: boolean) => void;
  setSyncState: (state: AppState['syncState'], message?: string | null) => void;
  setVoiceReview: (drafts: VoiceDraft[], transcript: string) => void;
  clearVoiceReview: () => void;
  setLastDeletedTransactionId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dbRevision: 0,
  profile: null,
  initialized: false,
  initializationError: null,
  isOnline: true,
  syncState: 'disabled',
  syncMessage: null,
  voiceDrafts: [],
  voiceTranscript: '',
  lastDeletedTransactionId: null,
  bumpDbRevision: () => set((state) => ({ dbRevision: state.dbRevision + 1 })),
  setProfile: (profile) => set({ profile }),
  setInitialized: (initialized, error = null) => set({ initialized, initializationError: error }),
  setOnline: (isOnline) => set({ isOnline }),
  setSyncState: (syncState, syncMessage = null) => set({ syncState, syncMessage }),
  setVoiceReview: (voiceDrafts, voiceTranscript) => set({ voiceDrafts, voiceTranscript }),
  clearVoiceReview: () => set({ voiceDrafts: [], voiceTranscript: '' }),
  setLastDeletedTransactionId: (lastDeletedTransactionId) => set({ lastDeletedTransactionId }),
}));
