/**
 * Human-readable formatters for display in the UI.
 */

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a timestamp (ms since epoch) to a human-readable date string.
 */
export function formatDate(timestampMs: number): string {
  if (!timestampMs) return 'Unknown';
  const date = new Date(timestampMs);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a confidence value (0–1) as a percentage string.
 */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

/**
 * Format a resolution as a string.
 */
export function formatResolution(width: number, height: number): string {
  return `${width}×${height}`;
}

/**
 * Format megapixels from width/height.
 */
export function formatMegapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return `${mp.toFixed(1)} MP`;
}

/**
 * Format a count as "N photo(s)".
 */
export function formatPhotoCount(count: number): string {
  return count === 1 ? '1 photo' : `${count} photos`;
}

/**
 * Format a time delta in ms to a human-readable string.
 */
export function formatTimeDelta(deltaMs: number): string {
  if (deltaMs < 1000) return `${deltaMs}ms`;
  if (deltaMs < 60_000) return `${(deltaMs / 1000).toFixed(1)}s`;
  if (deltaMs < 3_600_000) return `${(deltaMs / 60_000).toFixed(1)}min`;
  return `${(deltaMs / 3_600_000).toFixed(1)}hr`;
}
