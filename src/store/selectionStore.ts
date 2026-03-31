/**
 * Selection Store
 *
 * Manages the set of photos the user has selected for analysis.
 * Selection is capped at MAX_SELECTION_SIZE to keep the pipeline fast.
 */

import { create } from 'zustand';
import type { PhotoAsset } from '../types';
import { MAX_SELECTION_SIZE } from '../constants';

interface SelectionState {
  /** All photos available in the current picker session */
  availableAssets: PhotoAsset[];
  /** User-selected asset IDs */
  selectedIds: Set<string>;
  /** Whether the full asset list is loaded */
  assetsLoaded: boolean;
  /** Cursor for pagination */
  nextCursor: string | undefined;
  /** Whether we're loading more assets */
  loadingMore: boolean;

  // ── Actions ──────────────────────────────────────────────────────────
  setAvailableAssets: (assets: PhotoAsset[], nextCursor?: string) => void;
  appendAssets: (assets: PhotoAsset[], nextCursor?: string) => void;
  toggleSelection: (assetId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setLoadingMore: (loading: boolean) => void;
  reset: () => void;

  // ── Computed (derived) ───────────────────────────────────────────────
  selectedAssets: () => PhotoAsset[];
  selectionCount: () => number;
  isSelected: (assetId: string) => boolean;
  canSelectMore: () => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  availableAssets: [],
  selectedIds: new Set(),
  assetsLoaded: false,
  nextCursor: undefined,
  loadingMore: false,

  setAvailableAssets: (assets, nextCursor) =>
    set({ availableAssets: assets, assetsLoaded: true, nextCursor }),

  appendAssets: (assets, nextCursor) =>
    set(state => ({
      availableAssets: [...state.availableAssets, ...assets],
      nextCursor,
    })),

  toggleSelection: (assetId) =>
    set(state => {
      const next = new Set(state.selectedIds);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else if (next.size < MAX_SELECTION_SIZE) {
        next.add(assetId);
      }
      return { selectedIds: next };
    }),

  selectAll: () =>
    set(state => {
      const limited = state.availableAssets
        .slice(0, MAX_SELECTION_SIZE)
        .map(a => a.id);
      return { selectedIds: new Set(limited) };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setLoadingMore: (loading) => set({ loadingMore: loading }),

  reset: () =>
    set({
      availableAssets: [],
      selectedIds: new Set(),
      assetsLoaded: false,
      nextCursor: undefined,
      loadingMore: false,
    }),

  // ── Derived ─────────────────────────────────────────────────────────
  selectedAssets: () => {
    const { availableAssets, selectedIds } = get();
    return availableAssets.filter(a => selectedIds.has(a.id));
  },

  selectionCount: () => get().selectedIds.size,

  isSelected: (assetId) => get().selectedIds.has(assetId),

  canSelectMore: () => get().selectedIds.size < MAX_SELECTION_SIZE,
}));
