/**
 * QualityEngine
 *
 * Computes per-photo quality signals from available metadata.
 *
 * MVP uses deterministic metadata-derived heuristics. There is no
 * image decoding or pixel analysis in this stage — that would require
 * a native embedding adapter (TFLite / CoreML).
 *
 * Signals computed:
 *   - Resolution score: normalised by group maximum
 *   - Sharpness proxy: estimated from file size relative to resolution
 *     (well-focused photos tend to have more detail, compressing less)
 *   - Brightness proxy: heuristic from filename patterns and metadata
 *   - Composite score: weighted combination
 *
 * All signals are 0–1. Higher is better.
 */

import type { PhotoAsset, QualitySignals } from '../../types';
import { QUALITY_WEIGHTS } from '../../constants';

// ---------------------------------------------------------------------------
// Individual signal scorers (pure, unit-testable)
// ---------------------------------------------------------------------------

/**
 * Resolution score: ratio of this photo's pixel count to the group max.
 * A photo with fewer pixels gets a proportionally lower score.
 */
export function computeResolutionScore(
  asset: PhotoAsset,
  maxPixels: number,
): number {
  if (maxPixels === 0) return 0;
  const pixels = asset.width * asset.height;
  return Math.min(pixels / maxPixels, 1.0);
}

/**
 * Sharpness proxy: bytes per pixel.
 * Photos with more detail (sharper, less compressed) have higher
 * bytes-per-pixel ratios than blurry or heavily compressed ones.
 * Normalised by group maximum.
 */
export function computeSharpnessProxy(
  asset: PhotoAsset,
  maxBytesPerPixel: number,
): number {
  if (asset.fileSize === null || asset.fileSize === 0) return 0.5;
  const pixels = asset.width * asset.height;
  if (pixels === 0) return 0.5;
  if (maxBytesPerPixel === 0) return 0.5;

  const bpp = asset.fileSize / pixels;
  return Math.min(bpp / maxBytesPerPixel, 1.0);
}

/**
 * Brightness proxy: a heuristic combining time-of-day (if derivable)
 * and filename suffixes. MVP version returns a neutral 0.5 for most photos,
 * but can detect _night / _dark / hdr suffixes as signals.
 *
 * This is intentionally simple — it affects the score very little compared
 * to resolution and sharpness, so false signals don't cause bad picks.
 */
export function computeBrightnessProxy(asset: PhotoAsset): number {
  const lname = asset.filename.toLowerCase();

  // Night/dark indicators tend to produce noisier shots
  if (/night|dark|_n\d|nocturne/i.test(lname)) return 0.35;

  // HDR often indicates challenging lighting — slightly prefer
  if (/hdr/i.test(lname)) return 0.65;

  // Default: neutral
  return 0.5;
}

/**
 * File size score: normalised by group maximum.
 * A higher file size (for the same resolution) usually means less
 * lossy compression and more image data retained.
 */
export function computeFileSizeScore(
  asset: PhotoAsset,
  maxFileSize: number,
): number {
  if (asset.fileSize === null || asset.fileSize === 0) return 0.5;
  if (maxFileSize === 0) return 0.5;
  return Math.min(asset.fileSize / maxFileSize, 1.0);
}

// ---------------------------------------------------------------------------
// Group-level normalization factors
// ---------------------------------------------------------------------------

interface GroupNorms {
  maxPixels: number;
  maxBytesPerPixel: number;
  maxFileSize: number;
}

function computeGroupNorms(assets: PhotoAsset[]): GroupNorms {
  let maxPixels = 0;
  let maxBytesPerPixel = 0;
  let maxFileSize = 0;

  for (const a of assets) {
    const pixels = a.width * a.height;
    maxPixels = Math.max(maxPixels, pixels);
    maxFileSize = Math.max(maxFileSize, a.fileSize ?? 0);

    if (pixels > 0 && a.fileSize !== null && a.fileSize > 0) {
      maxBytesPerPixel = Math.max(maxBytesPerPixel, a.fileSize / pixels);
    }
  }

  return { maxPixels, maxBytesPerPixel, maxFileSize };
}

// ---------------------------------------------------------------------------
// Explanation builders
// ---------------------------------------------------------------------------

function buildExplanations(
  signals: Omit<QualitySignals, 'assetId' | 'explanations' | 'compositeScore'>,
  asset: PhotoAsset,
): string[] {
  const parts: string[] = [];

  if (signals.resolutionScore >= 0.95) {
    parts.push(`Highest resolution in group (${asset.width}×${asset.height})`);
  } else if (signals.resolutionScore < 0.80) {
    parts.push(`Lower resolution than group best (${asset.width}×${asset.height})`);
  }

  if (signals.sharpnessScore >= 0.90) {
    parts.push('High detail density (likely sharper)');
  } else if (signals.sharpnessScore < 0.50) {
    parts.push('Lower detail density (may be blurry or more compressed)');
  }

  if (signals.brightnessScore < 0.45) {
    parts.push('Filename suggests challenging lighting (night/dark)');
  }

  if (signals.compositeScore >= 0.85) {
    parts.push('Overall quality signals are strong');
  }

  if (parts.length === 0) {
    parts.push('Moderate quality — similar to others in group');
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

export class QualityEngine {
  /**
   * Compute quality signals for all assets in a group.
   * Assets are passed as a group because normalization requires group-level stats.
   */
  computeGroupQuality(assets: PhotoAsset[]): Record<string, QualitySignals> {
    if (assets.length === 0) return {};

    const norms = computeGroupNorms(assets);
    const result: Record<string, QualitySignals> = {};

    for (const asset of assets) {
      const resolutionScore = computeResolutionScore(asset, norms.maxPixels);
      const sharpnessScore = computeSharpnessProxy(asset, norms.maxBytesPerPixel);
      const brightnessScore = computeBrightnessProxy(asset);
      const fileSizeScore = computeFileSizeScore(asset, norms.maxFileSize);

      const compositeScore =
        resolutionScore * QUALITY_WEIGHTS.resolution +
        sharpnessScore * QUALITY_WEIGHTS.sharpness +
        brightnessScore * QUALITY_WEIGHTS.brightness +
        fileSizeScore * QUALITY_WEIGHTS.fileSize;

      const signals = { resolutionScore, sharpnessScore, brightnessScore, compositeScore };
      const explanations = buildExplanations(signals, asset);

      result[asset.id] = {
        assetId: asset.id,
        resolutionScore,
        sharpnessScore,
        brightnessScore,
        compositeScore,
        explanations,
      };
    }

    return result;
  }

  /**
   * Sort asset IDs within a group by composite quality (descending).
   * Returns a new sorted array — does not mutate the input.
   */
  rankByQuality(
    assetIds: string[],
    qualityMap: Record<string, QualitySignals>,
  ): string[] {
    return [...assetIds].sort((a, b) => {
      const qa = qualityMap[a]?.compositeScore ?? 0;
      const qb = qualityMap[b]?.compositeScore ?? 0;
      return qb - qa;
    });
  }
}

export const qualityEngine = new QualityEngine();
