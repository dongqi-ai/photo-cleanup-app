import { create } from 'zustand';
import { DeletionPlan, UserClusterDecision, PhotoCluster } from '@/types';
import { DeletionPlanner } from '@/domain/cleanup/deletionPlanner';

interface ReviewStore {
  currentClusterIndex: number;
  userDecisions: Map<string, UserClusterDecision>;
  plan: DeletionPlan | null;
  isPlanConfirmed: boolean;

  // Actions
  setPlan: (plan: DeletionPlan) => void;
  nextCluster: () => void;
  previousCluster: () => void;
  goToCluster: (index: number) => void;
  setUserDecision: (decision: UserClusterDecision) => void;
  confirmCluster: (clusterId: string) => void;
  unconfirmCluster: (clusterId: string) => void;
  overrideKeepPhoto: (clusterId: string, newKeepPhotoId: string) => void;
  reset: () => void;

  // Computed
  getCurrentClusterPlan: () => import('@/types').ClusterDeletionPlan | undefined;
  getConfirmedCount: () => number;
  getUnconfirmedCount: () => number;
  getAllConfirmed: () => boolean;
  getFinalPlan: () => DeletionPlan | null;
}

const initialState = {
  currentClusterIndex: 0,
  userDecisions: new Map<string, UserClusterDecision>(),
  plan: null,
  isPlanConfirmed: false,
};

export const useReviewStore = create<ReviewStore>((set, get) => ({
  ...initialState,

  setPlan: (plan) =>
    set(() => ({
      plan,
      currentClusterIndex: 0,
      userDecisions: new Map(),
      isPlanConfirmed: false,
    })),

  nextCluster: () =>
    set((state) => {
      if (!state.plan) return state;
      const maxIndex = state.plan.clusters.length - 1;
      return {
        currentClusterIndex: Math.min(state.currentClusterIndex + 1, maxIndex),
      };
    }),

  previousCluster: () =>
    set((state) => ({
      currentClusterIndex: Math.max(state.currentClusterIndex - 1, 0),
    })),

  goToCluster: (index) =>
    set((state) => {
      if (!state.plan) return state;
      const maxIndex = state.plan.clusters.length - 1;
      return {
        currentClusterIndex: Math.max(0, Math.min(index, maxIndex)),
      };
    }),

  setUserDecision: (decision) =>
    set((state) => {
      const newDecisions = new Map(state.userDecisions);
      newDecisions.set(decision.clusterId, decision);
      return { userDecisions: newDecisions };
    }),

  confirmCluster: (clusterId) =>
    set((state) => {
      if (!state.plan) return state;
      const planner = new DeletionPlanner();
      const updatedPlan = planner.confirmCluster(state.plan, clusterId);
      return { plan: updatedPlan };
    }),

  unconfirmCluster: (clusterId) =>
    set((state) => {
      if (!state.plan) return state;
      const planner = new DeletionPlanner();
      const updatedPlan = planner.unconfirmCluster(state.plan, clusterId);
      return { plan: updatedPlan };
    }),

  overrideKeepPhoto: (clusterId, newKeepPhotoId) =>
    set((state) => {
      if (!state.plan) return state;
      const clusterPlan = state.plan.clusters.find((c) => c.clusterId === clusterId);
      if (!clusterPlan) return state;

      const allPhotoIds = [clusterPlan.keepPhotoId, ...clusterPlan.deletePhotoIds];
      const newDeleteIds = allPhotoIds.filter((id) => id !== newKeepPhotoId);

      const decision: UserClusterDecision = {
        clusterId,
        keepPhotoId: newKeepPhotoId,
        deletePhotoIds: newDeleteIds,
        overrideReason: 'User manually selected different keep photo',
      };

      const newDecisions = new Map(state.userDecisions);
      newDecisions.set(clusterId, decision);

      const planner = new DeletionPlanner();
      const updatedPlan = planner.applyUserDecisions(state.plan, newDecisions);

      return {
        userDecisions: newDecisions,
        plan: updatedPlan,
      };
    }),

  reset: () => set(() => ({ ...initialState })),

  getCurrentClusterPlan: () => {
    const { plan, currentClusterIndex } = get();
    if (!plan) return undefined;
    return plan.clusters[currentClusterIndex];
  },

  getConfirmedCount: () => {
    const { plan } = get();
    if (!plan) return 0;
    return plan.clusters.filter((c) => c.confirmed).length;
  },

  getUnconfirmedCount: () => {
    const { plan } = get();
    if (!plan) return 0;
    return plan.clusters.filter((c) => !c.confirmed).length;
  },

  getAllConfirmed: () => {
    const { plan } = get();
    if (!plan || plan.clusters.length === 0) return false;
    return plan.clusters.every((c) => c.confirmed);
  },

  getFinalPlan: () => {
    const { plan, userDecisions } = get();
    if (!plan) return null;
    const planner = new DeletionPlanner();
    return planner.applyUserDecisions(plan, userDecisions);
  },
}));
