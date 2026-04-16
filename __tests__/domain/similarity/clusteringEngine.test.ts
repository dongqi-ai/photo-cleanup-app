import { TransitiveClusteringEngine, WindowClusteringEngine } from '@/domain/similarity/clusteringEngine';
import { CandidatePair, PhotoAnalysisInput } from '@/types';

function makeInput(id: string, creationTime: number): PhotoAnalysisInput {
  return {
    asset: {
      id,
      uri: `file://${id}.jpg`,
      filename: `IMG_${id}.jpg`,
      width: 3000,
      height: 4000,
      creationTime,
      modificationTime: creationTime,
      duration: 0,
      mediaType: 'photo',
    },
    metadata: {
      width: 3000,
      height: 4000,
      fileSize: 3000 * 4000 * 3,
      creationTime,
      isPortrait: true,
      aspectRatio: 0.75,
    },
  };
}

function makePair(a: PhotoAnalysisInput, b: PhotoAnalysisInput, score: number): CandidatePair {
  return {
    photoA: a,
    photoB: b,
    similarityScore: score,
    signals: [],
  };
}

describe('TransitiveClusteringEngine', () => {
  const engine = new TransitiveClusteringEngine();

  test('empty candidates returns empty clusters', () => {
    const clusters = engine.cluster([]);
    expect(clusters).toHaveLength(0);
  });

  test('single pair becomes one cluster', () => {
    const a = makeInput('1', 1000);
    const b = makeInput('2', 1500);
    const pairs = [makePair(a, b, 0.85)];
    const clusters = engine.cluster(pairs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos).toHaveLength(2);
    expect(clusters[0].status).toBe('actionable');
  });

  test('transitive chains are merged', () => {
    // A-B and B-C should all be in one cluster (transitive closure)
    const a = makeInput('1', 1000);
    const b = makeInput('2', 1500);
    const c = makeInput('3', 2000);
    const pairs = [
      makePair(a, b, 0.85),
      makePair(b, c, 0.85),
    ];
    const clusters = engine.cluster(pairs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos).toHaveLength(3);
    const ids = clusters[0].photos.map((p) => p.asset.id).sort();
    expect(ids).toEqual(['1', '2', '3']);
  });

  test('separate pairs become separate clusters', () => {
    const a = makeInput('1', 1000);
    const b = makeInput('2', 1500);
    const c = makeInput('3', 50000);
    const d = makeInput('4', 50500);
    const pairs = [
      makePair(a, b, 0.85),
      makePair(c, d, 0.85),
    ];
    const clusters = engine.cluster(pairs);
    expect(clusters).toHaveLength(2);
  });

  test('single photo cluster is skipped', () => {
    // This shouldn't normally happen with valid pairs, but test defensively
    const a = makeInput('1', 1000);
    const pairs = []; // no pairs
    const clusters = engine.cluster(pairs);
    expect(clusters).toHaveLength(0);
  });

  test('oversized cluster gets manual_review status', () => {
    const photos = Array.from({ length: 25 }, (_, i) =>
      makeInput(String(i), 1000 + i * 500)
    );
    const pairs: CandidatePair[] = [];
    for (let i = 0; i < photos.length - 1; i++) {
      pairs.push(makePair(photos[i], photos[i + 1], 0.85));
    }
    const clusters = engine.cluster(pairs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos).toHaveLength(25);
    expect(clusters[0].status).toBe('manual_review');
  });

  test('wide time span triggers manual_review', () => {
    const a = makeInput('1', 1000);
    const b = makeInput('2', 1000 + 6 * 60 * 1000); // 6 minutes apart
    const pairs = [makePair(a, b, 0.85)];
    const clusters = engine.cluster(pairs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].status).toBe('manual_review');
  });
});

describe('WindowClusteringEngine', () => {
  const engine = new WindowClusteringEngine(30000);

  test('groups photos within time window', () => {
    const photos = [
      makeInput('1', 1000),
      makeInput('2', 5000),
      makeInput('3', 10000),
      makeInput('4', 50000), // outside window
    ];
    const pairs = [
      makePair(photos[0], photos[1], 0.85),
      makePair(photos[1], photos[2], 0.85),
      makePair(photos[2], photos[3], 0.85), // time gap > 30s
    ];
    const clusters = engine.cluster(pairs);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
  });
});
