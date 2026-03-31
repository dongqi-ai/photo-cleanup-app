// ---------------------------------------------------------------------------
// Core domain types for the Photo Cleanup MVP
// ---------------------------------------------------------------------------

// ─── Photo Assets ──────────────────────────────────────────────────────────

/** Normalised representation of a device photo asset */
export interface PhotoAsset {
  id: string;
  uri: string;
  filename: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** File size in bytes */
  fileSize: number | null;
  /** Creation timestamp (ms since epoch) */
  creationTime: number;
  /** Modification timestamp (ms since epoch) */
  modificationTime: number;
  /** EXIF duration in seconds for videos (null for photos) */
  duration: number | null;
  /** Album/folder name if available */
  albumId: string | null;
  /** Media type */
  mediaType: 'photo' | 'video';
  /** Raw MediaLibrary asset id */
  mediaLibraryId: string;
}

// ─── Analysis & Similarity ─────────────────────────────────────────────────

/**
 * Per-photo quality signals used for ranking within a group.
 * All values are normalised 0–1 unless noted.
 */
export interface QualitySignals {
  assetId: string;
  /** Resolution score: (w*h) / maxResolutionInGroup */
  resolutionScore: number;
  /** Estimated sharpness proxy (0–1); MVP uses metadata heuristics */
  sharpnessScore: number;
  /** Brightness estimate (0–1); MVP uses metadata heuristics */
  brightnessScore: number;
  /** Composite quality score (weighted combination) */
  compositeScore: number;
  /** Human-readable explanations for the scores */
  explanations: string[];
}

/** A pair of photos considered potentially similar */
export interface CandidatePair {
  assetIdA: string;
  assetIdB: string;
  /** Similarity score 0–1 */
  score: number;
  /** Signals that drove the score */
  signals: SimilaritySignal[];
}

export interface SimilaritySignal {
  name: string;
  value: number;
  weight: number;
  description: string;
}

// ─── Grouping & Clustering ─────────────────────────────────────────────────

export type GroupStatus =
  | 'actionable'     // 2+ photos, clear recommendation
  | 'manual-review'  // 2+ photos, low confidence — needs human decision
  | 'skipped'        // <2 photos or ungrouped singles
  | 'ineligible';    // filtered out before processing

/** A cluster of likely-duplicate or burst-like photos */
export interface PhotoGroup {
  id: string;
  status: GroupStatus;
  /** Sorted list of asset IDs in this group (best first for actionable) */
  assetIds: string[];
  /** Asset ID of the recommended keep, if confidence is high enough */
  recommendedKeepId: string | null;
  /** Asset IDs planned for deletion — empty until user approves */
  plannedDeletionIds: string[];
  /** Similarity score for the group (avg pair score) */
  groupScore: number;
  /** Confidence 0–1 that the recommendation is correct */
  confidence: number;
  /** Human-readable explanation of why these are grouped */
  groupReason: string;
  /** Explanation for the keep recommendation */
  keepReason: string | null;
  /** Signals driving the recommendation */
  qualitySignals: Record<string, QualitySignals>;
  /** Whether the user has reviewed this group */
  reviewed: boolean;
  /** User override: which photo to keep (overrides recommendedKeepId) */
  userKeepId: string | null;
  /** User has explicitly marked photos for deletion */
  userDeletionIds: string[];
}

// ─── Deletion Plan ────────────────────────────────────────────────────────

export interface DeletionPlanItem {
  assetId: string;
  groupId: string;
  filename: string;
  uri: string;
  /** Why this is in the deletion plan */
  reason: string;
  /** User has confirmed this item */
  confirmed: boolean;
}

export interface DeletionPlan {
  id: string;
  createdAt: number;
  items: DeletionPlanItem[];
  status: 'pending' | 'in-progress' | 'completed' | 'partially-completed' | 'cancelled';
  /** Results after execution */
  results: DeletionResult[];
}

export interface DeletionResult {
  assetId: string;
  success: boolean;
  error?: string;
}

// ─── Pipeline State ───────────────────────────────────────────────────────

export type PipelineStage =
  | 'idle'
  | 'normalizing'
  | 'analyzing'
  | 'pairing'
  | 'clustering'
  | 'ranking'
  | 'building-plan'
  | 'complete'
  | 'error';

export interface PipelineProgress {
  stage: PipelineStage;
  progress: number;     // 0–1
  message: string;
  error?: string;
}

// ─── Processing Result ───────────────────────────────────────────────────

export interface ProcessingResult {
  groups: PhotoGroup[];
  ungroupedAssetIds: string[];
  candidatePairs: CandidatePair[];
  processedAt: number;
  totalPhotosAnalyzed: number;
  actionableGroups: number;
  manualReviewGroups: number;
  photosEligibleForDeletion: number;
}

// ─── Similarity Engine Interface ──────────────────────────────────────────

/**
 * Pluggable similarity engine interface.
 * MVP uses a deterministic metadata heuristic adapter.
 * Replace with TFLite embedding adapter in a future phase.
 */
export interface SimilarityEngineAdapter {
  readonly adapterName: string;
  readonly adapterVersion: string;
  /**
   * Given a list of normalised assets, produce candidate pairs.
   * Implementations should be pure: same input → same output.
   */
  generateCandidatePairs(assets: PhotoAsset[]): Promise<CandidatePair[]>;
}

// ─── Review Decision ────────────────────────────────────────────────────

export interface ReviewDecision {
  groupId: string;
  keepId: string;
  deletionIds: string[];
  decidedAt: number;
}

// ─── Settings ────────────────────────────────────────────────────────────

export interface AppSettings {
  /** Minimum similarity score to form a pair (0–1). Default 0.65 */
  similarityThreshold: number;
  /** Minimum confidence to show an auto-recommendation (0–1). Default 0.70 */
  recommendationConfidenceThreshold: number;
  /** Time window in seconds for burst detection. Default 8 */
  burstWindowSeconds: number;
  /** Max photos to select at once */
  maxSelectionSize: number;
  /** Show debug signals in review UI */
  showDebugSignals: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  similarityThreshold: 0.65,
  recommendationConfidenceThreshold: 0.70,
  burstWindowSeconds: 8,
  maxSelectionSize: 50,
  showDebugSignals: false,
};
