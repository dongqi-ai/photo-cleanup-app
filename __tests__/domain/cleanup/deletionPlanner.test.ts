import { DeletionPlanner } from '@/domain/cleanup/deletionPlanner';
import { PhotoCluster, UserClusterDecision } from '@/types';

function makeCluster(
  id: string,
  photoIds: string[],
  status: PhotoCluster['status'] = 'actionable',
  recommendation?: PhotoCluster['recommendation']
): PhotoCluster {
  return {
    id,
    photos: photoIds.map((pid) => ({
      asset: {
        id: pid,
        uri: `file://${pid}.jpg`,
        filename: `IMG_${pid}.jpg`,
        width: 3000,
        height: 4000,
        creationTime: 1000,
        modificationTime: 1000,
        duration: 0,
        mediaType: 'photo',
      },
      metadata: {
        width: 3000,
        height: 4000,
        fileSize: 3000 * 4000 * 3,
        creationTime: 1000,
        isPortrait: true,
        aspectRatio: 0.75,
      },
    })),
    status,
    recommendation,
  };
}

describe('DeletionPlanner', () => {
  const planner = new DeletionPlanner();

  test('buildPlan skips non-actionable clusters', () => {
    const clusters = [
      makeCluster('c1', ['1', '2'], 'actionable', {
        keepPhotoId: '1',
        deletePhotoIds: ['2'],
        confidence: 0.8,
        reason: { summary: 'Keep 1', details: [] },
        margin: 0.3,
      }),
      makeCluster('c2', ['3', '4'], 'manual_review'),
      makeCluster('c3', ['5'], 'skipped'),
    ];

    const plan = planner.buildPlan(clusters);
    expect(plan.clusters).toHaveLength(1);
    expect(plan.clusters[0].clusterId).toBe('c1');
    expect(plan.totalPhotosToDelete).toBe(1);
    expect(plan.status).toBe('draft');
  });

  test('buildPlan with no actionable clusters returns empty plan', () => {
    const clusters = [
      makeCluster('c1', ['1', '2'], 'manual_review'),
    ];
    const plan = planner.buildPlan(clusters);
    expect(plan.clusters).toHaveLength(0);
    expect(plan.totalPhotosToDelete).toBe(0);
  });

  test('confirmCluster marks cluster as confirmed', () => {
    const clusters = [
      makeCluster('c1', ['1', '2'], 'actionable', {
        keepPhotoId: '1',
        deletePhotoIds: ['2'],
        confidence: 0.8,
        reason: { summary: 'Keep 1', details: [] },
        margin: 0.3,
      }),
    ];
    let plan = planner.buildPlan(clusters);
    expect(plan.clusters[0].confirmed).toBe(false);

    plan = planner.confirmCluster(plan, 'c1');
    expect(plan.clusters[0].confirmed).toBe(true);
    expect(plan.status).toBe('confirmed');
  });

  test('confirmCluster partial confirmation keeps reviewing status', () => {
    const clusters = [
      makeCluster('c1', ['1', '2'], 'actionable', {
        keepPhotoId: '1',
        deletePhotoIds: ['2'],
        confidence: 0.8,
        reason: { summary: 'Keep 1', details: [] },
        margin: 0.3,
      }),
      makeCluster('c2', ['3', '4'], 'actionable', {
        keepPhotoId: '3',
        deletePhotoIds: ['4'],
        confidence: 0.8,
        reason: { summary: 'Keep 3', details: [] },
        margin: 0.3,
      }),
    ];
    let plan = planner.buildPlan(clusters);
    plan = planner.confirmCluster(plan, 'c1');
    expect(plan.status).toBe('reviewing');
    expect(plan.clusters[0].confirmed).toBe(true);
    expect(plan.clusters[1].confirmed).toBe(false);
  });

  test('unconfirmCluster reverts confirmed status', () => {
    const clusters = [
      makeCluster('c1', ['1', '2'], 'actionable', {
        keepPhotoId: '1',
        deletePhotoIds: ['2'],
        confidence: 0.8,
        reason: { summary: 'Keep 1', details: [] },
        margin: 0.3,
      }),
    ];
    let plan = planner.buildPlan(clusters);
    plan = planner.confirmCluster(plan, 'c1');
    plan = planner.unconfirmCluster(plan, 'c1');
    expect(plan.clusters[0].confirmed).toBe(false);
    expect(plan.status).toBe('reviewing');
  });

  test('applyUserDecisions updates plan with user overrides', () => {
    const clusters = [
      makeCluster('c1', ['1', '2', '3'], 'actionable', {
        keepPhotoId: '1',
        deletePhotoIds: ['2', '3'],
        confidence: 0.8,
        reason: { summary: 'Keep 1', details: [] },
        margin: 0.3,
      }),
    ];
    let plan = planner.buildPlan(clusters);

    const decisions = new Map<string, UserClusterDecision>();
    decisions.set('c1', {
      clusterId: 'c1',
      keepPhotoId: '2',
      deletePhotoIds: ['1', '3'],
      overrideReason: 'User prefers photo 2',
    });

    plan = planner.applyUserDecisions(plan, decisions);
    expect(plan.clusters[0].keepPhotoId).toBe('2');
    expect(plan.clusters[0].deletePhotoIds).toContain('1');
    expect(plan.clusters[0].deletePhotoIds).toContain('3');
    expect(plan.clusters[0].deletePhotoIds).not.toContain('2');
  });

  test('getConfirmedClusters returns only confirmed', () => {
    const clusters = [
      makeCluster('c1', ['1', '2'], 'actionable', {
        keepPhotoId: '1',
        deletePhotoIds: ['2'],
        confidence: 0.8,
        reason: { summary: 'Keep 1', details: [] },
        margin: 0.3,
      }),
      makeCluster('c2', ['3', '4'], 'actionable', {
        keepPhotoId: '3',
        deletePhotoIds: ['4'],
        confidence: 0.8,
        reason: { summary: 'Keep 3', details: [] },
        margin: 0.3,
      }),
    ];
    let plan = planner.buildPlan(clusters);
    plan = planner.confirmCluster(plan, 'c1');

    const confirmed = planner.getConfirmedClusters(plan);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].clusterId).toBe('c1');

    const unconfirmed = planner.getUnconfirmedClusters(plan);
    expect(unconfirmed).toHaveLength(1);
    expect(unconfirmed[0].clusterId).toBe('c2');
  });
});
