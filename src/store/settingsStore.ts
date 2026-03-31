/**
 * Settings Store
 *
 * Manages app settings with sane defaults.
 * In a future version, settings would be persisted via AsyncStorage.
 */

import { create } from 'zustand';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },

  updateSettings: (partial) =>
    set(state => ({
      settings: { ...state.settings, ...partial },
    })),

  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
}));
