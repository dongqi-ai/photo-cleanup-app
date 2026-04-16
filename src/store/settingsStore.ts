import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS } from '@/types';

interface SettingsStore {
  settings: AppSettings;

  // Actions
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetToDefaults: () => void;
  setTimeWindow: (seconds: number) => void;
  setSimilarityThreshold: (threshold: number) => void;
  setConfidenceThreshold: (threshold: number) => void;
  togglePreferRecent: () => void;
  togglePreferLarger: () => void;
  toggleRequireExplicitConfirmation: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: { ...DEFAULT_SETTINGS },

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  resetToDefaults: () =>
    set(() => ({
      settings: { ...DEFAULT_SETTINGS },
    })),

  setTimeWindow: (seconds) =>
    set((state) => ({
      settings: { ...state.settings, timeWindowSeconds: Math.max(5, Math.min(300, seconds)) },
    })),

  setSimilarityThreshold: (threshold) =>
    set((state) => ({
      settings: { ...state.settings, minSimilarityThreshold: Math.max(0.3, Math.min(0.95, threshold)) },
    })),

  setConfidenceThreshold: (threshold) =>
    set((state) => ({
      settings: { ...state.settings, confidenceThreshold: Math.max(0.3, Math.min(0.95, threshold)) },
    })),

  togglePreferRecent: () =>
    set((state) => ({
      settings: { ...state.settings, preferRecent: !state.settings.preferRecent },
    })),

  togglePreferLarger: () =>
    set((state) => ({
      settings: { ...state.settings, preferLarger: !state.settings.preferLarger },
    })),

  toggleRequireExplicitConfirmation: () =>
    set((state) => ({
      settings: {
        ...state.settings,
        requireExplicitConfirmation: !state.settings.requireExplicitConfirmation,
      },
    })),
}));
