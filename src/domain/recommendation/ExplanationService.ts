/**
 * ExplanationService
 *
 * Generates human-readable, accurate explanations for why a photo
 * is recommended to keep or why a group was formed.
 *
 * All output is conservative and avoids overclaiming accuracy.
 * Language: "recommended keep" (not "best shot"), "likely duplicate"
 * (not "identical"), "suggests" (not "proves").
 */

import type { QualitySignals } from '../../types';

export class ExplanationService {
  /**
   * Build a keep reason string for a given asset based on its quality signals.
   */
  buildKeepReason(
    assetId: string,
    qualitySignals: Record<string, QualitySignals>,
  ): string {
    const signals = qualitySignals[assetId];
    if (!signals) return 'Highest overall quality score in the group.';

    const parts: string[] = [];

    if (signals.resolutionScore >= 0.95) {
      parts.push('highest resolution');
    }

    if (signals.sharpnessScore >= 0.85) {
      parts.push('highest detail density (sharpest)');
    } else if (signals.sharpnessScore >= 0.70) {
      parts.push('good detail density');
    }

    if (signals.compositeScore >= 0.85) {
      parts.push('highest overall quality score');
    }

    if (parts.length === 0) {
      return 'Best overall quality among similar photos based on available metadata.';
    }

    const joined = parts.join(', ');
    return `Recommended keep: ${joined}.`;
  }

  /**
   * Build a short label for a confidence level.
   */
  confidenceLabel(confidence: number): string {
    if (confidence >= 0.90) return 'High confidence';
    if (confidence >= 0.70) return 'Moderate confidence';
    if (confidence >= 0.50) return 'Low confidence';
    return 'Very low confidence';
  }

  /**
   * Build a user-facing description for a group's status.
   */
  groupStatusDescription(status: string): string {
    switch (status) {
      case 'actionable':
        return 'Likely duplicates — recommended keep identified.';
      case 'manual-review':
        return 'Possible duplicates — quality is similar. Please review manually.';
      case 'skipped':
        return 'Only one photo in this group — no action needed.';
      case 'ineligible':
        return 'Filtered out before analysis.';
      default:
        return 'Unknown status.';
    }
  }

  /**
   * Deletion plan item reason.
   */
  buildDeletionReason(
    assetId: string,
    keepId: string,
    qualitySignals: Record<string, QualitySignals>,
  ): string {
    const keepSignals = qualitySignals[keepId];
    const thisSignals = qualitySignals[assetId];
    if (!keepSignals || !thisSignals) {
      return 'Lower quality than recommended keep in this group.';
    }
    const margin = keepSignals.compositeScore - thisSignals.compositeScore;
    const pct = (margin * 100).toFixed(0);
    return `Quality score ${pct}% lower than recommended keep.`;
  }
}
