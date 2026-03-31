/**
 * Tests for ClusteringEngine.
 */

import { ClusteringEngine } from '../ClusteringEngine';
import type { CandidatePair } from '../../../types';

function makePair(idA: string, idB: string, score = 0.8): CandidatePair {
  return {
    assetIdA: idA,
    assetIdB: idB,
    score,
    signals: [],
  };
}

describe('ClusteringEngine', () => {
  const engine = new ClusteringEngine({ minGroupSize: 2 });

  describe('cluster()', () => {
    it('returns empty groups and all ungrouped for no pairs', () => {
      const result = engine.cluster([], ['a', 'b', 'c']);
      expect(result.groups).toHaveLength(0);
      expect(result.ungroupedAssetIds).toHaveLength(3);
    });

    it('creates a single group for a connected pair', () => {
      const pairs = [makePair('a', 'b')];
      const result = engine.cluster(pairs, ['a', 'b', 'c']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].assetIds).toHaveLength(2);
      expect(result.groups[0].assetIds).toContain('a');
      expect(result.groups[0].assetIds).toContain('b');
      expect(result.ungroupedAssetIds).toContain('c');
    });

    it('unions transitively connected assets into one group', () => {
      // a-b and b-c should all end up in the same group
      const pairs = [makePair('a', 'b'), makePair('b', 'c')];
      const result = engine.cluster(pairs, ['a', 'b', 'c', 'd']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].assetIds).toHaveLength(3);
      expect(result.groups[0].assetIds).toContain('a');
      expect(result.groups[0].assetIds).toContain('b');
      expect(result.groups[0].assetIds).toContain('c');
      expect(result.ungroupedAssetIds).toContain('d');
    });

    it('creates separate groups for disconnected components', () => {
      const pairs = [makePair('a', 'b'), makePair('c', 'd')];
      const result = engine.cluster(pairs, ['a', 'b', 'c', 'd', 'e']);
      expect(result.groups).toHaveLength(2);
      expect(result.ungroupedAssetIds).toContain('e');
    });

    it('skips groups below minGroupSize', () => {
      // With minGroupSize=2, a singleton pair is accepted but
      // a group of 1 should be skipped
      const engineMinTwo = new ClusteringEngine({ minGroupSize: 3 });
      const pairs = [makePair('a', 'b')]; // only 2 in group
      const result = engineMinTwo.cluster(pairs, ['a', 'b', 'c']);
      // Group of 2 is below threshold of 3
      expect(result.groups).toHaveLength(0);
    });

    it('computes average group score', () => {
      const pairs = [makePair('a', 'b', 0.8), makePair('b', 'c', 0.6)];
      const result = engine.cluster(pairs, ['a', 'b', 'c']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groupScore).toBeCloseTo(0.7, 2);
    });

    it('assigns unique IDs to each group', () => {
      const pairs = [makePair('a', 'b'), makePair('c', 'd')];
      const result = engine.cluster(pairs, ['a', 'b', 'c', 'd']);
      const ids = result.groups.map(g => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all assetIds are accounted for (groups + ungrouped)', () => {
      const allIds = ['a', 'b', 'c', 'd', 'e'];
      const pairs = [makePair('a', 'b'), makePair('c', 'd')];
      const result = engine.cluster(pairs, allIds);

      const groupedIds = result.groups.flatMap(g => g.assetIds);
      const allAccountedFor = [...groupedIds, ...result.ungroupedAssetIds];
      expect(allAccountedFor.sort()).toEqual(allIds.sort());
    });

    it('handles large inputs without duplicate pairs in groups', () => {
      const n = 10;
      const ids = Array.from({ length: n }, (_, i) => `id${i}`);
      // Form a chain: 0-1, 1-2, ..., (n-2)-(n-1)
      const pairs = ids.slice(1).map((id, i) => makePair(ids[i], id));
      const result = engine.cluster(pairs, ids);
      // All should be in one group
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].assetIds).toHaveLength(n);
    });
  });
});
