import { MetadataQualityEngine, computeConfidenceMargin, isConfidenceSufficient, getConfidenceLabel } from '@/domain/quality/qualityEngine';
import { PhotoAnalysisInput } from '@/types';

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

describe('MetadataQualityEngine', () => {
  const engine = new MetadataQualityEngine();

  test('empty input returns empty scores', () => {
    const scores = engine.rank([]);
    expect(scores).toHaveLength(0);
  });

  test('ranks by resolution', () => {
    const inputs = [
      makeInput('1', 2000, 3000, 1000),
      makeInput('2', 3000, 4000, 1000),
      makeInput('3', 1000, 1500, 1000),
    ];
    const scores = engine.rank(inputs);
    expect(scores).toHaveLength(3);
    // Highest resolution should score highest
    const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
    expect(sorted[0].photoId).toBe('2'); // 3000x4000
    expect(sorted[2].photoId).toBe('3'); // 1000x1500
  });

  test('HDR and Live Photo boost scores', () => {
    const inputs = [
      makeInput('1', 3000, 4000, 1000, { hasHDR: false, hasLivePhoto: false }),
      makeInput('2', 3000, 4000, 1000, { hasHDR: true, hasLivePhoto: false }),
      makeInput('3', 3000, 4000, 1000, { hasHDR: true, hasLivePhoto: true }),
    ];
    const scores = engine.rank(inputs);
    const score1 = scores.find((s) => s.photoId === '1')!.totalScore;
    const score2 = scores.find((s) => s.photoId === '2')!.totalScore;
    const score3 = scores.find((s) => s.photoId === '3')!.totalScore;

    expect(score3).toBeGreaterThan(score2);
    expect(score2).toBeGreaterThan(score1);
  });

  test('recency favors later photos', () => {
    const inputs = [
      makeInput('1', 3000, 4000, 1000),
      makeInput('2', 3000, 4000, 2000),
    ];
    const scores = engine.rank(inputs);
    const score1 = scores.find((s) => s.photoId === '1')!.totalScore;
    const score2 = scores.find((s) => s.photoId === '2')!.totalScore;
    expect(score2).toBeGreaterThan(score1);
  });

  test('signal values are normalized 0-1', () => {
    const inputs = [makeInput('1', 3000, 4000, 1000)];
    const scores = engine.rank(inputs);
    expect(scores).toHaveLength(1);
    const signals = scores[0].signals;
    for (const signal of signals) {
      expect(signal.normalizedScore).toBeGreaterThanOrEqual(0);
      expect(signal.normalizedScore).toBeLessThanOrEqual(1);
    }
  });
});

describe('confidence helpers', () => {
  test('computeConfidenceMargin with clear winner', () => {
    const scores = [
      { photoId: '1', totalScore: 0.9, signals: [] as any },
      { photoId: '2', totalScore: 0.5, signals: [] as any },
    ];
    const margin = computeConfidenceMargin(scores, 0, 1);
    expect(margin).toBe(0.4);
    expect(isConfidenceSufficient(margin)).toBe(true);
  });

  test('computeConfidenceMargin with narrow margin', () => {
    const scores = [
      { photoId: '1', totalScore: 0.6, signals: [] as any },
      { photoId: '2', totalScore: 0.55, signals: [] as any },
    ];
    const margin = computeConfidenceMargin(scores, 0, 1);
    expect(margin).toBeCloseTo(0.05, 10);
    expect(isConfidenceSufficient(margin)).toBe(false);
  });

  test('getConfidenceLabel returns correct labels', () => {
    expect(getConfidenceLabel(0.3)).toBe('High confidence');
    expect(getConfidenceLabel(0.2)).toBe('Medium confidence');
    expect(getConfidenceLabel(0.1)).toBe('Low confidence — review recommended');
  });

  test('computeConfidenceMargin with single score', () => {
    const scores = [{ photoId: '1', totalScore: 0.8, signals: [] as any }];
    const margin = computeConfidenceMargin(scores, 0, 1);
    expect(margin).toBe(0);
  });
});
