import { create } from 'zustand';
import { PhotoCluster, DeletionPlan, ProcessingStage } from '@/types';

interface ProcessingStore {
  stage: ProcessingStage;
  progress: number;
  clusters: PhotoCluster[];
  plan: DeletionPlan | null;
  isComplete: boolean;
  error: string | null;

  // Actions
  setStage: (stage: ProcessingStage, progress: number) => void;
  setClusters: (clusters: PhotoCluster[]) => void;
  setPlan: (plan: DeletionPlan) => void;
  markComplete: () => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Computed
  getActionableClusters: () => PhotoCluster[];
  getManualReviewClusters: () => PhotoCluster[];
  getSkippedClusters: () => PhotoCluster[];
  getTotalPhotosInClusters: () => number;
  getTotalPhotosRecommendedForDeletion: () => number;
}

const initialState = {
  stage: 'idle' as ProcessingStage,
  progress: 0,
  clusters: [] as PhotoCluster[],
  plan: null,
  isComplete: false,
  error: null,
};

export const useProcessingStore = create<ProcessingStore>((set, get) => ({
  ...initialState,

  setStage: (stage, progress) =>
    set(() => ({
      stage,
      progress,
    })),

  setClusters: (clusters) =>
    set(() => ({
      clusters,
    })),

  setPlan: (plan) =>
    set(() => ({
      plan,
    })),

  markComplete: () =>
    set(() => ({
      isComplete: true,
      stage: 'complete',
      progress: 1,
    })),

  setError: (error) =>
    set(() => ({
      error,
      isComplete: true,
    })),

  reset: () => set(() => ({ ...initialState })),

  getActionableClusters: () =>
    get().clusters.filter((c) => c.status === 'actionable'),

  getManualReviewClusters: () =>
    get().clusters.filter((c) => c.status === 'manual_review'),

  getSkippedClusters: () =>
    get().clusters.filter((c) => c.status === 'skipped' || c.status === 'ineligible'),

  getTotalPhotosInClusters: () =>
    get().clusters.reduce((sum, c) => sum + c.photos.length, 0),

  getTotalPhotosRecommendedForDeletion: () => {
    const { clusters } = get();
    return clusters
      .filter((c) => c.status === 'actionable' && c.recommendation)
      .reduce((sum, c) => sum + (c.recommendation?.deletePhotoIds.length ?? 0), 0);
  },
}));
