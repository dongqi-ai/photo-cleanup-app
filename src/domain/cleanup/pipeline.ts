import {
  PhotoAsset,
  PhotoAnalysisInput,
  CandidatePair,
  PhotoCluster,
  DeletionPlan,
  ProcessingState,
  ProcessingStage,
  AppSettings,
} from '@/types';
import { PhotoAssetService } from '@/domain/photo/photoAssetService';
import { ThumbnailService } from '@/domain/photo/thumbnailService';
import { SimilarityEngine } from '@/domain/similarity/similarityEngine';
import { ClusteringEngine } from '@/domain/similarity/clusteringEngine';
import { ConservativeRecommendationService, buildRecommendationsForClusters } from '@/domain/recommendation/recommendationService';
import { DeletionPlanner } from './deletionPlanner';
import { DEFAULT_SETTINGS } from '@/constants';

export interface PipelineDependencies {
  assetService: PhotoAssetService;
  thumbnailService: ThumbnailService;
  similarityEngine: SimilarityEngine;
  clusteringEngine: ClusteringEngine;
  recommendationService: ConservativeRecommendationService;
  deletionPlanner: DeletionPlanner;
}

export interface PipelineCallbacks {
  onStageChange: (stage: ProcessingStage, progress: number) => void;
  onComplete: (clusters: PhotoCluster[], plan: DeletionPlan) => void;
  onError: (error: string) => void;
}

// Main pipeline orchestrator
export class CleanupPipeline {
  private deps: PipelineDependencies;
  private settings: AppSettings;
  private callbacks: PipelineCallbacks;

  constructor(
    deps: PipelineDependencies,
    callbacks: PipelineCallbacks,
    settings: AppSettings = DEFAULT_SETTINGS
  ) {
    this.deps = deps;
    this.settings = settings;
    this.callbacks = callbacks;
  }

  async run(selectedAssets: PhotoAsset[]): Promise<void> {
    try {
      // Stage 1: Normalize/filter assets
      this.callbacks.onStageChange('normalizing', 0.1);
      const validAssets = this.normalizeAssets(selectedAssets);
      if (validAssets.length < 2) {
        this.callbacks.onError('Need at least 2 photos to find duplicates.');
        return;
      }

      // Stage 2: Build analysis inputs (thumbnails/metadata)
      this.callbacks.onStageChange('building_thumbnails', 0.2);
      const analysisInputs = await this.deps.thumbnailService.buildAnalysisInputs(validAssets);

      // Stage 3: Generate candidate pairs
      this.callbacks.onStageChange('generating_candidates', 0.4);
      const candidates = await this.deps.similarityEngine.findCandidates(analysisInputs);

      if (candidates.length === 0) {
        this.callbacks.onComplete([], this.deps.deletionPlanner.buildPlan([]));
        return;
      }

      // Stage 4: Cluster accepted pairs
      this.callbacks.onStageChange('clustering', 0.55);
      const clusters = this.deps.clusteringEngine.cluster(candidates);

      // Stage 5-6: Rank and build recommendations
      this.callbacks.onStageChange('ranking', 0.7);
      const clustersWithRecs = buildRecommendationsForClusters(
        clusters,
        this.deps.recommendationService
      );

      // Stage 7: Build deletion plan
      this.callbacks.onStageChange('building_plan', 0.9);
      const plan = this.deps.deletionPlanner.buildPlan(clustersWithRecs);

      this.callbacks.onStageChange('complete', 1.0);
      this.callbacks.onComplete(clustersWithRecs, plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pipeline failed';
      this.callbacks.onError(message);
    }
  }

  private normalizeAssets(assets: PhotoAsset[]): PhotoAsset[] {
    return assets.filter((asset) => {
      // Only photos
      if (asset.mediaType !== 'photo') return false;
      // Must have dimensions
      if (asset.width <= 0 || asset.height <= 0) return false;
      // Must have creation time
      if (asset.creationTime <= 0) return false;
      return true;
    });
  }
}
