import {
  PhotoCluster,
  ClusterRecommendation,
  QualityScore,
  ClusterStatus,
  RecommendationService,
} from '@/types';
import {
  MetadataQualityEngine,
  computeConfidenceMargin,
  isConfidenceSufficient,
  getConfidenceLabel,
} from '@/domain/quality/qualityEngine';
import { ExplanationService, SimpleExplanationService } from './explanationService';
import { CONFIDENCE_THRESHOLD, CLUSTERING_MIN_SIZE } from '@/constants';

export class ConservativeRecommendationService implements RecommendationService {
  private qualityEngine: MetadataQualityEngine;
  private explanationService: ExplanationService;

  constructor(
    qualityEngine?: MetadataQualityEngine,
    explanationService?: ExplanationService
  ) {
    this.qualityEngine = qualityEngine ?? new MetadataQualityEngine();
    this.explanationService = explanationService ?? new SimpleExplanationService();
  }

  recommend(cluster: PhotoCluster, scores?: QualityScore[]): ClusterRecommendation | null {
    // Only actionable clusters with 2+ photos get recommendations
    if (cluster.photos.length < CLUSTERING_MIN_SIZE) {
      return null;
    }

    // Compute quality scores if not provided
    const qualityScores = scores ?? this.qualityEngine.rank(cluster.photos);

    // Sort by score descending
    const sorted = [...qualityScores].sort((a, b) => b.totalScore - a.totalScore);

    if (sorted.length === 0) return null;

    const top = sorted[0];
    const runnerUp = sorted.length > 1 ? sorted[1] : null;

    // Compute confidence margin
    const margin = runnerUp
      ? computeConfidenceMargin(sorted, 0, 1)
      : 1.0; // single runner-up case

    const confidenceSufficient = isConfidenceSufficient(margin);

    // If confidence is too low, do not auto-recommend — return null
    // The cluster should be marked manual_review by the caller
    if (!confidenceSufficient) {
      return null;
    }

    const keepPhotoId = top.photoId;
    const deletePhotoIds = sorted
      .slice(1)
      .map((s) => s.photoId)
      .filter((id) => id !== keepPhotoId);

    const recommendation: ClusterRecommendation = {
      keepPhotoId,
      deletePhotoIds,
      confidence: margin,
      reason: this.explanationService.explain(
        {
          keepPhotoId,
          deletePhotoIds,
          confidence: margin,
          reason: { summary: '', details: [] },
          margin,
        },
        qualityScores
      ),
      margin,
    };

    return recommendation;
  }
}

// Build recommendations for all clusters, setting appropriate statuses
export function buildRecommendationsForClusters(
  clusters: PhotoCluster[],
  service: ConservativeRecommendationService
): PhotoCluster[] {
  return clusters.map((cluster) => {
    if (cluster.photos.length < CLUSTERING_MIN_SIZE) {
      return { ...cluster, status: 'skipped' as ClusterStatus };
    }

    const scores = new MetadataQualityEngine().rank(cluster.photos);
    const recommendation = service.recommend(cluster, scores);

    if (!recommendation) {
      // No recommendation = low confidence, mark for manual review
      return {
        ...cluster,
        status: 'manual_review' as ClusterStatus,
      };
    }

    return {
      ...cluster,
      status: 'actionable' as ClusterStatus,
      recommendation,
    };
  });
}
