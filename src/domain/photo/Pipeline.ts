/**
 * Pipeline
 *
 * Orchestrates the full photo analysis pipeline:
 *   1. Normalize / filter assets
 *   2. Generate candidate pairs (time-aware windowing + metadata heuristics)
 *   3. Cluster pairs into groups (Union-Find)
 *   4. Compute quality signals per group
 *   5. Rank assets within each group by quality
 *   6. Apply recommendations (keep + deletion plan candidates)
 *
 * The pipeline emits progress updates via a callback so the UI can show
 * incremental progress rather than a blank spinner.
 *
 * All stages are pure (no side effects) except the progress callback.
 * This makes the pipeline deterministic and unit-testable.
 */

import type {
  PhotoAsset,
  PhotoGroup,
  ProcessingResult,
  PipelineProgress,
  PipelineStage,
  AppSettings,
} from '../../types';
import { CandidateSelectorService } from '../similarity/CandidateSelectorService';
import { ClusteringEngine } from '../similarity/ClusteringEngine';
import { QualityEngine } from '../quality/QualityEngine';
import { RecommendationService } from '../recommendation/RecommendationService';

export type ProgressCallback = (progress: PipelineProgress) => void;

// ---------------------------------------------------------------------------
// Asset normalisation / filtering
// ---------------------------------------------------------------------------

/**
 * Filter out assets that are not eligible for analysis:
 *   - Videos (MVP is photo-only)
 *   - Zero-dimension assets
 *   - Duplicate IDs (shouldn't happen, but defensive)
 */
export function normalizeAssets(assets: PhotoAsset[]): {
  eligible: PhotoAsset[];
  ineligible: PhotoAsset[];
} {
  const seen = new Set<string>();
  const eligible: PhotoAsset[] = [];
  const ineligible: PhotoAsset[] = [];

  for (const asset of assets) {
    if (seen.has(asset.id)) {
      ineligible.push(asset);
      continue;
    }
    seen.add(asset.id);

    if (asset.mediaType !== 'photo' || asset.width === 0 || asset.height === 0) {
      ineligible.push(asset);
      continue;
    }

    eligible.push(asset);
  }

  return { eligible, ineligible };
}

// ---------------------------------------------------------------------------
// Pipeline class
// ---------------------------------------------------------------------------

function emit(callback: ProgressCallback | undefined, stage: PipelineStage, progress: number, message: string): void {
  callback?.({ stage, progress, message });
}

export class Pipeline {
  private readonly candidateSelector: CandidateSelectorService;
  private readonly clusteringEngine: ClusteringEngine;
  private readonly qualityEngine: QualityEngine;
  private readonly recommendationService: RecommendationService;

  constructor(settings?: Partial<AppSettings>) {
    this.candidateSelector = new CandidateSelectorService({
      burstWindowSeconds: settings?.burstWindowSeconds,
      similarityThreshold: settings?.similarityThreshold,
    });
    this.clusteringEngine = new ClusteringEngine();
    this.qualityEngine = new QualityEngine();
    this.recommendationService = new RecommendationService({
      confidenceThreshold: settings?.recommendationConfidenceThreshold,
    });
  }

  async run(
    assets: PhotoAsset[],
    onProgress?: ProgressCallback,
  ): Promise<ProcessingResult> {
    const start = Date.now();

    // ── Stage 1: Normalize ────────────────────────────────────────────────
    emit(onProgress, 'normalizing', 0.05, 'Filtering photos…');
    const { eligible } = normalizeAssets(assets);

    if (eligible.length < 2) {
      emit(onProgress, 'complete', 1.0, 'Done');
      return {
        groups: [],
        ungroupedAssetIds: eligible.map(a => a.id),
        candidatePairs: [],
        processedAt: Date.now(),
        totalPhotosAnalyzed: eligible.length,
        actionableGroups: 0,
        manualReviewGroups: 0,
        photosEligibleForDeletion: 0,
      };
    }

    // Build asset lookup maps once
    const assetMap = new Map<string, PhotoAsset>(eligible.map(a => [a.id, a]));

    // ── Stage 2: Generate candidate pairs ────────────────────────────────
    emit(onProgress, 'pairing', 0.20, 'Finding similar photo pairs…');
    const candidatePairs = this.candidateSelector.generateCandidatePairs(eligible);

    // ── Stage 3: Cluster pairs ────────────────────────────────────────────
    emit(onProgress, 'clustering', 0.40, 'Grouping photos…');
    const allAssetIds = eligible.map(a => a.id);
    const { groups: rawGroups, ungroupedAssetIds } = this.clusteringEngine.cluster(
      candidatePairs,
      allAssetIds,
    );

    // ── Stage 4 & 5: Quality signals + ranking ───────────────────────────
    emit(onProgress, 'ranking', 0.60, 'Ranking photo quality…');

    const rankedGroups: PhotoGroup[] = rawGroups.map(rawGroup => {
      const groupAssets = rawGroup.assetIds
        .map(id => assetMap.get(id))
        .filter((a): a is PhotoAsset => a !== undefined);

      const qualitySignals = this.qualityEngine.computeGroupQuality(groupAssets);
      const sortedIds = this.qualityEngine.rankByQuality(rawGroup.assetIds, qualitySignals);

      return {
        ...rawGroup,
        assetIds: sortedIds,
        qualitySignals,
        reviewed: false,
        userKeepId: null,
        userDeletionIds: [],
      } satisfies PhotoGroup;
    });

    // ── Stage 6: Recommendations ─────────────────────────────────────────
    emit(onProgress, 'building-plan', 0.80, 'Building recommendations…');
    const finalGroups = this.recommendationService.applyRecommendations(rankedGroups);

    // ── Done ─────────────────────────────────────────────────────────────
    emit(onProgress, 'complete', 1.0, 'Analysis complete');

    const actionableGroups = finalGroups.filter(g => g.status === 'actionable').length;
    const manualReviewGroups = finalGroups.filter(g => g.status === 'manual-review').length;
    const photosEligibleForDeletion = finalGroups
      .filter(g => g.status === 'actionable')
      .reduce((sum, g) => sum + g.plannedDeletionIds.length, 0);

    return {
      groups: finalGroups,
      ungroupedAssetIds,
      candidatePairs,
      processedAt: Date.now(),
      totalPhotosAnalyzed: eligible.length,
      actionableGroups,
      manualReviewGroups,
      photosEligibleForDeletion,
    };
  }
}
