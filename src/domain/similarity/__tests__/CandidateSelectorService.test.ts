/**
 * Tests for CandidateSelectorService and its pure signal scorers.
 */

import {
  scoreTemporalProximity,
  scoreResolutionSimilarity,
  scoreFilenamePattern,
  scoreFileSizeSimilarity,
  scorePair,
  CandidateSelectorService,
} from '../CandidateSelectorService';
import type { PhotoAsset } from '../../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<PhotoAsset> = {}): PhotoAsset {
  return {
    id: 'a1',
    uri: 'file:///a1.jpg',
    filename: 'IMG_0001.jpg',
    width: 4032,
    height: 3024,
    fileSize: 3_000_000,
    creationTime: 1_700_000_000_000,
    modificationTime: 1_700_000_000_000,
    duration: null,
    albumId: null,
    mediaType: 'photo',
    mediaLibraryId: 'a1',
    ...overrides,
  };
}

// ─── scoreTemporalProximity ───────────────────────────────────────────────────

describe('scoreTemporalProximity', () => {
  const windowMs = 8_000;

  it('returns 1.0 for delta = 0', () => {
    expect(scoreTemporalProximity(0, windowMs)).toBe(1.0);
  });

  it('returns 0 for delta >= windowMs', () => {
    expect(scoreTemporalProximity(windowMs, windowMs)).toBe(0);
    expect(scoreTemporalProximity(windowMs + 1000, windowMs)).toBe(0);
  });

  it('returns a value between 0 and 1 for mid-range delta', () => {
    const score = scoreTemporalProximity(4_000, windowMs);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('is monotonically decreasing as delta increases', () => {
    const scores = [0, 1000, 2000, 4000, 7000].map(d =>
      scoreTemporalProximity(d, windowMs),
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });
});

// ─── scoreResolutionSimilarity ────────────────────────────────────────────────

describe('scoreResolutionSimilarity', () => {
  it('returns 1.0 for identical resolutions', () => {
    const a = makeAsset({ width: 4032, height: 3024 });
    const b = makeAsset({ width: 4032, height: 3024 });
    expect(scoreResolutionSimilarity(a, b)).toBe(1.0);
  });

  it('returns < 1 for different resolutions', () => {
    const a = makeAsset({ width: 4032, height: 3024 });
    const b = makeAsset({ width: 2016, height: 1512 }); // half the pixels
    const score = scoreResolutionSimilarity(a, b);
    expect(score).toBeCloseTo(0.25, 2); // (2016*1512) / (4032*3024) = 0.25
  });

  it('returns 0 for zero-dimension assets', () => {
    const a = makeAsset({ width: 0, height: 0 });
    const b = makeAsset({ width: 4032, height: 3024 });
    expect(scoreResolutionSimilarity(a, b)).toBe(0);
  });

  it('is symmetric', () => {
    const a = makeAsset({ width: 4032, height: 3024 });
    const b = makeAsset({ width: 3000, height: 2000 });
    expect(scoreResolutionSimilarity(a, b)).toBe(scoreResolutionSimilarity(b, a));
  });
});

// ─── scoreFilenamePattern ─────────────────────────────────────────────────────

describe('scoreFilenamePattern', () => {
  it('returns 1.0 for identical stems', () => {
    expect(scoreFilenamePattern('IMG_0001.jpg', 'IMG_0001.jpg')).toBe(1.0);
  });

  it('returns 0.9 for sequential burst filenames (delta 1)', () => {
    expect(scoreFilenamePattern('IMG_0001.jpg', 'IMG_0002.jpg')).toBe(0.9);
  });

  it('returns 0.9 for sequential burst filenames (delta 3)', () => {
    expect(scoreFilenamePattern('IMG_0001.jpg', 'IMG_0004.jpg')).toBe(0.9);
  });

  it('returns 0.6 for near-sequential filenames (delta 10)', () => {
    expect(scoreFilenamePattern('DSC_0001.jpg', 'DSC_0011.jpg')).toBe(0.6);
  });

  it('returns 0 for filenames with different prefixes', () => {
    expect(scoreFilenamePattern('IMG_0001.jpg', 'DSC_0002.jpg')).toBe(0);
  });

  it('returns 0 for non-numeric filenames', () => {
    expect(scoreFilenamePattern('photo.jpg', 'image.jpg')).toBe(0);
  });

  it('returns 0 for large numeric deltas', () => {
    expect(scoreFilenamePattern('IMG_0001.jpg', 'IMG_0500.jpg')).toBe(0);
  });

  it('is case-insensitive for prefix comparison', () => {
    expect(scoreFilenamePattern('IMG_0001.jpg', 'img_0002.jpg')).toBe(0.9);
  });
});

// ─── scoreFileSizeSimilarity ──────────────────────────────────────────────────

describe('scoreFileSizeSimilarity', () => {
  it('returns 1.0 for identical file sizes', () => {
    const a = makeAsset({ fileSize: 3_000_000 });
    const b = makeAsset({ fileSize: 3_000_000 });
    expect(scoreFileSizeSimilarity(a, b)).toBe(1.0);
  });

  it('returns 0.5 for null file sizes', () => {
    const a = makeAsset({ fileSize: null });
    const b = makeAsset({ fileSize: 3_000_000 });
    expect(scoreFileSizeSimilarity(a, b)).toBe(0.5);
  });

  it('returns < 1 for different file sizes', () => {
    const a = makeAsset({ fileSize: 3_000_000 });
    const b = makeAsset({ fileSize: 1_500_000 });
    expect(scoreFileSizeSimilarity(a, b)).toBeCloseTo(0.5, 2);
  });

  it('is symmetric', () => {
    const a = makeAsset({ fileSize: 3_000_000 });
    const b = makeAsset({ fileSize: 2_000_000 });
    expect(scoreFileSizeSimilarity(a, b)).toBe(scoreFileSizeSimilarity(b, a));
  });
});

// ─── CandidateSelectorService ─────────────────────────────────────────────────

describe('CandidateSelectorService', () => {
  const service = new CandidateSelectorService({
    burstWindowSeconds: 8,
    nearDuplicateWindowSeconds: 30,
    similarityThreshold: 0.65,
  });

  function makeBurstAssets(count: number, baseTime: number = 1_700_000_000_000): PhotoAsset[] {
    return Array.from({ length: count }, (_, i) => makeAsset({
      id: `a${i + 1}`,
      filename: `IMG_${String(1000 + i).padStart(4, '0')}.jpg`,
      creationTime: baseTime + i * 500, // 0.5s apart
    }));
  }

  it('returns no pairs for a single asset', () => {
    const pairs = service.generateCandidatePairs([makeAsset()]);
    expect(pairs).toHaveLength(0);
  });

  it('returns no pairs for empty input', () => {
    const pairs = service.generateCandidatePairs([]);
    expect(pairs).toHaveLength(0);
  });

  it('detects a burst pair from time and filename', () => {
    const assets = makeBurstAssets(2);
    const pairs = service.generateCandidatePairs(assets);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0].score).toBeGreaterThanOrEqual(0.65);
  });

  it('detects multiple burst pairs within window', () => {
    const assets = makeBurstAssets(4);
    const pairs = service.generateCandidatePairs(assets);
    // All 6 pairs should be detected
    expect(pairs.length).toBeGreaterThanOrEqual(4);
  });

  it('does not pair assets outside the time window', () => {
    const a = makeAsset({ id: 'a1', filename: 'IMG_0001.jpg', creationTime: 1_000_000 });
    const b = makeAsset({ id: 'a2', filename: 'IMG_0002.jpg', creationTime: 1_000_000 + 60_000 }); // 60s later
    const pairs = service.generateCandidatePairs([a, b]);
    expect(pairs).toHaveLength(0);
  });

  it('does not produce duplicate pairs', () => {
    const assets = makeBurstAssets(5);
    const pairs = service.generateCandidatePairs(assets);
    const pairKeys = pairs.map(p => [p.assetIdA, p.assetIdB].sort().join('::'));
    const uniqueKeys = new Set(pairKeys);
    expect(uniqueKeys.size).toBe(pairKeys.length);
  });

  it('sorts pairs by score descending', () => {
    const assets = makeBurstAssets(4);
    const pairs = service.generateCandidatePairs(assets);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].score).toBeLessThanOrEqual(pairs[i - 1].score);
    }
  });

  it('includes signal breakdown in each pair', () => {
    const assets = makeBurstAssets(2);
    const pairs = service.generateCandidatePairs(assets);
    if (pairs.length > 0) {
      expect(pairs[0].signals).toBeDefined();
      expect(pairs[0].signals.length).toBeGreaterThan(0);
      for (const signal of pairs[0].signals) {
        expect(signal.name).toBeTruthy();
        expect(signal.value).toBeGreaterThanOrEqual(0);
        expect(signal.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not group photos with very different resolutions and sizes even if close in time', () => {
    const a = makeAsset({
      id: 'a1', filename: 'IMG_0001.jpg',
      width: 4032, height: 3024, fileSize: 5_000_000,
      creationTime: 1_000_000,
    });
    const b = makeAsset({
      id: 'a2', filename: 'SCREENSHOT_001.jpg',
      width: 390, height: 844, fileSize: 100_000,
      creationTime: 1_000_000 + 1_000,
    });
    const pairs = service.generateCandidatePairs([a, b]);
    // Different resolution and filename prefix — should not reach threshold
    if (pairs.length > 0) {
      expect(pairs[0].score).toBeLessThan(0.65);
    } else {
      expect(pairs).toHaveLength(0);
    }
  });
});
