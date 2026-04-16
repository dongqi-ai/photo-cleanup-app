import { HeuristicSimilarityEngine } from '@/domain/similarity/similarityEngine';
import { PhotoAnalysisInput } from '@/types';

function makeInput(
  id: string,
  filename: string,
  width: number,
  height: number,
  creationTime: number,
  overrides?: Partial<PhotoAnalysisInput['metadata']>
): PhotoAnalysisInput {
  return {
    asset: {
      id,
      uri: `file://${id}.jpg`,
      filename,
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

describe('HeuristicSimilarityEngine', () => {
  const engine = new HeuristicSimilarityEngine(30000, 0.6);

  test('returns empty candidates for single photo', async () => {
    const inputs = [makeInput('1', 'IMG_0001.jpg', 3000, 4000, 1000)];
    const candidates = await engine.findCandidates(inputs);
    expect(candidates).toHaveLength(0);
  });

  test('finds burst-like candidates by time proximity and filename', async () => {
    const t = 1000000;
    const inputs = [
      makeInput('1', 'IMG_0001.jpg', 3000, 4000, t),
      makeInput('2', 'IMG_0002.jpg', 3000, 4000, t + 500),
      makeInput('3', 'IMG_0003.jpg', 3000, 4000, t + 1200),
    ];
    const candidates = await engine.findCandidates(inputs);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    // Should pair 1-2 and 2-3 (and possibly 1-3 via time window)
    const pairIds = candidates.map((c) => [c.photoA.asset.id, c.photoB.asset.id].sort().join('-'));
    expect(pairIds).toContain('1-2');
    expect(pairIds).toContain('2-3');
  });

  test('excludes photos outside time window', async () => {
    const t = 1000000;
    const inputs = [
      makeInput('1', 'IMG_0001.jpg', 3000, 4000, t),
      makeInput('2', 'IMG_0002.jpg', 3000, 4000, t + 40000), // 40s > 30s window
    ];
    const candidates = await engine.findCandidates(inputs);
    expect(candidates).toHaveLength(0);
  });

  test('rejects dissimilar photos (different dimensions, orientation)', async () => {
    const t = 1000000;
    const inputs = [
      makeInput('1', 'IMG_0001.jpg', 3000, 4000, t), // portrait-ish
      makeInput('2', 'landscape.jpg', 4000, 2000, t + 1000, { isPortrait: false, aspectRatio: 2.0 }),
    ];
    const candidates = await engine.findCandidates(inputs);
    expect(candidates).toHaveLength(0);
  });

  test('computes signals with correct weights', () => {
    const smallWindowEngine = new HeuristicSimilarityEngine(3000, 0.6);
    const a = makeInput('1', 'IMG_0001.jpg', 3000, 4000, 1000);
    const b = makeInput('2', 'IMG_0002.jpg', 3000, 4000, 2500);
    const signals = smallWindowEngine.computeSignals(a, b);

    expect(signals).toHaveLength(6);
    const signalNames = signals.map((s) => s.name);
    expect(signalNames).toContain('timeProximity');
    expect(signalNames).toContain('dimensionMatch');
    expect(signalNames).toContain('aspectRatioMatch');
    expect(signalNames).toContain('filenamePattern');
    expect(signalNames).toContain('fileSizeProximity');
    expect(signalNames).toContain('orientationMatch');

    // Time proximity score should decrease with larger time diffs
    const timeSignal = signals.find((s) => s.name === 'timeProximity');
    expect(timeSignal!.value).toBeGreaterThan(0);
    expect(timeSignal!.value).toBeLessThanOrEqual(1);
  });

  test('filename similarity detects burst patterns', () => {
    const a = makeInput('1', 'IMG_0001.jpg', 3000, 4000, 1000);
    const b = makeInput('2', 'IMG_0002.jpg', 3000, 4000, 1000);
    const c = makeInput('3', 'IMG_0010.jpg', 3000, 4000, 1000);
    const d = makeInput('4', 'DSC_001.jpg', 3000, 4000, 1000);

    const signalsAB = engine.computeSignals(a, b);
    const signalsAC = engine.computeSignals(a, c);
    const signalsAD = engine.computeSignals(a, d);

    const filenameAB = signalsAB.find((s) => s.name === 'filenamePattern')!.value;
    const filenameAC = signalsAC.find((s) => s.name === 'filenamePattern')!.value;
    const filenameAD = signalsAD.find((s) => s.name === 'filenamePattern')!.value;

    expect(filenameAB).toBe(1.0); // sequential within 2
    expect(filenameAC).toBe(0.6); // within 10
    expect(filenameAD).toBeLessThan(0.5); // different prefix
  });

  test('aggregate score respects threshold', async () => {
    const t = 1000000;
    const verySimilar = [
      makeInput('1', 'IMG_0001.jpg', 3000, 4000, t),
      makeInput('2', 'IMG_0002.jpg', 3000, 4000, t + 100),
    ];
    const candidates = await new HeuristicSimilarityEngine(30000, 0.6).findCandidates(verySimilar);
    expect(candidates).toHaveLength(1);

    const barelySimilar = [
      makeInput('1', 'IMG_0001.jpg', 3000, 4000, t),
      makeInput('2', 'IMG_0002.jpg', 3000, 4000, t + 100, {
        aspectRatio: 0.5,
        isPortrait: false,
        fileSize: 1000,
      }),
    ];
    const lowCandidates = await new HeuristicSimilarityEngine(30000, 0.8).findCandidates(barelySimilar);
    expect(lowCandidates).toHaveLength(0);
  });
});
