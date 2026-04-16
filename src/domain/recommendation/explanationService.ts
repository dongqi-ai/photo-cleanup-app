import { ClusterRecommendation, QualityScore, RecommendationReason, ExplanationService } from '@/types';

export class SimpleExplanationService implements ExplanationService {
  explain(recommendation: ClusterRecommendation, scores: QualityScore[]): RecommendationReason {
    const keepScore = scores.find((s) => s.photoId === recommendation.keepPhotoId);
    const details: string[] = [];

    if (!keepScore) {
      return {
        summary: 'Recommended keep (reason unavailable)',
        details: ['No quality data available for explanation.'],
      };
    }

    // Build explanation from top signals
    const topSignals = [...keepScore.signals]
      .sort((a, b) => b.normalizedScore * b.weight - a.normalizedScore * a.weight)
      .slice(0, 3);

    for (const signal of topSignals) {
      if (signal.normalizedScore > 0.5) {
        details.push(this.formatSignal(signal));
      }
    }

    // Add confidence context
    if (recommendation.margin >= 0.25) {
      details.push('Clear winner — significantly higher quality than alternatives.');
    } else if (recommendation.margin >= 0.15) {
      details.push('Modest quality advantage — review if unsure.');
    }

    const summary = this.buildSummary(keepScore, recommendation);

    return {
      summary,
      details: details.length > 0 ? details : ['Review this group to confirm.'],
    };
  }

  private formatSignal(signal: QualityScore['signals'][0]): string {
    switch (signal.name) {
      case 'resolution':
        return `Higher resolution (${signal.description})`;
      case 'fileSize':
        return `Larger file, likely more detail`;
      case 'recency':
        return `Later in the burst sequence`;
      case 'hasHDR':
        return `HDR photo with better dynamic range`;
      case 'hasLivePhoto':
        return `Live Photo captures motion`;
      default:
        return signal.description;
    }
  }

  private buildSummary(keepScore: QualityScore, recommendation: ClusterRecommendation): string {
    const parts: string[] = ['Recommended keep'];

    const resolutionSignal = keepScore.signals.find((s) => s.name === 'resolution');
    if (resolutionSignal && resolutionSignal.normalizedScore > 0.8) {
      parts.push('— highest resolution in group');
    }

    const hdrSignal = keepScore.signals.find((s) => s.name === 'hasHDR');
    if (hdrSignal && hdrSignal.normalizedScore === 1) {
      parts.push('with HDR');
    }

    return parts.join(' ');
  }
}
