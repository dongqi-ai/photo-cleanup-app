import { useCallback, useState } from 'react';
import { PhotoAsset, PhotoCluster, DeletionPlan, ProcessingStage } from '@/types';
import { CleanupPipeline, PipelineDependencies, PipelineCallbacks } from '@/domain/cleanup/pipeline';
import { useProcessingStore } from '@/store/processingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { AppSettings } from '@/types';

export function useProcessing(deps: PipelineDependencies) {
  const [isRunning, setIsRunning] = useState(false);
  const { setStage, setClusters, setPlan, markComplete, setError, reset } = useProcessingStore();
  const { settings } = useSettingsStore();

  const runPipeline = useCallback(
    async (selectedAssets: PhotoAsset[]) => {
      if (isRunning) return;
      setIsRunning(true);
      reset();

      const callbacks: PipelineCallbacks = {
        onStageChange: (stage: ProcessingStage, progress: number) => {
          setStage(stage, progress);
        },
        onComplete: (clusters: PhotoCluster[], plan: DeletionPlan) => {
          setClusters(clusters);
          setPlan(plan);
          markComplete();
          setIsRunning(false);
        },
        onError: (error: string) => {
          setError(error);
          setIsRunning(false);
        },
      };

      const pipeline = new CleanupPipeline(deps, callbacks, settings);
      await pipeline.run(selectedAssets);
    },
    [deps, isRunning, setStage, setClusters, setPlan, markComplete, setError, reset, settings]
  );

  const cancel = useCallback(() => {
    // Pipeline cancellation would require AbortController integration
    // For MVP, we just mark as error
    setError('Processing cancelled by user');
    setIsRunning(false);
  }, [setError]);

  return {
    isRunning,
    runPipeline,
    cancel,
  };
}
