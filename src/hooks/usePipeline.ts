/**
 * usePipeline
 *
 * Hook that runs the analysis pipeline and updates the processing and review stores.
 */

import { useCallback } from 'react';
import { Pipeline } from '../domain/photo/Pipeline';
import { buildDeletionPlan } from '../domain/cleanup/DeletionPlanner';
import { useProcessingStore } from '../store/processingStore';
import { useReviewStore } from '../store/reviewStore';
import { useSettingsStore } from '../store/settingsStore';
import type { PhotoAsset } from '../types';

export function usePipeline() {
  const { setProgress, setResult, setError, reset: resetProcessing } = useProcessingStore();
  const { setGroups, setDeletionPlan, reset: resetReview } = useReviewStore();
  const { settings } = useSettingsStore();

  const run = useCallback(async (assets: PhotoAsset[]) => {
    resetProcessing();
    resetReview();

    const pipeline = new Pipeline(settings);

    try {
      const result = await pipeline.run(assets, (progress) => {
        setProgress(progress);
      });

      setResult(result);
      setGroups(result.groups);

      // Build initial deletion plan from actionable groups
      const assetFilenameMap: Record<string, string> = {};
      const assetUriMap: Record<string, string> = {};
      for (const asset of assets) {
        assetFilenameMap[asset.id] = asset.filename;
        assetUriMap[asset.id] = asset.uri;
      }

      const plan = buildDeletionPlan(result.groups, assetFilenameMap, assetUriMap);
      setDeletionPlan(plan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pipeline failed';
      setError(msg);
    }
  }, [settings, setProgress, setResult, setError, setGroups, setDeletionPlan, resetProcessing, resetReview]);

  return { run };
}
