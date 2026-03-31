/**
 * Review Store
 *
 * Manages user review decisions: which groups have been reviewed,
 * which photo to keep per group, and the deletion plan.
 */

import { create } from 'zustand';
import type { PhotoGroup, DeletionPlan, ReviewDecision } from '../types';

interface ReviewState {
  groups: PhotoGroup[];
  deletionPlan: DeletionPlan | null;
  decisions: Map<string, ReviewDecision>;
  currentGroupIndex: number;

  // ── Actions ──────────────────────────────────────────────────────────
  setGroups: (groups: PhotoGroup[]) => void;
  markReviewed: (groupId: string) => void;
  setKeep: (groupId: string, keepId: string) => void;
  setUserDeletionIds: (groupId: string, deletionIds: string[]) => void;
  toggleUserDeletion: (groupId: string, assetId: string) => void;
  acceptRecommendation: (groupId: string) => void;
  setDeletionPlan: (plan: DeletionPlan) => void;
  updateDeletionPlan: (plan: DeletionPlan) => void;
  setCurrentGroupIndex: (index: number) => void;
  reset: () => void;

  // ── Derived ──────────────────────────────────────────────────────────
  getGroup: (groupId: string) => PhotoGroup | undefined;
  reviewedCount: () => number;
  totalActionableGroups: () => number;
  allGroupsReviewed: () => boolean;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  groups: [],
  deletionPlan: null,
  decisions: new Map(),
  currentGroupIndex: 0,

  setGroups: (groups) => set({ groups, currentGroupIndex: 0 }),

  markReviewed: (groupId) =>
    set(state => ({
      groups: state.groups.map(g =>
        g.id === groupId ? { ...g, reviewed: true } : g,
      ),
    })),

  setKeep: (groupId, keepId) =>
    set(state => ({
      groups: state.groups.map(g => {
        if (g.id !== groupId) return g;
        // When user sets keep, remove keepId from deletion list
        const userDeletionIds = g.userDeletionIds.filter(id => id !== keepId);
        // All other assetIds go into deletion
        const otherIds = g.assetIds.filter(id => id !== keepId);
        return {
          ...g,
          userKeepId: keepId,
          userDeletionIds: otherIds,
          reviewed: true,
        };
      }),
    })),

  setUserDeletionIds: (groupId, deletionIds) =>
    set(state => ({
      groups: state.groups.map(g =>
        g.id === groupId
          ? { ...g, userDeletionIds: deletionIds, reviewed: true }
          : g,
      ),
    })),

  toggleUserDeletion: (groupId, assetId) =>
    set(state => ({
      groups: state.groups.map(g => {
        if (g.id !== groupId) return g;
        const ids = g.userDeletionIds.includes(assetId)
          ? g.userDeletionIds.filter(id => id !== assetId)
          : [...g.userDeletionIds, assetId];
        return { ...g, userDeletionIds: ids, reviewed: true };
      }),
    })),

  acceptRecommendation: (groupId) =>
    set(state => ({
      groups: state.groups.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          userKeepId: g.recommendedKeepId,
          userDeletionIds: g.plannedDeletionIds,
          reviewed: true,
        };
      }),
    })),

  setDeletionPlan: (plan) => set({ deletionPlan: plan }),

  updateDeletionPlan: (plan) => set({ deletionPlan: plan }),

  setCurrentGroupIndex: (index) => set({ currentGroupIndex: index }),

  reset: () =>
    set({
      groups: [],
      deletionPlan: null,
      decisions: new Map(),
      currentGroupIndex: 0,
    }),

  // ── Derived ─────────────────────────────────────────────────────────
  getGroup: (groupId) => get().groups.find(g => g.id === groupId),

  reviewedCount: () => get().groups.filter(g => g.reviewed).length,

  totalActionableGroups: () =>
    get().groups.filter(g => g.status === 'actionable' || g.status === 'manual-review').length,

  allGroupsReviewed: () => {
    const groups = get().groups.filter(
      g => g.status === 'actionable' || g.status === 'manual-review',
    );
    return groups.length > 0 && groups.every(g => g.reviewed);
  },
}));
