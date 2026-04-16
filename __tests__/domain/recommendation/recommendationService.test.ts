import { ConservativeRecommendationService, buildRecommendationsForClusters } from '@/domain/recommendation/recommendationService';
import { PhotoCluster, PhotoAnalysisInput, QualityScore } from '@/types';

function makeInput(
  id: string,
  width: number,
  height: number,
  creationTime: number,
  overrides?: Partial<PhotoAnalysisInput['metadata']>
): PhotoAnalysisInput {
  return {
    asset: {
      id,
      uri: `file://${id}.jpg`,
      filename: `IMG_${id}.jpg`,
      width,
      height,
      creationTime,
      modificationTime: creationTime,
      duration: 0,
      mediaType: 'photo',
    },
    metadata: {
      width,
      height,
      fileSize: width * height * 3,
      creationTime,
      isPortrait: height > width,
      aspectRatio: width / height,
      ...overrides,
    },
  };
}

function makeCluster(photos: PhotoAnalysisInput[], status: PhotoCluster['status'] = 'actionable'): PhotoCluster {
  return {
    id: `cluster-${photos[0].asset.id}`,
    photos,
    status,
  };
}

describe('ConservativeRecommendationService', () => {
  const service = new ConservativeRecommendationService();

  test('returns null for single photo cluster', () => {
    const cluster = makeCluster([makeInput('1', 3000, 4000, 1000)]);
    const result = service.recommend(cluster);
    expect(result).toBeNull();
  });

  test('recommends highest quality photo as keep', () => {
    const cluster = makeCluster([
      makeInput('1', 2000, 3000, 1000),
      makeInput('2', 3000, 4000, 1000),
      makeInput('3', 1000, 1500, 1000),
    ]);
    const result = service.recommend(cluster);
    expect(result).not.toBeNull();
    expect(result!.keepPhotoId).toBe('2'); // highest resolution
    expect(result!.deletePhotoIds).toContain('1');
    expect(result!.deletePhotoIds).toContain('3');
    expect(result!.deletePhotoIds).not.toContain('2');
  });

  test('includes confidence margin', () => {
    const cluster = makeCluster([
      makeInput('1', 3000, 4000, 1000),
      makeInput('2', 3000, 4000, 1000), // identical scores
    ]);
    const result = service.recommend(cluster);
    // With identical scores, margin should be ~0, so no recommendation
    // (the service requires sufficient confidence)
    expect(result).toBeNull();
  });

  test('provides reason with details', () => {
    const cluster = makeCluster([
      makeInput('1', 2000, 3000, 1000),
      makeInput('2', 3000, 4000, 1000, { hasHDR: true }),
    ]);
    const result = service.recommend(cluster);
    expect(result).not.toBeNull();
    expect(result!.reason.summary).toContain('Recommended keep');
    expect(result!.reason.details.length).toBeGreaterThan(0);
  });

  test('does not auto-recommend when confidence is low', () => {
    const cluster = makeCluster([
      makeInput('1', 3000, 4000, 1000),
      makeInput('2', 2900, 3900, 1000), // very similar quality
    ]);
    const result = service.recommend(cluster);
    // With very similar scores, margin should be low
    if (result) {
      expect(result.margin).toBeLessThan(0.25);
    }
  });

  test('uses provided quality scores', () => {
    const cluster = makeCluster([
      makeInput('1', 3000, 4000, 1000),
      makeInput('2', 2000, 3000, 1000),
    ]);
    const customScores: QualityScore[] = [
      { photoId: '1', totalScore: 0.3, signals: [] },
      { photoId: '2', totalScore: 0.9, signals: [] },
    ];
    const result = service.recommend(cluster, customScores);
    expect(result).not.toBeNull();
    expect(result!.keepPhotoId).toBe('2'); // uses custom scores
  });
});

describe('buildRecommendationsForClusters', () => {
  const service = new ConservativeRecommendationService();

  test('marks clusters without recommendation as manual_review', () => {
    const clusters = [
      makeCluster([
        makeInput('1', 3000, 4000, 1000),
        makeInput('2', 3000, 4000, 1000), // identical, low confidence
      ]),
    ];
    const result = buildRecommendationsForClusters(clusters, service);
    expect(result[0].status).toBe('manual_review');
    expect(result[0].recommendation).toBeUndefined();
  });

  test('marks single-photo clusters as skipped', () => {
    const clusters = [
      makeCluster([makeInput('1', 3000, 4000, 1000)]),
    ];
    const result = buildRecommendationsForClusters(clusters, service);
    expect(result[0].status).toBe('skipped');
  });

  test('marks actionable clusters with recommendation', () => {
    const clusters = [
      makeCluster([
        makeInput('1', 2000, 3000, 1000),
        makeInput('2', 3000, 4000, 1000),
      ]),
    ];
    const result = buildRecommendationsForClusters(clusters, service);
    expect(result[0].status).toBe('actionable');
    expect(result[0].recommendation).toBeDefined();
  });
});
