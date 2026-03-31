/**
 * Tests for QualityEngine signal scorers and ranking.
 */

import {
  computeResolutionScore,
  computeSharpnessProxy,
  computeBrightnessProxy,
  computeFileSizeScore,
  QualityEngine,
} from '../QualityEngine';
import type { PhotoAsset, QualitySignals } from '../../../types';

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

// ─── computeResolutionScore ───────────────────────────────────────────────────

describe('computeResolutionScore', () => {
  it('returns 1.0 when asset has the maximum resolution', () => {
    const a = makeAsset({ width: 4032, height: 3024 }); // 12.2MP
    const maxPixels = 4032 * 3024;
    expect(computeResolutionScore(a, maxPixels)).toBe(1.0);
  });

  it('returns proportional score for lower resolution', () => {
    const a = makeAsset({ width: 2016, height: 1512 }); // 3MP
    const maxPixels = 4032 * 3024;          // 12.2MP
    const score = computeResolutionScore(a, maxPixels);
    expect(score).toBeCloseTo(0.25, 2);
  });

  it('returns 0 when maxPixels is 0', () => {
    const a = makeAsset({ width: 4032, height: 3024 });
    expect(computeResolutionScore(a, 0)).toBe(0);
  });

  it('does not exceed 1.0', () => {
    const a = makeAsset({ width: 4032, height: 3024 });
    const maxPixels = 2016 * 1512; // smaller than asset
    expect(computeResolutionScore(a, maxPixels)).toBe(1.0);
  });
});

// ─── computeSharpnessProxy ────────────────────────────────────────────────────

describe('computeSharpnessProxy', () => {
  it('returns 0.5 for null file size', () => {
    const a = makeAsset({ fileSize: null });
    expect(computeSharpnessProxy(a, 2.0)).toBe(0.5);
  });

  it('returns 0.5 for zero file size', () => {
    const a = makeAsset({ fileSize: 0 });
    expect(computeSharpnessProxy(a, 2.0)).toBe(0.5);
  });

  it('returns 0.5 for zero-dimension asset', () => {
    const a = makeAsset({ width: 0, height: 0, fileSize: 1000 });
    expect(computeSharpnessProxy(a, 2.0)).toBe(0.5);
  });

  it('returns higher score for higher bytes-per-pixel', () => {
    const a = makeAsset({ width: 1000, height: 1000, fileSize: 2_000_000 }); // 2.0 bpp
    const b = makeAsset({ width: 1000, height: 1000, fileSize: 1_000_000 }); // 1.0 bpp
    const maxBpp = 2.0;
    expect(computeSharpnessProxy(a, maxBpp)).toBeGreaterThan(computeSharpnessProxy(b, maxBpp));
  });
});

// ─── computeBrightnessProxy ───────────────────────────────────────────────────

describe('computeBrightnessProxy', () => {
  it('returns 0.5 for a normal photo', () => {
    const a = makeAsset({ filename: 'IMG_0001.jpg' });
    expect(computeBrightnessProxy(a)).toBe(0.5);
  });

  it('returns low score for night photos', () => {
    const a = makeAsset({ filename: 'night_photo.jpg' });
    expect(computeBrightnessProxy(a)).toBeLessThan(0.5);
  });

  it('returns higher score for HDR photos', () => {
    const a = makeAsset({ filename: 'hdr_shot.jpg' });
    expect(computeBrightnessProxy(a)).toBeGreaterThan(0.5);
  });

  it('is case-insensitive', () => {
    const a = makeAsset({ filename: 'NIGHT_SCENE.jpg' });
    expect(computeBrightnessProxy(a)).toBeLessThan(0.5);
  });
});

// ─── computeFileSizeScore ─────────────────────────────────────────────────────

describe('computeFileSizeScore', () => {
  it('returns 1.0 for maximum file size', () => {
    const a = makeAsset({ fileSize: 5_000_000 });
    expect(computeFileSizeScore(a, 5_000_000)).toBe(1.0);
  });

  it('returns proportional score for lower file size', () => {
    const a = makeAsset({ fileSize: 2_500_000 });
    expect(computeFileSizeScore(a, 5_000_000)).toBeCloseTo(0.5, 2);
  });

  it('returns 0.5 for null file size', () => {
    const a = makeAsset({ fileSize: null });
    expect(computeFileSizeScore(a, 5_000_000)).toBe(0.5);
  });
});

// ─── QualityEngine ────────────────────────────────────────────────────────────

describe('QualityEngine', () => {
  const engine = new QualityEngine();

  const highQuality = makeAsset({
    id: 'high',
    width: 4032, height: 3024,
    fileSize: 5_000_000,
    filename: 'IMG_0001.jpg',
  });

  const lowQuality = makeAsset({
    id: 'low',
    width: 1920, height: 1080,
    fileSize: 1_000_000,
    filename: 'night_photo.jpg',
  });

  const medium = makeAsset({
    id: 'mid',
    width: 3000, height: 2000,
    fileSize: 3_000_000,
    filename: 'IMG_0002.jpg',
  });

  describe('computeGroupQuality()', () => {
    it('returns a QualitySignals entry for each asset', () => {
      const result = engine.computeGroupQuality([highQuality, lowQuality, medium]);
      expect(Object.keys(result)).toHaveLength(3);
      expect(result['high']).toBeDefined();
      expect(result['low']).toBeDefined();
      expect(result['mid']).toBeDefined();
    });

    it('assigns compositeScore in [0, 1]', () => {
      const result = engine.computeGroupQuality([highQuality, lowQuality]);
      for (const signals of Object.values(result)) {
        expect(signals.compositeScore).toBeGreaterThanOrEqual(0);
        expect(signals.compositeScore).toBeLessThanOrEqual(1);
      }
    });

    it('gives higher composite score to higher quality asset', () => {
      const result = engine.computeGroupQuality([highQuality, lowQuality]);
      expect(result['high'].compositeScore).toBeGreaterThan(result['low'].compositeScore);
    });

    it('returns empty object for empty input', () => {
      const result = engine.computeGroupQuality([]);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('includes explanations for each asset', () => {
      const result = engine.computeGroupQuality([highQuality, lowQuality]);
      for (const signals of Object.values(result)) {
        expect(signals.explanations).toBeDefined();
        expect(signals.explanations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('rankByQuality()', () => {
    it('sorts asset IDs by composite score descending', () => {
      const qualityMap = engine.computeGroupQuality([highQuality, lowQuality, medium]);
      const ranked = engine.rankByQuality(['low', 'high', 'mid'], qualityMap);
      expect(ranked[0]).toBe('high');
      // mid and low positions depend on exact scores
      expect(ranked).toHaveLength(3);
    });

    it('does not mutate the input array', () => {
      const qualityMap = engine.computeGroupQuality([highQuality, lowQuality]);
      const input = ['low', 'high'];
      const _ = engine.rankByQuality(input, qualityMap);
      expect(input).toEqual(['low', 'high']);
    });

    it('returns the same array for a single element', () => {
      const qualityMap = engine.computeGroupQuality([highQuality]);
      const ranked = engine.rankByQuality(['high'], qualityMap);
      expect(ranked).toEqual(['high']);
    });
  });
});
