/**
 * ThumbnailCache
 *
 * Manages a cache of small analysis-resolution thumbnail URIs.
 * In the MVP, this is a simple in-memory map. A future version
 * could use expo-file-system to persist thumbnails between sessions.
 *
 * Thumbnails at analysis resolution (64px) are used to pass visual
 * signals to a native ML adapter in a future phase.
 */

export class ThumbnailCache {
  private readonly cache = new Map<string, string>();

  has(assetId: string): boolean {
    return this.cache.has(assetId);
  }

  get(assetId: string): string | undefined {
    return this.cache.get(assetId);
  }

  set(assetId: string, thumbnailUri: string): void {
    this.cache.set(assetId, thumbnailUri);
  }

  delete(assetId: string): void {
    this.cache.delete(assetId);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const thumbnailCache = new ThumbnailCache();
