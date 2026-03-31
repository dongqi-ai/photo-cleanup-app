/**
 * ClusteringEngine
 *
 * Converts a list of candidate pairs into disjoint photo groups using
 * Union-Find (disjoint set union) clustering. Groups with fewer than
 * MIN_GROUP_SIZE assets are classified as 'skipped'.
 *
 * Strategy:
 *   - Photos connected by accepted candidate pairs are unioned together.
 *   - Each connected component becomes a PhotoGroup.
 *   - Groups with only 1 photo (singletons) are skipped.
 *   - Group score is the average similarity of all pairs within the group.
 */

import type { CandidatePair, PhotoGroup } from '../../types';
import { MIN_GROUP_SIZE } from '../../constants';
import { generateId } from '../../lib/utils/generateId';

// ---------------------------------------------------------------------------
// Union-Find implementation
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
    const p = this.parent.get(id)!;
    if (p !== id) {
      this.parent.set(id, this.find(p)); // path compression
    }
    return this.parent.get(id)!;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }

  getComponents(): Map<string, string[]> {
    const components = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const group = components.get(root) ?? [];
      group.push(id);
      components.set(root, group);
    }
    return components;
  }
}

// ---------------------------------------------------------------------------
// Group reason builder
// ---------------------------------------------------------------------------

function buildGroupReason(pairs: CandidatePair[], memberIds: string[]): string {
  if (pairs.length === 0) return 'Photos grouped by similarity.';

  // Find dominant signal
  const signalTotals: Record<string, number> = {};
  for (const pair of pairs) {
    for (const signal of pair.signals) {
      signalTotals[signal.name] = (signalTotals[signal.name] ?? 0) + signal.value * signal.weight;
    }
  }

  const dominant = Object.entries(signalTotals).sort((a, b) => b[1] - a[1])[0];
  const count = memberIds.length;

  const signalDescriptions: Record<string, string> = {
    temporal_proximity: 'taken within a short time of each other',
    filename_pattern: 'showing a burst/sequence filename pattern',
    resolution_match: 'with matching resolution',
    file_size: 'with very similar file sizes',
  };

  const desc = signalDescriptions[dominant?.[0]] ?? 'sharing multiple similarity signals';
  return `${count} photo${count !== 1 ? 's' : ''} ${desc}.`;
}

// ---------------------------------------------------------------------------
// Main clustering engine
// ---------------------------------------------------------------------------

export interface ClusteringOptions {
  minGroupSize?: number;
}

export interface ClusteringResult {
  groups: Omit<PhotoGroup, 'qualitySignals' | 'reviewed' | 'userKeepId' | 'userDeletionIds'>[];
  /** Asset IDs that did not form any group */
  ungroupedAssetIds: string[];
}

export class ClusteringEngine {
  private readonly minGroupSize: number;

  constructor(options: ClusteringOptions = {}) {
    this.minGroupSize = options.minGroupSize ?? MIN_GROUP_SIZE;
  }

  /**
   * Cluster candidate pairs into photo groups.
   * All asset IDs (from allAssetIds) that are not part of any pair are returned
   * as ungroupedAssetIds.
   */
  cluster(
    pairs: CandidatePair[],
    allAssetIds: string[],
  ): ClusteringResult {
    const uf = new UnionFind();

    // Build pair index for quick lookup later
    const pairsByAsset = new Map<string, CandidatePair[]>();
    for (const pair of pairs) {
      uf.union(pair.assetIdA, pair.assetIdB);

      const aList = pairsByAsset.get(pair.assetIdA) ?? [];
      aList.push(pair);
      pairsByAsset.set(pair.assetIdA, aList);

      const bList = pairsByAsset.get(pair.assetIdB) ?? [];
      bList.push(pair);
      pairsByAsset.set(pair.assetIdB, bList);
    }

    // Ensure all assets are registered in the UF structure
    for (const id of allAssetIds) {
      uf.find(id);
    }

    const components = uf.getComponents();
    const pairedAssetIds = new Set<string>([
      ...pairs.map(p => p.assetIdA),
      ...pairs.map(p => p.assetIdB),
    ]);

    const groups: ClusteringResult['groups'] = [];
    const ungroupedAssetIds: string[] = [];

    for (const [, memberIds] of components) {
      if (memberIds.length < this.minGroupSize) {
        // Singleton or below minimum — not actionable
        for (const id of memberIds) {
          if (!pairedAssetIds.has(id)) {
            ungroupedAssetIds.push(id);
          }
        }
        continue;
      }

      // Collect all pairs that are fully within this component
      const memberSet = new Set(memberIds);
      const groupPairs = pairs.filter(
        p => memberSet.has(p.assetIdA) && memberSet.has(p.assetIdB),
      );

      const avgScore =
        groupPairs.length > 0
          ? groupPairs.reduce((s, p) => s + p.score, 0) / groupPairs.length
          : 0;

      const groupReason = buildGroupReason(groupPairs, memberIds);

      groups.push({
        id: generateId(),
        status: 'actionable',         // Will be overridden by quality ranking stage
        assetIds: [...memberIds],     // Will be sorted by quality ranking stage
        recommendedKeepId: null,      // Set by recommendation stage
        plannedDeletionIds: [],       // Set by deletion planner
        groupScore: avgScore,
        confidence: 0,               // Set by recommendation stage
        groupReason,
        keepReason: null,            // Set by recommendation stage
        reviewed: false,
      });
    }

    // Any asset not in any paired component is ungrouped
    for (const id of allAssetIds) {
      if (!pairedAssetIds.has(id) && !ungroupedAssetIds.includes(id)) {
        ungroupedAssetIds.push(id);
      }
    }

    return { groups, ungroupedAssetIds };
  }
}

export const clusteringEngine = new ClusteringEngine();
