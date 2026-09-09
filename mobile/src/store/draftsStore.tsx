import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface LocalDraft {
  id: string; // uuid for local identification
  tenantId: string;
  workspaceId: string;
  title: string;
  content: string;
  campaignTheme?: string;
  platforms: string[];
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  localImage?: string | null;
  updatedAt: number;
}

interface DraftsState {
  drafts: LocalDraft[];
  saveDraft: (draft: Omit<LocalDraft, 'id' | 'updatedAt'> & { id?: string }) => void;
  deleteDraft: (id: string) => void;
  clearDrafts: () => void;
}

export const useDraftsStore = create<DraftsState>()(
  persist(
    (set) => ({
      drafts: [],
      saveDraft: (draftData) => set((state) => {
        const now = Date.now();
        if (draftData.id) {
          return {
            drafts: state.drafts.map((d) =>
              d.id === draftData.id ? { ...d, ...draftData, updatedAt: now } : d
            ),
          };
        } else {
          const newDraft = { ...draftData, id: uuidv4(), updatedAt: now } as LocalDraft;
          return {
            drafts: [newDraft, ...state.drafts],
          };
        }
      }),
      deleteDraft: (id) => set((state) => ({
        drafts: state.drafts.filter((d) => d.id !== id),
      })),
      clearDrafts: () => set({ drafts: [] }),
    }),
    {
      name: 'mako-offline-drafts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
