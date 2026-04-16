import { PhotoAnalysisInput, QualityScore, QualitySignal, QualityEngine } from '@/types';
import { QUALITY_WEIGHTS, CONFIDENCE_THRESHOLD } from '@/constants';

// Interpretable quality engine using metadata-derived signals
export class MetadataQualityEngine implements QualityEngine {
  rank(photos: PhotoAnalysisInput[]): QualityScore[] {
    if (photos.length === 0) return [];

    // Compute raw values for normalization
    const resolutions = photos.map((p) => p.metadata.width * p.metadata.height);
    const maxResolution = Math.max(...resolutions, 1);
    const maxFileSize = Math.max(...photos.map((p) => p.metadata.fileSize ?? 0), 1);
    const maxTime = Math.max(...photos.map((p) => p.metadata.creationTime), 1);

    return photos.map((photo, index) => {
      const signals: QualitySignal[] = [];

      // 1. Resolution (higher is better)
      const resolution = resolutions[index];
      const resolutionScore = resolution / maxResolution;
      signals.push({
        name: 'resolution',
        weight: QUALITY_WEIGHTS.resolution,
        rawValue: resolution,
        normalizedScore: resolutionScore,
        description: `${photo.metadata.width} x ${photo.metadata.height}`,
      });

      // 2. File size (larger often means less compression, more detail)
      const fileSize = photo.metadata.fileSize ?? 0;
      const fileSizeScore = maxFileSize > 0 ? fileSize / maxFileSize : 0;
      signals.push({
        name: 'fileSize',
        weight: QUALITY_WEIGHTS.fileSize,
        rawValue: fileSize,
        normalizedScore: fileSizeScore,
        description: fileSize > 0 ? `Estimated ${(fileSize / 1024 / 1024).toFixed(2)} MB` : 'Size unknown',
      });

      // 3. Recency (newer is often preferred in burst sequences)
      const timeScore = maxTime > 0 ? photo.metadata.creationTime / maxTime : 0;
      signals.push({
        name: 'recency',
        weight: QUALITY_WEIGHTS.recency,
        rawValue: photo.metadata.creationTime,
        normalizedScore: timeScore,
        description: `Taken at ${new Date(photo.metadata.creationTime).toLocaleTimeString()}`,
      });

      // 4. HDR bonus
      const hdrScore = photo.metadata.hasHDR ? 1 : 0;
      signals.push({
        name: 'hasHDR',
        weight: QUALITY_WEIGHTS.hasHDR,
        rawValue: photo.metadata.hasHDR ? 1 : 0,
        normalizedScore: hdrScore,
        description: photo.metadata.hasHDR ? 'HDR photo' : 'Standard photo',
      });

      // 5. Live Photo bonus
      const liveScore = photo.metadata.hasLivePhoto ? 1 : 0;
      signals.push({
        name: 'hasLivePhoto',
        weight: QUALITY_WEIGHTS.hasLivePhoto,
        rawValue: photo.metadata.hasLivePhoto ? 1 : 0,
        normalizedScore: liveScore,
        description: photo.metadata.hasLivePhoto ? 'Live Photo' : 'Still photo',
      });

      // Compute total weighted score
      const totalScore = signals.reduce((sum, s) => sum + s.normalizedScore * s.weight, 0);

      return {
        photoId: photo.asset.id,
        totalScore,
        signals,
      };
    });
  }
}

// Compute confidence level based on score margin between top candidates
export function computeConfidenceMargin(
  scores: QualityScore[],
  topIndex: number,
  runnerUpIndex: number
): number {
  if (scores.length < 2) return 0;
  const topScore = scores[topIndex].totalScore;
  const runnerUpScore = scores[runnerUpIndex].totalScore;
  const maxPossible = 1.0;
  const margin = (topScore - runnerUpScore) / maxPossible;
  return Math.max(0, margin);
}

// Determine if confidence is sufficient for auto-recommendation
export function isConfidenceSufficient(margin: number): boolean {
  return margin >= 0.15; // 15% margin required
}

// Get confidence label
export function getConfidenceLabel(margin: number): string {
  if (margin >= 0.25) return 'High confidence';
  if (margin >= 0.15) return 'Medium confidence';
  return 'Low confidence — review recommended';
}
