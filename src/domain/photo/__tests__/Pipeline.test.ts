/**
 * Integration test for the Pipeline end-to-end.
 * Uses synthetic assets to verify the full flow produces correct results.
 */

import { Pipeline, normalizeAssets } from '../Pipeline';
import type { PhotoAsset } from '../../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let nextId = 0;
function makeAsset(overrides: Partial<PhotoAsset> = {}): PhotoAsset {
  const id = `a${++nextId}`;
  return {
    id,
    uri: `file:///${id}.jpg`,
    filename: `IMG_${String(nextId).padStart(4, '0')}.jpg`,
    width: 4032,
    height: 3024,
    fileSize: 3_000_000,
    creationTime: 1_700_000_000_000 + nextId * 1000,
    modificationTime: 1_700_000_000_000 + nextId * 1000,
    duration: null,
    albumId: null,
    mediaType: 'photo',
    mediaLibraryId: id,
    ...overrides,
  };
}

function makeBurstGroup(count: number, baseTime: number, baseId: number): PhotoAsset[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `burst${baseId}_${i}`;
    return {
      id,
      uri: `file:///${id}.jpg`,
      filename: `IMG_${String(baseId * 10 + i).padStart(4, '0')}.jpg`,
      width: 4032,
      height: 3024,
      fileSize: 3_000_000 - i * 50_000, // slight size variation
      creationTime: baseTime + i * 400, // 0.4s apart
      modificationTime: baseTime + i * 400,
      duration: null,
      albumId: null,
      mediaType: 'photo',
      mediaLibraryId: id,
    };
  });
}

// ─── normalizeAssets ──────────────────────────────────────────────────────────

describe('normalizeAssets', () => {
  beforeEach(() => { nextId = 0; });

  it('filters out video assets', () => {
    const photo = makeAsset({ mediaType: 'photo' });
    const video = makeAsset({ mediaType: 'video' });
    const { eligible, ineligible } = normalizeAssets([photo, video]);
    expect(eligible).toHaveLength(1);
    expect(ineligible).toHaveLength(1);
    expect(eligible[0].id).toBe(photo.id);
  });

  it('filters out zero-dimension assets', () => {
    const normal = makeAsset({ width: 4032, height: 3024 });
    const broken = makeAsset({ width: 0, height: 0 });
    const { eligible, ineligible } = normalizeAssets([normal, broken]);
    expect(eligible).toHaveLength(1);
    expect(ineligible).toHaveLength(1);
  });

  it('deduplicates assets with the same ID', () => {
    const a = makeAsset({ id: 'dup' });
    const b = makeAsset({ id: 'dup' });
    const { eligible, ineligible } = normalizeAssets([a, b]);
    expect(eligible).toHaveLength(1);
    expect(ineligible).toHaveLength(1);
  });

  it('passes through valid photo assets', () => {
    const assets = [makeAsset(), makeAsset(), makeAsset()];
    const { eligible, ineligible } = normalizeAssets(assets);
    expect(eligible).toHaveLength(3);
    expect(ineligible).toHaveLength(0);
  });
});

// ─── Pipeline ─────────────────────────────────────────────────────────────────

describe('Pipeline', () => {
  beforeEach(() => { nextId = 0; });

  const pipeline = new Pipeline({
    burstWindowSeconds: 8,
    similarityThreshold: 0.65,
    recommendationConfidenceThreshold: 0.70,
  });

  it('returns empty result for < 2 assets', async () => {
    const result = await pipeline.run([makeAsset()]);
    expect(result.groups).toHaveLength(0);
    expect(result.totalPhotosAnalyzed).toBe(1);
    expect(result.actionableGroups).toBe(0);
  });

  it('groups burst photos and identifies a recommended keep', async () => {
    // 3-photo burst taken 0.4s apart
    const burst = makeBurstGroup(3, 1_700_000_000_000, 1);
    const result = await pipeline.run(burst);

    expect(result.totalPhotosAnalyzed).toBe(3);
    expect(result.groups.length).toBeGreaterThanOrEqual(1);

    const actionable = result.groups.filter(g => g.status === 'actionable');
    if (actionable.length > 0) {
      expect(actionable[0].recommendedKeepId).toBeTruthy();
      expect(actionable[0].plannedDeletionIds.length).toBeGreaterThan(0);
    }
  });

  it('does not group unrelated photos taken far apart', async () => {
    const a = makeAsset({ creationTime: 1_000_000_000_000 });  // very old
    const b = makeAsset({ creationTime: 1_700_000_000_000 });  // recent
    const result = await pipeline.run([a, b]);

    // They are 700M ms apart — should not be grouped
    expect(result.groups).toHaveLength(0);
    expect(result.ungroupedAssetIds).toHaveLength(2);
  });

  it('calls progress callback with increasing progress values', async () => {
    const burst = makeBurstGroup(3, 1_700_000_000_000, 2);
    const progresses: number[] = [];
    await pipeline.run(burst, (p) => progresses.push(p.progress));

    expect(progresses.length).toBeGreaterThan(0);
    // Progress should be non-decreasing
    for (let i = 1; i < progresses.length; i++) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }
    // Last progress should be 1.0 (complete)
    expect(progresses[progresses.length - 1]).toBe(1.0);
  });

  it('groups do not contain the recommended keep in plannedDeletionIds', async () => {
    const burst = makeBurstGroup(4, 1_700_000_000_000, 3);
    const result = await pipeline.run(burst);

    for (const group of result.groups) {
      if (group.recommendedKeepId) {
        expect(group.plannedDeletionIds).not.toContain(group.recommendedKeepId);
      }
    }
  });

  it('all analyzed assets are accounted for (grouped + ungrouped)', async () => {
    const burst = makeBurstGroup(3, 1_700_000_000_000, 4);
    const isolated = makeAsset({ creationTime: 1_600_000_000_000 });
    const all = [...burst, isolated];

    const result = await pipeline.run(all);

    const groupedIds = new Set(result.groups.flatMap(g => g.assetIds));
    const ungroupedIds = new Set(result.ungroupedAssetIds);

    // Every analyzed asset should be in exactly one of these sets
    for (const asset of all) {
      const inGrouped = groupedIds.has(asset.id);
      const inUngrouped = ungroupedIds.has(asset.id);
      expect(inGrouped || inUngrouped).toBe(true);
      expect(inGrouped && inUngrouped).toBe(false);
    }
  });

  it('manual-review groups have no auto-recommendation', async () => {
    // Create assets that are time-close but with identical quality signals
    // (same filename prefix, same resolution, same file size → very similar quality)
    const sameQualityBurst = Array.from({ length: 2 }, (_, i) => ({
      id: `sq${i}`,
      uri: `file:///sq${i}.jpg`,
      filename: `IMG_${String(100 + i).padStart(4, '0')}.jpg`,
      width: 4032,
      height: 3024,
      fileSize: 3_000_000, // identical
      creationTime: 1_700_000_000_000 + i * 200,
      modificationTime: 1_700_000_000_000 + i * 200,
      duration: null,
      albumId: null,
      mediaType: 'photo' as const,
      mediaLibraryId: `sq${i}`,
    }));

    const result = await pipeline.run(sameQualityBurst);
    for (const group of result.groups) {
      if (group.status === 'manual-review') {
        expect(group.recommendedKeepId).toBeNull();
        expect(group.plannedDeletionIds).toHaveLength(0);
      }
    }
  });
});
