/**
 * useDeletion
 *
 * Hook that exposes deletion plan management and execution.
 * Execution requires all items to be confirmed first — no auto-delete.
 */

import { useCallback, useState } from 'react';
import {
  buildDeletionPlan,
  DeletionExecutor,
  confirmAllItems,
  toggleItemConfirmation,
} from '../domain/cleanup/DeletionPlanner';
import { photoAssetService } from '../domain/photo/PhotoAssetService';
import { useReviewStore } from '../store/reviewStore';
import type { DeletionPlan } from '../types';

interface UseDeletionReturn {
  executing: boolean;
  error: string | null;
  rebuildPlan: () => void;
  confirmItem: (assetId: string) => void;
  confirmAll: () => void;
  executePlan: () => Promise<void>;
}

const executor = new DeletionExecutor(photoAssetService);

export function useDeletion(): UseDeletionReturn {
  const { groups, deletionPlan, setDeletionPlan, updateDeletionPlan } = useReviewStore();
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rebuildPlan = useCallback(() => {
    const assetFilenameMap: Record<string, string> = {};
    const assetUriMap: Record<string, string> = {};

    for (const group of groups) {
      for (const assetId of group.assetIds) {
        assetFilenameMap[assetId] = assetId;
        assetUriMap[assetId] = '';
      }
    }

    const plan = buildDeletionPlan(groups, assetFilenameMap, assetUriMap);
    setDeletionPlan(plan);
  }, [groups, setDeletionPlan]);

  const confirmItem = useCallback((assetId: string) => {
    if (!deletionPlan) return;
    const updated = toggleItemConfirmation(deletionPlan, assetId);
    updateDeletionPlan(updated);
  }, [deletionPlan, updateDeletionPlan]);

  const confirmAll = useCallback(() => {
    if (!deletionPlan) return;
    const updated = confirmAllItems(deletionPlan);
    updateDeletionPlan(updated);
  }, [deletionPlan, updateDeletionPlan]);

  const executePlan = useCallback(async () => {
    if (!deletionPlan) return;
    setExecuting(true);
    setError(null);
    try {
      const result = await executor.execute(deletionPlan);
      updateDeletionPlan(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      setError(msg);
    } finally {
      setExecuting(false);
    }
  }, [deletionPlan, updateDeletionPlan]);

  return { executing, error, rebuildPlan, confirmItem, confirmAll, executePlan };
}
