import {
  CandidatePair,
  PhotoCluster,
  PhotoAnalysisInput,
  ClusterStatus,
  ClusteringEngine,
} from '@/types';
import { CLUSTERING_MIN_SIZE, CLUSTERING_MAX_SIZE } from '@/constants';
import { v4 as uuidv4 } from 'uuid';

// Union-Find (Disjoint Set Union) for efficient transitive clustering
class UnionFind {
  private parent: Map<string, string>;

  constructor() {
    this.parent = new Map();
  }

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      return id;
    }
    let root = id;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let curr = id;
    while (this.parent.get(curr) !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootA, rootB);
    }
  }
}

export class TransitiveClusteringEngine implements ClusteringEngine {
  cluster(candidates: CandidatePair[]): PhotoCluster[] {
    if (candidates.length === 0) return [];

    // Build union-find from candidate pairs
    const uf = new UnionFind();
    const allInputs = new Map<string, PhotoAnalysisInput>();

    for (const pair of candidates) {
      const idA = pair.photoA.asset.id;
      const idB = pair.photoB.asset.id;
      uf.union(idA, idB);
      allInputs.set(idA, pair.photoA);
      allInputs.set(idB, pair.photoB);
    }

    // Group by root
    const groups = new Map<string, PhotoAnalysisInput[]>();
    for (const [id, input] of allInputs) {
      const root = uf.find(id);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(input);
    }

    // Build clusters
    const clusters: PhotoCluster[] = [];
    for (const [, photos] of groups) {
      const status = this.determineStatus(photos);
      clusters.push({
        id: uuidv4(),
        photos,
        status,
      });
    }

    return clusters;
  }

  private determineStatus(photos: PhotoAnalysisInput[]): ClusterStatus {
    if (photos.length < CLUSTERING_MIN_SIZE) {
      return 'skipped';
    }
    if (photos.length > CLUSTERING_MAX_SIZE) {
      return 'manual_review'; // too large, likely misclustered
    }
    // Check for diversity — if photos span too wide a time range, flag for review
    const times = photos.map((p) => p.metadata.creationTime).sort((a, b) => a - b);
    const timeSpan = times[times.length - 1] - times[0];
    const maxSpan = 5 * 60 * 1000; // 5 minutes
    if (timeSpan > maxSpan) {
      return 'manual_review';
    }
    return 'actionable';
  }
}

// Alternative: strict window-based clustering (non-transitive)
export class WindowClusteringEngine implements ClusteringEngine {
  private windowMs: number;

  constructor(windowMs = 30 * 1000) {
    this.windowMs = windowMs;
  }

  cluster(candidates: CandidatePair[]): PhotoCluster[] {
    if (candidates.length === 0) return [];

    // Collect all photos
    const photoMap = new Map<string, PhotoAnalysisInput>();
    for (const pair of candidates) {
      photoMap.set(pair.photoA.asset.id, pair.photoA);
      photoMap.set(pair.photoB.asset.id, pair.photoB);
    }

    const photos = Array.from(photoMap.values()).sort(
      (a, b) => a.metadata.creationTime - b.metadata.creationTime
    );

    const clusters: PhotoCluster[] = [];
    let currentGroup: PhotoAnalysisInput[] = [];

    for (const photo of photos) {
      if (currentGroup.length === 0) {
        currentGroup.push(photo);
      } else {
        const lastPhoto = currentGroup[currentGroup.length - 1];
        const timeDiff = photo.metadata.creationTime - lastPhoto.metadata.creationTime;
        if (timeDiff <= this.windowMs) {
          currentGroup.push(photo);
        } else {
          clusters.push(this.createCluster(currentGroup));
          currentGroup = [photo];
        }
      }
    }

    if (currentGroup.length > 0) {
      clusters.push(this.createCluster(currentGroup));
    }

    return clusters;
  }

  private createCluster(photos: PhotoAnalysisInput[]): PhotoCluster {
    const status = photos.length >= CLUSTERING_MIN_SIZE ? 'actionable' : 'skipped';
    return {
      id: uuidv4(),
      photos,
      status,
    };
  }
}
