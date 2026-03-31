/**
 * Tests for RecommendationService and related pure functions.
 */

import {
  computeConfidence,
  determineGroupStatus,
  RecommendationService,
} from '../RecommendationService';
import type { PhotoGroup, QualitySignals } from '../../../types';

// ─── computeConfidence ────────────────────────────────────────────────────────

describe('computeConfidence', () => {
  it('returns 0 when top <= second', () => {
    expect(computeConfidence(0.5, 0.5)).toBe(0);
    expect(computeConfidence(0.4, 0.5)).toBe(0);
  });

  it('returns 1.0 for margin >= 0.25', () => {
    expect(computeConfidence(0.9, 0.65)).toBe(1.0);
    expect(computeConfidence(1.0, 0.70)).toBe(1.0);
  });

  it('returns proportional confidence for smaller margins', () => {
    // margin = 0.125 → confidence = 0.5
    expect(computeConfidence(0.75, 0.625)).toBeCloseTo(0.5, 2);
  });

  it('never exceeds 1.0', () => {
    expect(computeConfidence(1.0, 0.0)).toBe(1.0);
  });

  it('is 0 for margin = 0', () => {
    expect(computeConfidence(0.8, 0.8)).toBe(0);
  });
});

// ─── determineGroupStatus ─────────────────────────────────────────────────────

describe('determineGroupStatus', () => {
  it('returns actionable when confidence and margin both meet threshold', () => {
    const status = determineGroupStatus(0.80, 0.15, 0.70, 0.08);
    expect(status).toBe('actionable');
  });

  it('returns manual-review when confidence is below threshold', () => {
    const status = determineGroupStatus(0.60, 0.15, 0.70, 0.08);
    expect(status).toBe('manual-review');
  });

  it('returns manual-review when margin is below minimum', () => {
    const status = determineGroupStatus(0.90, 0.05, 0.70, 0.08);
    expect(status).toBe('manual-review');
  });

  it('returns manual-review when both are below threshold', () => {
    const status = determineGroupStatus(0.50, 0.03, 0.70, 0.08);
    expect(status).toBe('manual-review');
  });
});

// ─── RecommendationService ────────────────────────────────────────────────────

function makeGroup(
  overrides: Partial<PhotoGroup> = {},
  qualityScores: Record<string, number> = {},
): PhotoGroup {
  const assetIds = overrides.assetIds ?? ['best', 'ok', 'worst'];
  const qualitySignals: Record<string, QualitySignals> = {};
  for (const id of assetIds) {
    qualitySignals[id] = {
      assetId: id,
      resolutionScore: qualityScores[id] ?? 0.5,
      sharpnessScore: qualityScores[id] ?? 0.5,
      brightnessScore: 0.5,
      compositeScore: qualityScores[id] ?? 0.5,
      explanations: ['test'],
    };
  }

  return {
    id: 'group1',
    status: 'actionable',
    assetIds,
    recommendedKeepId: null,
    plannedDeletionIds: [],
    groupScore: 0.8,
    confidence: 0,
    groupReason: 'Test group',
    keepReason: null,
    qualitySignals: { ...qualitySignals, ...overrides.qualitySignals },
    reviewed: false,
    userKeepId: null,
    userDeletionIds: [],
    ...overrides,
  };
}

describe('RecommendationService', () => {
  const service = new RecommendationService({
    confidenceThreshold: 0.70,
    minQualityMargin: 0.08,
  });

  describe('applyRecommendations()', () => {
    it('recommends the highest-scoring asset as keep', () => {
      const group = makeGroup(
        { assetIds: ['best', 'ok', 'worst'] },
        { best: 0.90, ok: 0.60, worst: 0.40 },
      );
      const [result] = service.applyRecommendations([group]);
      expect(result.recommendedKeepId).toBe('best');
    });

    it('sets plannedDeletionIds to all non-keep assets', () => {
      const group = makeGroup(
        { assetIds: ['best', 'ok', 'worst'] },
        { best: 0.90, ok: 0.60, worst: 0.40 },
      );
      const [result] = service.applyRecommendations([group]);
      expect(result.plannedDeletionIds).toContain('ok');
      expect(result.plannedDeletionIds).toContain('worst');
      expect(result.plannedDeletionIds).not.toContain('best');
    });

    it('marks group as manual-review when quality margin is too small', () => {
      // Both scores are very close (margin = 0.02 < 0.08)
      const group = makeGroup(
        { assetIds: ['a', 'b'] },
        { a: 0.51, b: 0.49 },
      );
      const [result] = service.applyRecommendations([group]);
      expect(result.status).toBe('manual-review');
      expect(result.recommendedKeepId).toBeNull();
      expect(result.plannedDeletionIds).toHaveLength(0);
    });

    it('marks group as manual-review when confidence is too low', () => {
      // margin = 0.10 → confidence ≈ 0.40 < 0.70 threshold
      const group = makeGroup(
        { assetIds: ['a', 'b'] },
        { a: 0.60, b: 0.50 },
      );
      const [result] = service.applyRecommendations([group]);
      expect(result.status).toBe('manual-review');
    });

    it('marks group as actionable when confidence and margin are sufficient', () => {
      // margin = 0.35 → confidence = 1.0 > 0.70 threshold
      const group = makeGroup(
        { assetIds: ['a', 'b'] },
        { a: 0.90, b: 0.55 },
      );
      const [result] = service.applyRecommendations([group]);
      expect(result.status).toBe('actionable');
    });

    it('skips groups with fewer than 2 assets', () => {
      const group = makeGroup({ assetIds: ['solo'] }, { solo: 0.8 });
      const [result] = service.applyRecommendations([group]);
      expect(result.status).toBe('skipped');
      expect(result.confidence).toBe(0);
    });

    it('sets keepReason for actionable groups', () => {
      const group = makeGroup(
        { assetIds: ['a', 'b'] },
        { a: 0.95, b: 0.55 },
      );
      const [result] = service.applyRecommendations([group]);
      if (result.status === 'actionable') {
        expect(result.keepReason).toBeTruthy();
        expect(typeof result.keepReason).toBe('string');
      }
    });

    it('does not set keepReason for manual-review groups', () => {
      const group = makeGroup(
        { assetIds: ['a', 'b'] },
        { a: 0.52, b: 0.50 },
      );
      const [result] = service.applyRecommendations([group]);
      expect(result.keepReason).toBeNull();
    });

    it('processes multiple groups independently', () => {
      const group1 = makeGroup({ id: 'g1', assetIds: ['a1', 'b1'] }, { a1: 0.90, b1: 0.50 });
      const group2 = makeGroup({ id: 'g2', assetIds: ['a2', 'b2'] }, { a2: 0.52, b2: 0.50 });
      const results = service.applyRecommendations([group1, group2]);
      expect(results[0].status).toBe('actionable');
      expect(results[1].status).toBe('manual-review');
    });
  });
});
