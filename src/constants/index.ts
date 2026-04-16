export const APP_NAME = 'Photo Cleanup';
export const APP_TAGLINE = 'Find duplicates and burst shots. Keep the right ones.';

export const MIN_PHOTOS_FOR_CLEANUP = 2;
export const MAX_PHOTOS_FOR_CLEANUP = 200;
export const RECOMMENDED_PHOTO_COUNT = 50;

export const DEFAULT_TIME_WINDOW_MS = 30 * 1000; // 30 seconds
export const MAX_TIME_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
export const MIN_SIMILARITY_THRESHOLD = 0.6;
export const CONFIDENCE_THRESHOLD = 0.7;
export const RECOMMENDATION_MARGIN_MIN = 0.15;

export const THUMBNAIL_SIZE = 256;
export const THUMBNAIL_QUALITY = 0.8;

export const SIMILARITY_WEIGHTS = {
  timeProximity: 0.35,
  dimensionMatch: 0.15,
  aspectRatioMatch: 0.15,
  filenamePattern: 0.10,
  fileSizeProximity: 0.15,
  orientationMatch: 0.10,
} as const;

export const QUALITY_WEIGHTS = {
  resolution: 0.30,
  fileSize: 0.20,
  recency: 0.20,
  hasHDR: 0.15,
  hasLivePhoto: 0.15,
} as const;

export const CLUSTERING_MIN_SIZE = 2;
export const CLUSTERING_MAX_SIZE = 20;

export const CONFIDENCE_LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence — review recommended',
  low: 'Low confidence — manual review required',
} as const;

export const DELETION_MESSAGES = {
  reviewTitle: 'Review before deleting',
  reviewSubtitle: (count: number) =>
    `${count} photo${count === 1 ? '' : 's'} will be moved to your device\'s Recently Deleted. You can recover them for about 30 days.`,
  confirmButton: 'Confirm Deletion',
  cancelButton: 'Cancel',
  keepButton: 'Keep This One',
  changeKeepButton: 'Choose Different Keep',
} as const;
