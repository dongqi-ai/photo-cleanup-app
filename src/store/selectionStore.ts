import { create } from 'zustand';
import { PhotoAsset } from '@/types';

interface SelectionStore {
  selectedIds: Set<string>;
  assets: PhotoAsset[];
  isLoading: boolean;
  error: string | null;

  // Actions
  toggleSelection: (asset: PhotoAsset) => void;
  selectMultiple: (assets: PhotoAsset[]) => void;
  deselectAll: () => void;
  setAssets: (assets: PhotoAsset[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getSelectedCount: () => number;
  getSelectedAssets: () => PhotoAsset[];
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedIds: new Set(),
  assets: [],
  isLoading: false,
  error: null,

  toggleSelection: (asset) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(asset.id)) {
        newSet.delete(asset.id);
      } else {
        newSet.add(asset.id);
      }
      return { selectedIds: newSet };
    }),

  selectMultiple: (assets) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      for (const asset of assets) {
        newSet.add(asset.id);
      }
      return { selectedIds: newSet };
    }),

  deselectAll: () =>
    set(() => ({
      selectedIds: new Set(),
    })),

  setAssets: (assets) =>
    set(() => ({
      assets,
    })),

  setLoading: (loading) =>
    set(() => ({
      isLoading: loading,
    })),

  setError: (error) =>
    set(() => ({
      error,
    })),

  getSelectedCount: () => get().selectedIds.size,

  getSelectedAssets: () => {
    const { selectedIds, assets } = get();
    return assets.filter((a) => selectedIds.has(a.id));
  },

  isSelected: (id) => get().selectedIds.has(id),
}));
