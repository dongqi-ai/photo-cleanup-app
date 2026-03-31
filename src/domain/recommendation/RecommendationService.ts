/**
 * RecommendationService
 *
 * Given ranked quality signals for a group, decides:
 *   1. Whether to make an auto-recommendation (confidence >= threshold).
 *   2. Which photo to recommend as "keep" if confident.
 *   3. Which photos go into the deletion plan candidate list.
 *   4. Group status: 'actionable' vs 'manual-review'.
 *
 * Conservative by design:
 *   - If the margin between the best and second-best quality scores is
 *     below MIN_QUALITY_MARGIN, the group is marked 'manual-review' rather
 *     than auto-recommending.
 *   - Confidence is derived from the score margin, not just the top score.
 *   - Language: "recommended keep", not "best shot".
 */

import type { PhotoGroup, QualitySignals } from '../../types';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  MIN_QUALITY_MARGIN,
} from '../../constants';
import { ExplanationService } from './ExplanationService';

export interface RecommendationOptions {
  confidenceThreshold?: number;
  minQualityMargin?: number;
}

const explanationService = new ExplanationService();

// ---------------------------------------------------------------------------
// Confidence computation (pure — testable)
// ---------------------------------------------------------------------------

/**
 * Compute a confidence score based on the quality margin between rank-1 and rank-2.
 *
 * Logic:
 *   - margin = topScore - secondScore
 *   - confidence = sigmoid-like function of margin
 *   - Full confidence (1.0) requires margin >= 0.25
 *   - Zero confidence at margin = 0
 */
export function computeConfidence(
  topScore: number,
  secondScore: number,
): number {
  if (topScore <= secondScore) return 0;
  const margin = topScore - secondScore;
  // Linear ramp from 0 at margin=0 to 1.0 at margin≥0.25
  return Math.min(margin / 0.25, 1.0);
}

/**
 * Determine group status from confidence and threshold.
 */
export function determineGroupStatus(
  confidence: number,
  margin: number,
  confidenceThreshold: number,
  minMargin: number,
): PhotoGroup['status'] {
  if (confidence >= confidenceThreshold && margin >= minMargin) {
    return 'actionable';
  }
  return 'manual-review';
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export class RecommendationService {
  private readonly confidenceThreshold: number;
  private readonly minQualityMargin: number;

  constructor(options: RecommendationOptions = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    this.minQualityMargin = options.minQualityMargin ?? MIN_QUALITY_MARGIN;
  }

  /**
   * Apply recommendations to all groups in place (returns new array).
   * Requires that groups already have assetIds sorted by quality (rank 0 = best)
   * and qualitySignals populated.
   */
  applyRecommendations(
    groups: PhotoGroup[],
  ): PhotoGroup[] {
    return groups.map(group => this.recommendForGroup(group));
  }

  private recommendForGroup(group: PhotoGroup): PhotoGroup {
    const { assetIds, qualitySignals } = group;

    if (assetIds.length < 2) {
      return { ...group, status: 'skipped', confidence: 0 };
    }

    // assetIds is sorted by quality descending (best first)
    const topId = assetIds[0];
    const secondId = assetIds[1];

    const topSignals: QualitySignals | undefined = qualitySignals[topId];
    const secondSignals: QualitySignals | undefined = qualitySignals[secondId];

    const topScore = topSignals?.compositeScore ?? 0;
    const secondScore = secondSignals?.compositeScore ?? 0;

    const confidence = computeConfidence(topScore, secondScore);
    const margin = topScore - secondScore;

    const status = determineGroupStatus(
      confidence,
      margin,
      this.confidenceThreshold,
      this.minQualityMargin,
    );

    const isActionable = status === 'actionable';

    const keepReason = isActionable
      ? explanationService.buildKeepReason(topId, qualitySignals)
      : null;

    const recommendedKeepId = isActionable ? topId : null;
    const plannedDeletionIds = isActionable
      ? assetIds.slice(1)       // all except the recommended keep
      : [];                     // manual review: no auto-planned deletions

    return {
      ...group,
      status,
      recommendedKeepId,
      plannedDeletionIds,
      confidence,
      keepReason,
    };
  }
}

export const recommendationService = new RecommendationService();
