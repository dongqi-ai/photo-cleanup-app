/**
 * Tests for DeletionPlanner pure functions.
 */

import {
  buildGroupDeletionItems,
  buildDeletionPlan,
  countPlanItems,
  countConfirmedItems,
  allItemsConfirmed,
  confirmAllItems,
  toggleItemConfirmation,
} from '../DeletionPlanner';
import type { PhotoGroup, DeletionPlan } from '../../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<PhotoGroup> = {}): PhotoGroup {
  return {
    id: 'g1',
    status: 'actionable',
    assetIds: ['keep', 'del1', 'del2'],
    recommendedKeepId: 'keep',
    plannedDeletionIds: ['del1', 'del2'],
    groupScore: 0.85,
    confidence: 0.90,
    groupReason: 'Burst sequence',
    keepReason: 'Highest resolution',
    qualitySignals: {
      keep: { assetId: 'keep', resolutionScore: 1.0, sharpnessScore: 1.0, brightnessScore: 0.5, compositeScore: 0.95, explanations: ['Best'] },
      del1: { assetId: 'del1', resolutionScore: 0.7, sharpnessScore: 0.6, brightnessScore: 0.5, compositeScore: 0.65, explanations: ['Lower'] },
      del2: { assetId: 'del2', resolutionScore: 0.5, sharpnessScore: 0.4, brightnessScore: 0.5, compositeScore: 0.45, explanations: ['Lowest'] },
    },
    reviewed: true,
    userKeepId: null,
    userDeletionIds: [],
    ...overrides,
  };
}

const FILENAME_MAP: Record<string, string> = {
  keep: 'IMG_0001.jpg',
  del1: 'IMG_0002.jpg',
  del2: 'IMG_0003.jpg',
};

const URI_MAP: Record<string, string> = {
  keep: 'file:///IMG_0001.jpg',
  del1: 'file:///IMG_0002.jpg',
  del2: 'file:///IMG_0003.jpg',
};

// ─── buildGroupDeletionItems ─────────────────────────────────────────────────

describe('buildGroupDeletionItems', () => {
  it('returns empty array for unreviewed group', () => {
    const group = makeGroup({ reviewed: false });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    expect(items).toHaveLength(0);
  });

  it('uses plannedDeletionIds for reviewed actionable groups', () => {
    const group = makeGroup({ reviewed: true });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    expect(items).toHaveLength(2);
    const ids = items.map(i => i.assetId);
    expect(ids).toContain('del1');
    expect(ids).toContain('del2');
    expect(ids).not.toContain('keep');
  });

  it('uses userDeletionIds when provided (user override)', () => {
    const group = makeGroup({ reviewed: true, userDeletionIds: ['del1'] });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    expect(items).toHaveLength(1);
    expect(items[0].assetId).toBe('del1');
  });

  it('returns empty for manual-review group with no user decisions', () => {
    const group = makeGroup({
      status: 'manual-review',
      recommendedKeepId: null,
      plannedDeletionIds: [],
      reviewed: true,
      userDeletionIds: [],
    });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    expect(items).toHaveLength(0);
  });

  it('populates filename and uri from maps', () => {
    const group = makeGroup({ reviewed: true });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    for (const item of items) {
      expect(item.filename).toBe(FILENAME_MAP[item.assetId]);
      expect(item.uri).toBe(URI_MAP[item.assetId]);
    }
  });

  it('all items start with confirmed = false', () => {
    const group = makeGroup({ reviewed: true });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    for (const item of items) {
      expect(item.confirmed).toBe(false);
    }
  });

  it('includes groupId in each item', () => {
    const group = makeGroup({ reviewed: true, id: 'myGroup' });
    const items = buildGroupDeletionItems(group, FILENAME_MAP, URI_MAP);
    for (const item of items) {
      expect(item.groupId).toBe('myGroup');
    }
  });
});

// ─── buildDeletionPlan ────────────────────────────────────────────────────────

describe('buildDeletionPlan', () => {
  it('builds a plan from reviewed groups', () => {
    const groups = [makeGroup({ reviewed: true }), makeGroup({ id: 'g2', reviewed: true })];
    const plan = buildDeletionPlan(groups, FILENAME_MAP, URI_MAP);
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.status).toBe('pending');
  });

  it('deduplicates items by assetId', () => {
    // Same group ID but duplicate assets
    const g1 = makeGroup({ reviewed: true, plannedDeletionIds: ['del1'] });
    const g2 = makeGroup({ id: 'g2', reviewed: true, plannedDeletionIds: ['del1'] });
    const plan = buildDeletionPlan([g1, g2], FILENAME_MAP, URI_MAP);
    const ids = plan.items.map(i => i.assetId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('assigns a unique plan ID', () => {
    const g1 = makeGroup({ reviewed: true });
    const p1 = buildDeletionPlan([g1], FILENAME_MAP, URI_MAP);
    const p2 = buildDeletionPlan([g1], FILENAME_MAP, URI_MAP);
    expect(p1.id).not.toBe(p2.id);
  });

  it('has a createdAt timestamp', () => {
    const g1 = makeGroup({ reviewed: true });
    const plan = buildDeletionPlan([g1], FILENAME_MAP, URI_MAP);
    expect(plan.createdAt).toBeGreaterThan(0);
  });

  it('returns empty items for plan with no reviewed groups', () => {
    const g1 = makeGroup({ reviewed: false });
    const plan = buildDeletionPlan([g1], FILENAME_MAP, URI_MAP);
    expect(plan.items).toHaveLength(0);
  });
});

// ─── Plan utility functions ───────────────────────────────────────────────────

function makePlan(itemCount: number, confirmed: boolean[] = []): DeletionPlan {
  return {
    id: 'plan1',
    createdAt: Date.now(),
    status: 'pending',
    results: [],
    items: Array.from({ length: itemCount }, (_, i) => ({
      assetId: `asset${i}`,
      groupId: 'g1',
      filename: `IMG_${i}.jpg`,
      uri: `file:///IMG_${i}.jpg`,
      reason: 'Lower quality',
      confirmed: confirmed[i] ?? false,
    })),
  };
}

describe('countPlanItems', () => {
  it('returns total item count', () => {
    expect(countPlanItems(makePlan(5))).toBe(5);
    expect(countPlanItems(makePlan(0))).toBe(0);
  });
});

describe('countConfirmedItems', () => {
  it('returns count of confirmed items', () => {
    const plan = makePlan(3, [true, false, true]);
    expect(countConfirmedItems(plan)).toBe(2);
  });
});

describe('allItemsConfirmed', () => {
  it('returns true when all items are confirmed', () => {
    const plan = makePlan(3, [true, true, true]);
    expect(allItemsConfirmed(plan)).toBe(true);
  });

  it('returns false when any item is not confirmed', () => {
    const plan = makePlan(3, [true, false, true]);
    expect(allItemsConfirmed(plan)).toBe(false);
  });

  it('returns false for empty plan', () => {
    expect(allItemsConfirmed(makePlan(0))).toBe(false);
  });
});

describe('confirmAllItems', () => {
  it('sets all items to confirmed=true', () => {
    const plan = makePlan(3);
    const updated = confirmAllItems(plan);
    expect(updated.items.every(i => i.confirmed)).toBe(true);
  });

  it('does not mutate the original plan', () => {
    const plan = makePlan(3);
    confirmAllItems(plan);
    expect(plan.items.every(i => i.confirmed)).toBe(false);
  });
});

describe('toggleItemConfirmation', () => {
  it('toggles a specific item from unconfirmed to confirmed', () => {
    const plan = makePlan(3);
    const updated = toggleItemConfirmation(plan, 'asset0');
    expect(updated.items[0].confirmed).toBe(true);
    expect(updated.items[1].confirmed).toBe(false);
  });

  it('toggles a confirmed item to unconfirmed', () => {
    const plan = makePlan(3, [true, false, false]);
    const updated = toggleItemConfirmation(plan, 'asset0');
    expect(updated.items[0].confirmed).toBe(false);
  });

  it('does not affect other items', () => {
    const plan = makePlan(3, [false, true, false]);
    const updated = toggleItemConfirmation(plan, 'asset0');
    expect(updated.items[1].confirmed).toBe(true);
    expect(updated.items[2].confirmed).toBe(false);
  });
});
