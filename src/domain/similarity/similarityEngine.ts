import {
  PhotoAnalysisInput,
  CandidatePair,
  SimilaritySignal,
  SimilarityEngine,
  EmbeddingModel,
} from '@/types';
import { SIMILARITY_WEIGHTS, MIN_SIMILARITY_THRESHOLD, DEFAULT_TIME_WINDOW_MS } from '@/constants';

// Deterministic heuristic-based similarity engine (MVP fallback)
// Uses time proximity, dimensions, aspect ratio, filename patterns, file size
export class HeuristicSimilarityEngine implements SimilarityEngine {
  private timeWindowMs: number;
  private threshold: number;

  constructor(timeWindowMs = DEFAULT_TIME_WINDOW_MS, threshold = MIN_SIMILARITY_THRESHOLD) {
    this.timeWindowMs = timeWindowMs;
    this.threshold = threshold;
  }

  async findCandidates(inputs: PhotoAnalysisInput[]): Promise<CandidatePair[]> {
    // Sort by creation time for efficient windowing
    const sorted = [...inputs].sort((a, b) => a.metadata.creationTime - b.metadata.creationTime);
    const pairs: CandidatePair[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const photoA = sorted[i];
      // Only look forward within time window
      for (let j = i + 1; j < sorted.length; j++) {
        const photoB = sorted[j];
        const timeDiff = photoB.metadata.creationTime - photoA.metadata.creationTime;
        if (timeDiff > this.timeWindowMs) break;

        const signals = this.computeSignals(photoA, photoB);
        const similarityScore = this.aggregateScore(signals);

        if (similarityScore >= this.threshold) {
          pairs.push({
            photoA,
            photoB,
            similarityScore,
            signals,
          });
        }
      }
    }

    return pairs;
  }

  computeSignals(a: PhotoAnalysisInput, b: PhotoAnalysisInput): SimilaritySignal[] {
    const signals: SimilaritySignal[] = [];

    // 1. Time proximity
    const timeDiff = Math.abs(a.metadata.creationTime - b.metadata.creationTime);
    const timeScore = Math.max(0, 1 - timeDiff / this.timeWindowMs);
    signals.push({
      name: 'timeProximity',
      weight: SIMILARITY_WEIGHTS.timeProximity,
      value: timeScore,
      description: `Taken ${(timeDiff / 1000).toFixed(1)}s apart`,
    });

    // 2. Dimension match
    const dimA = a.metadata.width * a.metadata.height;
    const dimB = b.metadata.width * b.metadata.height;
    const dimRatio = Math.min(dimA, dimB) / Math.max(dimA, dimB);
    signals.push({
      name: 'dimensionMatch',
      weight: SIMILARITY_WEIGHTS.dimensionMatch,
      value: dimRatio,
      description: `Resolution ratio ${dimRatio.toFixed(2)}`,
    });

    // 3. Aspect ratio match
    const arA = a.metadata.aspectRatio;
    const arB = b.metadata.aspectRatio;
    const arDiff = Math.abs(arA - arB);
    const arScore = Math.max(0, 1 - arDiff / 0.5);
    signals.push({
      name: 'aspectRatioMatch',
      weight: SIMILARITY_WEIGHTS.aspectRatioMatch,
      value: arScore,
      description: `Aspect ratio diff ${arDiff.toFixed(3)}`,
    });

    // 4. Filename pattern (burst shots often have sequential names)
    const filenameScore = this.filenameSimilarity(a.asset.filename, b.asset.filename);
    signals.push({
      name: 'filenamePattern',
      weight: SIMILARITY_WEIGHTS.filenamePattern,
      value: filenameScore,
      description: filenameScore > 0.8 ? 'Sequential burst filenames' : 'Different filenames',
    });

    // 5. File size proximity
    const sizeA = a.metadata.fileSize ?? dimA * 3;
    const sizeB = b.metadata.fileSize ?? dimB * 3;
    const sizeRatio = Math.min(sizeA, sizeB) / Math.max(sizeA, sizeB);
    signals.push({
      name: 'fileSizeProximity',
      weight: SIMILARITY_WEIGHTS.fileSizeProximity,
      value: sizeRatio,
      description: `File size ratio ${sizeRatio.toFixed(2)}`,
    });

    // 6. Orientation match
    const orientScore = a.metadata.isPortrait === b.metadata.isPortrait ? 1 : 0;
    signals.push({
      name: 'orientationMatch',
      weight: SIMILARITY_WEIGHTS.orientationMatch,
      value: orientScore,
      description: orientScore === 1 ? 'Same orientation' : 'Different orientation',
    });

    return signals;
  }

  private aggregateScore(signals: SimilaritySignal[]): number {
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private filenameSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const baseA = a.replace(/\.[^.]+$/, '');
    const baseB = b.replace(/\.[^.]+$/, '');

    // Check for common burst patterns: IMG_0001, IMG_0002
    const burstPattern = /^(.+?)(\d+)$/;
    const matchA = baseA.match(burstPattern);
    const matchB = baseB.match(burstPattern);

    if (matchA && matchB && matchA[1] === matchB[1]) {
      const numA = parseInt(matchA[2], 10);
      const numB = parseInt(matchB[2], 10);
      const numDiff = Math.abs(numA - numB);
      // Sequential numbers within 10 get high score
      if (numDiff <= 2) return 1.0;
      if (numDiff <= 5) return 0.8;
      if (numDiff <= 10) return 0.6;
      return 0.3;
    }

    // Simple prefix match
    const minLen = Math.min(baseA.length, baseB.length);
    let commonPrefix = 0;
    for (let i = 0; i < minLen; i++) {
      if (baseA[i] === baseB[i]) commonPrefix++;
      else break;
    }
    return commonPrefix / Math.max(baseA.length, baseB.length);
  }
}

// Future ML-based similarity engine using embeddings
export class EmbeddingSimilarityEngine implements SimilarityEngine {
  private model: EmbeddingModel;
  private threshold: number;
  private timeWindowMs: number;

  constructor(model: EmbeddingModel, threshold = MIN_SIMILARITY_THRESHOLD, timeWindowMs = DEFAULT_TIME_WINDOW_MS) {
    this.model = model;
    this.threshold = threshold;
    this.timeWindowMs = timeWindowMs;
  }

  async findCandidates(inputs: PhotoAnalysisInput[]): Promise<CandidatePair[]> {
    // Generate embeddings for all inputs
    const embeddings = await Promise.all(
      inputs.map((input) => this.model.generateEmbedding(input))
    );

    const sorted = [...inputs].sort((a, b) => a.metadata.creationTime - b.metadata.creationTime);
    const sortedIndices = sorted.map((s) => inputs.findIndex((i) => i.asset.id === s.asset.id));
    const pairs: CandidatePair[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const idxA = sortedIndices[i];
      const photoA = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const idxB = sortedIndices[j];
        const photoB = sorted[j];
        const timeDiff = photoB.metadata.creationTime - photoA.metadata.creationTime;
        if (timeDiff > this.timeWindowMs) break;

        const embeddingScore = this.model.compareEmbeddings(embeddings[idxA], embeddings[idxB]);
        // Blend embedding score with time proximity
        const timeScore = Math.max(0, 1 - timeDiff / this.timeWindowMs);
        const blendedScore = 0.7 * embeddingScore + 0.3 * timeScore;

        if (blendedScore >= this.threshold) {
          pairs.push({
            photoA,
            photoB,
            similarityScore: blendedScore,
            signals: [
              {
                name: 'embeddingSimilarity',
                weight: 0.7,
                value: embeddingScore,
                description: `Visual embedding similarity ${embeddingScore.toFixed(3)}`,
              },
              {
                name: 'timeProximity',
                weight: 0.3,
                value: timeScore,
                description: `Taken ${(timeDiff / 1000).toFixed(1)}s apart`,
              },
            ],
          });
        }
      }
    }

    return pairs;
  }
}
