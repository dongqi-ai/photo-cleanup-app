// ---------------------------------------------------------------------------
// App-wide constants
// ---------------------------------------------------------------------------

export const APP_NAME = 'Photo Cleanup';
export const APP_VERSION = '1.0.0';

// ─── Pipeline tunables ──────────────────────────────────────────────────

/** Burst window: photos taken within this many seconds are burst candidates */
export const BURST_WINDOW_SECONDS = 8;

/** Extended time window for near-duplicates taken with a short delay */
export const NEAR_DUPLICATE_WINDOW_SECONDS = 30;

/** Minimum number of photos in a group to be actionable */
export const MIN_GROUP_SIZE = 2;

/** Minimum similarity score to form a candidate pair */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.65;

/** Minimum confidence to produce an auto-recommendation (vs manual-review) */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.70;

/** Minimum quality score margin between keep and next candidate */
export const MIN_QUALITY_MARGIN = 0.08;

/** Selection limits */
export const MIN_SELECTION_SIZE = 2;
export const MAX_SELECTION_SIZE = 50;

// ─── Quality signal weights ─────────────────────────────────────────────

export const QUALITY_WEIGHTS = {
  resolution: 0.35,
  sharpness: 0.35,
  brightness: 0.15,
  fileSize: 0.15,
} as const;

// ─── Similarity signal weights ──────────────────────────────────────────

export const SIMILARITY_WEIGHTS = {
  /** Temporal proximity: normalized inverse of time delta */
  temporal: 0.45,
  /** Resolution match: both photos have same or very similar resolution */
  resolution: 0.20,
  /** Filename pattern: burst sequence naming conventions */
  filename: 0.20,
  /** File size ratio: near-identical file sizes */
  fileSize: 0.15,
} as const;

// ─── Colors ─────────────────────────────────────────────────────────────

export const COLORS = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F3F5',
  border: '#DEE2E6',
  borderLight: '#E9ECEF',

  primary: '#1971C2',
  primaryLight: '#D0EBFF',
  primaryDark: '#1864AB',

  success: '#2F9E44',
  successLight: '#D3F9D8',

  warning: '#F08C00',
  warningLight: '#FFF3CD',

  danger: '#C92A2A',
  dangerLight: '#FFE3E3',

  neutral: '#495057',
  neutralLight: '#6C757D',
  neutralMuted: '#ADB5BD',

  textPrimary: '#212529',
  textSecondary: '#495057',
  textMuted: '#868E96',
  textDisabled: '#ADB5BD',
  textInverse: '#FFFFFF',

  keepBadge: '#2F9E44',
  deleteBadge: '#C92A2A',
  reviewBadge: '#F08C00',
  skippedBadge: '#868E96',
} as const;

// ─── Typography ─────────────────────────────────────────────────────────

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  hero: 36,
} as const;

export const FONT_WEIGHTS = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ─── Spacing ─────────────────────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ─── Border radius ───────────────────────────────────────────────────────

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

// ─── Thumbnail sizes ─────────────────────────────────────────────────────

export const THUMBNAIL_SIZE = {
  picker: 100,
  review: 140,
  fullscreen: 400,
  analysis: 64,   // Very small thumbnail for metadata analysis
} as const;

// ─── Async storage keys ──────────────────────────────────────────────────

export const STORAGE_KEYS = {
  settings: '@photo-cleanup/settings',
  lastSession: '@photo-cleanup/last-session',
} as const;
