/**
 * CandidateSelectorService
 *
 * Generates candidate pairs of potentially similar photos using
 * time-aware windowing and metadata heuristics. This is the first
 * stage of the pipeline — it prunes the O(n²) comparison space
 * to a manageable set of candidates.
 *
 * Algorithm:
 *   1. Sort assets by creationTime ascending.
 *   2. Within a configurable time window, compare each photo against
 *      all others in the window.
 *   3. Score each pair using four metadata signals.
 *   4. Accept pairs above the similarity threshold.
 *
 * Precision over recall: we'd rather miss a duplicate group than
 * group unrelated photos.
 */

import type { PhotoAsset, CandidatePair, SimilaritySignal } from '../../types';
import {
  BURST_WINDOW_SECONDS,
  NEAR_DUPLICATE_WINDOW_SECONDS,
  DEFAULT_SIMILARITY_THRESHOLD,
  SIMILARITY_WEIGHTS,
} from '../../constants';

export interface CandidateSelectorOptions {
  /** Time window for burst detection (seconds) */
  burstWindowSeconds?: number;
  /** Time window for near-duplicate detection (seconds) */
  nearDuplicateWindowSeconds?: number;
  /** Minimum score to accept a pair */
  similarityThreshold?: number;
}

// ---------------------------------------------------------------------------
// Signal scorers (pure functions — unit-testable in isolation)
// ---------------------------------------------------------------------------

/**
 * Temporal score: 1.0 at delta=0, decays to 0 as delta approaches windowMs.
 * Uses an exponential decay so very close shots get much higher scores.
 */
export function scoreTemporalProximity(
  deltaMs: number,
  windowMs: number,
): number {
  if (deltaMs <= 0) return 1.0;
  if (deltaMs >= windowMs) return 0.0;
  // Exponential decay: e^(-k * ratio) where k controls the steepness
  const ratio = deltaMs / windowMs;
  const k = 3.0;
  return Math.exp(-k * ratio);
}

/**
 * Resolution similarity: how close are the two photos' pixel counts?
 * Returns 1.0 for identical resolutions, lower for different sizes.
 */
export function scoreResolutionSimilarity(
  a: PhotoAsset,
  b: PhotoAsset,
): number {
  const pixA = a.width * a.height;
  const pixB = b.width * b.height;
  if (pixA === 0 || pixB === 0) return 0;
  const ratio = Math.min(pixA, pixB) / Math.max(pixA, pixB);
  return ratio;
}

/**
 * Filename pattern score: detects burst naming conventions.
 * e.g. IMG_1234.jpg vs IMG_1235.jpg, or DSC_0001 vs DSC_0002
 * Returns 1.0 if filenames differ by only 1-3 trailing digits.
 */
export function scoreFilenamePattern(
  filenameA: string,
  filenameB: string,
): number {
  // Strip extension
  const stemA = filenameA.replace(/\.[^.]+$/, '');
  const stemB = filenameB.replace(/\.[^.]+$/, '');

  // Extract trailing numeric suffix
  const numMatch = /^(.*?)(\d+)$/;
  const matchA = stemA.match(numMatch);
  const matchB = stemB.match(numMatch);

  if (!matchA || !matchB) return 0;

  const prefixA = matchA[1];
  const prefixB = matchB[1];
  const numA = parseInt(matchA[2], 10);
  const numB = parseInt(matchB[2], 10);

  // Prefixes must match (case-insensitive) and numbers must be close
  if (prefixA.toLowerCase() !== prefixB.toLowerCase()) return 0;

  const delta = Math.abs(numA - numB);
  if (delta === 0) return 1.0;  // identical names
  if (delta <= 3) return 0.9;  // burst sequence
  if (delta <= 10) return 0.6;
  return 0;
}

/**
 * File size similarity: near-identical file sizes often mean duplicate exports.
 */
export function scoreFileSizeSimilarity(
  a: PhotoAsset,
  b: PhotoAsset,
): number {
  if (a.fileSize === null || b.fileSize === null || a.fileSize === 0 || b.fileSize === 0) {
    return 0.5; // Unknown — neither helps nor hurts
  }
  const ratio = Math.min(a.fileSize, b.fileSize) / Math.max(a.fileSize, b.fileSize);
  return ratio;
}

// ---------------------------------------------------------------------------
// Pair scoring (weighted combination of signals)
// ---------------------------------------------------------------------------

export function scorePair(
  a: PhotoAsset,
  b: PhotoAsset,
  windowMs: number,
): { score: number; signals: SimilaritySignal[] } {
  const deltaMs = Math.abs(a.creationTime - b.creationTime);

  const temporal = scoreTemporalProximity(deltaMs, windowMs);
  const resolution = scoreResolutionSimilarity(a, b);
  const filename = scoreFilenamePattern(a.filename, b.filename);
  const fileSize = scoreFileSizeSimilarity(a, b);

  const score =
    temporal * SIMILARITY_WEIGHTS.temporal +
    resolution * SIMILARITY_WEIGHTS.resolution +
    filename * SIMILARITY_WEIGHTS.filename +
    fileSize * SIMILARITY_WEIGHTS.fileSize;

  const signals: SimilaritySignal[] = [
    {
      name: 'temporal_proximity',
      value: temporal,
      weight: SIMILARITY_WEIGHTS.temporal,
      description: `Time difference: ${(deltaMs / 1000).toFixed(1)}s`,
    },
    {
      name: 'resolution_match',
      value: resolution,
      weight: SIMILARITY_WEIGHTS.resolution,
      description: `Resolution similarity: ${(resolution * 100).toFixed(0)}%`,
    },
    {
      name: 'filename_pattern',
      value: filename,
      weight: SIMILARITY_WEIGHTS.filename,
      description: filename > 0 ? 'Sequential filename pattern detected' : 'No filename pattern match',
    },
    {
      name: 'file_size',
      value: fileSize,
      weight: SIMILARITY_WEIGHTS.fileSize,
      description: `File size similarity: ${(fileSize * 100).toFixed(0)}%`,
    },
  ];

  return { score, signals };
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export class CandidateSelectorService {
  private readonly burstWindowMs: number;
  private readonly nearDuplicateWindowMs: number;
  private readonly threshold: number;

  constructor(options: CandidateSelectorOptions = {}) {
    this.burstWindowMs =
      (options.burstWindowSeconds ?? BURST_WINDOW_SECONDS) * 1000;
    this.nearDuplicateWindowMs =
      (options.nearDuplicateWindowSeconds ?? NEAR_DUPLICATE_WINDOW_SECONDS) * 1000;
    this.threshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  }

  /**
   * Generate candidate pairs from a list of assets.
   * Assets are sorted by creationTime internally; the caller need not pre-sort.
   *
   * Time complexity: O(n * w) where w is the average window size.
   * Typically much better than O(n²) for real photo libraries.
   */
  generateCandidatePairs(assets: PhotoAsset[]): CandidatePair[] {
    if (assets.length < 2) return [];

    // Sort by creation time ascending
    const sorted = [...assets].sort((a, b) => a.creationTime - b.creationTime);

    const pairs: CandidatePair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];

      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const delta = b.creationTime - a.creationTime;

        // Use the larger window as the outer bound
        if (delta > this.nearDuplicateWindowMs) break;

        // Choose effective window based on delta range
        const effectiveWindowMs =
          delta <= this.burstWindowMs
            ? this.burstWindowMs
            : this.nearDuplicateWindowMs;

        const pairKey = [a.id, b.id].sort().join('::');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const { score, signals } = scorePair(a, b, effectiveWindowMs);

        if (score >= this.threshold) {
          pairs.push({
            assetIdA: a.id,
            assetIdB: b.id,
            score,
            signals,
          });
        }
      }
    }

    // Sort by score descending
    pairs.sort((a, b) => b.score - a.score);
    return pairs;
  }
}

export const candidateSelectorService = new CandidateSelectorService();
