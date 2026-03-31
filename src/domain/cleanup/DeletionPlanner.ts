/**
 * DeletionPlanner
 *
 * Converts reviewed photo groups into a concrete, auditable deletion plan.
 * The plan is a pure data structure — no deletions happen here.
 *
 * Design principles:
 *   - The plan is built only from groups the user has reviewed.
 *   - Only assets the user has confirmed (via userDeletionIds or planned IDs)
 *     end up in the plan.
 *   - No auto-delete: plan execution is a separate, explicit user action.
 *   - Platform note: deletion behavior differs between iOS (requires confirmation
 *     dialog from the OS) and Android (permanent). The UI layer must inform the
 *     user before execution.
 */

import type { PhotoGroup, DeletionPlan, DeletionPlanItem } from '../../types';
import { generateId } from '../../lib/utils/generateId';
import { ExplanationService } from '../recommendation/ExplanationService';

const explanationService = new ExplanationService();

// ---------------------------------------------------------------------------
// Pure plan-building logic
// ---------------------------------------------------------------------------

/**
 * Build deletion plan items for a single reviewed group.
 * If the user provided overrides (userDeletionIds), those take precedence.
 * If the group is manual-review and the user has set userDeletionIds, those are used.
 * If the group is actionable and the user hasn't overridden, plannedDeletionIds are used.
 */
export function buildGroupDeletionItems(
  group: PhotoGroup,
  assetFilenameMap: Record<string, string>,
  assetUriMap: Record<string, string>,
): DeletionPlanItem[] {
  if (!group.reviewed) return [];

  // Determine which IDs to delete
  let deletionIds: string[];

  if (group.userDeletionIds.length > 0) {
    // User has manually curated the deletion list
    deletionIds = group.userDeletionIds;
  } else if (group.status === 'actionable' && group.plannedDeletionIds.length > 0) {
    // Auto-planned from recommendation
    deletionIds = group.plannedDeletionIds;
  } else {
    // Manual review group with no user decisions — skip
    return [];
  }

  // The effective keep ID
  const keepId = group.userKeepId ?? group.recommendedKeepId;

  return deletionIds.map(assetId => ({
    assetId,
    groupId: group.id,
    filename: assetFilenameMap[assetId] ?? assetId,
    uri: assetUriMap[assetId] ?? '',
    reason: keepId
      ? explanationService.buildDeletionReason(assetId, keepId, group.qualitySignals)
      : 'Marked for deletion by user review.',
    confirmed: false,
  }));
}

/**
 * Build a complete deletion plan from all reviewed groups.
 */
export function buildDeletionPlan(
  groups: PhotoGroup[],
  assetFilenameMap: Record<string, string>,
  assetUriMap: Record<string, string>,
): DeletionPlan {
  const items: DeletionPlanItem[] = [];

  for (const group of groups) {
    const groupItems = buildGroupDeletionItems(group, assetFilenameMap, assetUriMap);
    items.push(...groupItems);
  }

  // Deduplicate by assetId (a photo can only appear in one group)
  const seen = new Set<string>();
  const dedupedItems = items.filter(item => {
    if (seen.has(item.assetId)) return false;
    seen.add(item.assetId);
    return true;
  });

  return {
    id: generateId(),
    createdAt: Date.now(),
    items: dedupedItems,
    status: 'pending',
    results: [],
  };
}

// ---------------------------------------------------------------------------
// Plan summary helpers (pure)
// ---------------------------------------------------------------------------

export function countPlanItems(plan: DeletionPlan): number {
  return plan.items.length;
}

export function countConfirmedItems(plan: DeletionPlan): number {
  return plan.items.filter(i => i.confirmed).length;
}

export function allItemsConfirmed(plan: DeletionPlan): boolean {
  return plan.items.length > 0 && plan.items.every(i => i.confirmed);
}

export function confirmAllItems(plan: DeletionPlan): DeletionPlan {
  return {
    ...plan,
    items: plan.items.map(item => ({ ...item, confirmed: true })),
  };
}

export function toggleItemConfirmation(
  plan: DeletionPlan,
  assetId: string,
): DeletionPlan {
  return {
    ...plan,
    items: plan.items.map(item =>
      item.assetId === assetId ? { ...item, confirmed: !item.confirmed } : item,
    ),
  };
}

// ---------------------------------------------------------------------------
// Execution service (side-effectful — wraps photo asset service)
// ---------------------------------------------------------------------------

import type { PhotoAssetServiceI } from '../photo/PhotoAssetService';

export class DeletionExecutor {
  constructor(private readonly assetService: PhotoAssetServiceI) {}

  /**
   * Execute only the confirmed items in the plan.
   * Returns an updated plan with results populated.
   *
   * Note: Does not auto-delete anything — the caller must confirm items first.
   */
  async execute(plan: DeletionPlan): Promise<DeletionPlan> {
    const confirmedIds = plan.items
      .filter(i => i.confirmed)
      .map(i => i.assetId);

    if (confirmedIds.length === 0) {
      return { ...plan, status: 'cancelled' };
    }

    const successIds = await this.assetService.deleteAssets(confirmedIds);
    const successSet = new Set(successIds);

    const results = confirmedIds.map(id => ({
      assetId: id,
      success: successSet.has(id),
      error: successSet.has(id) ? undefined : 'Deletion failed or not permitted',
    }));

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);

    return {
      ...plan,
      status: allSuccess
        ? 'completed'
        : anySuccess
        ? 'partially-completed'
        : 'cancelled',
      results,
    };
  }
}
