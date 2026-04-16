// Core photo asset type (mirrors expo-media-library Asset but kept abstract)
export interface PhotoAsset {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number; // ms since epoch
  modificationTime: number;
  duration: number; // 0 for photos
  mediaType: 'photo' | 'video' | 'unknown';
  mediaSubtypes?: string[];
}

// Analysis input derived from a photo asset
export interface PhotoAnalysisInput {
  asset: PhotoAsset;
  thumbnailUri?: string;
  metadata: PhotoMetadata;
}

export interface PhotoMetadata {
  width: number;
  height: number;
  fileSize?: number;
  creationTime: number;
  isPortrait: boolean;
  aspectRatio: number;
  hasHDR?: boolean;
  hasLivePhoto?: boolean;
}

// A candidate pair of potentially similar photos
export interface CandidatePair {
  photoA: PhotoAnalysisInput;
  photoB: PhotoAnalysisInput;
  similarityScore: number; // 0-1
  signals: SimilaritySignal[];
}

export interface SimilaritySignal {
  name: string;
  weight: number;
  value: number; // 0-1
  description: string;
}

// Cluster of similar photos
export interface PhotoCluster {
  id: string;
  photos: PhotoAnalysisInput[];
  status: ClusterStatus;
  recommendation?: ClusterRecommendation;
}

export type ClusterStatus =
  | 'actionable'       // 2+ photos, has recommendation
  | 'manual_review'    // low confidence, needs user
  | 'skipped'          // ineligible (e.g. only 1 photo)
  | 'ineligible';      // failed validation

export interface ClusterRecommendation {
  keepPhotoId: string;
  deletePhotoIds: string[];
  confidence: number; // 0-1
  reason: RecommendationReason;
  margin: number; // score gap between keep and runner-up
}

export interface RecommendationReason {
  summary: string;
  details: string[];
}

// Quality score for a photo within a cluster
export interface QualityScore {
  photoId: string;
  totalScore: number;
  signals: QualitySignal[];
}

export interface QualitySignal {
  name: string;
  weight: number;
  rawValue: number;
  normalizedScore: number; // 0-1 after weighting
  description: string;
}

// Deletion plan
export interface DeletionPlan {
  id: string;
  clusters: ClusterDeletionPlan[];
  totalPhotosToDelete: number;
  totalSpaceEstimateBytes: number;
  status: PlanStatus;
}

export interface ClusterDeletionPlan {
  clusterId: string;
  keepPhotoId: string;
  deletePhotoIds: string[];
  confirmed: boolean;
}

export type PlanStatus = 'draft' | 'reviewing' | 'confirmed' | 'executed' | 'partial';

// App-level selection state
export interface SelectionState {
  selectedIds: Set<string>;
  assets: PhotoAsset[];
  isLoading: boolean;
  error: string | null;
}

// Processing pipeline state
export interface ProcessingState {
  stage: ProcessingStage;
  progress: number; // 0-1
  clusters: PhotoCluster[];
  plan: DeletionPlan | null;
  isComplete: boolean;
  error: string | null;
}

export type ProcessingStage =
  | 'idle'
  | 'loading_assets'
  | 'normalizing'
  | 'building_thumbnails'
  | 'generating_candidates'
  | 'clustering'
  | 'ranking'
  | 'building_recommendations'
  | 'building_plan'
  | 'complete';

// Review state
export interface ReviewState {
  currentClusterIndex: number;
  userDecisions: Map<string, UserClusterDecision>;
  plan: DeletionPlan | null;
}

export interface UserClusterDecision {
  clusterId: string;
  keepPhotoId: string;
  deletePhotoIds: string[];
  overrideReason?: string;
}

// Settings
export interface AppSettings {
  timeWindowSeconds: number;
  minSimilarityThreshold: number;
  confidenceThreshold: number;
  preferRecent: boolean;
  preferLarger: boolean;
  requireExplicitConfirmation: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  timeWindowSeconds: 30,        // group photos taken within 30s
  minSimilarityThreshold: 0.6,  // minimum to form a candidate pair
  confidenceThreshold: 0.7,     // minimum for auto-recommendation
  preferRecent: true,
  preferLarger: true,
  requireExplicitConfirmation: true,
};

// ML / Inference interfaces (replaceable)
export interface EmbeddingModel {
  name: string;
  generateEmbedding(input: PhotoAnalysisInput): Promise<number[]>;
  compareEmbeddings(a: number[], b: number[]): number; // cosine similarity
}

export interface SimilarityEngine {
  findCandidates(inputs: PhotoAnalysisInput[]): Promise<CandidatePair[]>;
}

export interface ClusteringEngine {
  cluster(candidates: CandidatePair[]): PhotoCluster[];
}

export interface QualityEngine {
  rank(photos: PhotoAnalysisInput[]): QualityScore[];
}

export interface RecommendationService {
  recommend(cluster: PhotoCluster, scores: QualityScore[]): ClusterRecommendation | null;
}

export interface ExplanationService {
  explain(recommendation: ClusterRecommendation, scores: QualityScore[]): RecommendationReason;
}
