/**
 * PhotoAssetService
 *
 * Abstracts expo-media-library access and normalises raw assets into
 * the app's PhotoAsset type. All media-library I/O goes through here,
 * keeping screens and domain logic free of MediaLibrary imports.
 */

import * as MediaLibrary from 'expo-media-library';
import type { PhotoAsset } from '../../types';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'limited';

export interface PhotoAssetServiceI {
  requestPermission(): Promise<PermissionStatus>;
  checkPermission(): Promise<PermissionStatus>;
  /**
   * Fetch a page of assets from the device library.
   * Returns an empty array if permission is not granted.
   */
  fetchAssets(options?: FetchOptions): Promise<PhotoAsset[]>;
  /** Fetch by explicit list of media-library IDs */
  fetchAssetsByIds(ids: string[]): Promise<PhotoAsset[]>;
  /** Delete assets by media-library ID. Returns IDs that were successfully deleted. */
  deleteAssets(mediaLibraryIds: string[]): Promise<string[]>;
  /** Get the current total count of photos on device */
  getTotalCount(): Promise<number>;
}

export interface FetchOptions {
  first?: number;
  after?: string;
  mediaType?: ('photo' | 'video')[];
  sortBy?: 'creationTime' | 'modificationTime' | 'mediaType';
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Normalisation helper
// ---------------------------------------------------------------------------

function normaliseAsset(asset: MediaLibrary.Asset): PhotoAsset {
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    width: asset.width,
    height: asset.height,
    fileSize: (asset as any).fileSize ?? null,
    creationTime: asset.creationTime,
    modificationTime: asset.modificationTime,
    duration: asset.duration ?? null,
    albumId: null,
    mediaType: asset.mediaType === 'video' ? 'video' : 'photo',
    mediaLibraryId: asset.id,
  };
}

// ---------------------------------------------------------------------------
// Real implementation (requires expo-media-library)
// ---------------------------------------------------------------------------

export class ExpoPhotoAssetService implements PhotoAssetServiceI {
  async requestPermission(): Promise<PermissionStatus> {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status as PermissionStatus;
  }

  async checkPermission(): Promise<PermissionStatus> {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status as PermissionStatus;
  }

  async fetchAssets(options: FetchOptions = {}): Promise<PhotoAsset[]> {
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') return [];

    const result = await MediaLibrary.getAssetsAsync({
      first: options.first ?? 100,
      after: options.after,
      mediaType: options.mediaType ?? ['photo'],
      sortBy: options.sortBy
        ? [[options.sortBy as MediaLibrary.SortByKey, options.sortOrder !== 'asc']]
        : [[MediaLibrary.SortBy.creationTime, true]],
    });

    return result.assets.map(normaliseAsset);
  }

  async fetchAssetsByIds(ids: string[]): Promise<PhotoAsset[]> {
    if (ids.length === 0) return [];
    const assets: PhotoAsset[] = [];
    for (const id of ids) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(id);
        if (asset) assets.push(normaliseAsset(asset));
      } catch {
        // asset may have been deleted externally — skip
      }
    }
    return assets;
  }

  async deleteAssets(mediaLibraryIds: string[]): Promise<string[]> {
    if (mediaLibraryIds.length === 0) return [];
    try {
      // deleteAssetsAsync returns true/false on iOS; on Android it may throw
      await MediaLibrary.deleteAssetsAsync(mediaLibraryIds);
      return mediaLibraryIds;
    } catch (err) {
      console.warn('PhotoAssetService.deleteAssets error:', err);
      return [];
    }
  }

  async getTotalCount(): Promise<number> {
    const result = await MediaLibrary.getAssetsAsync({ first: 1, mediaType: ['photo'] });
    return result.totalCount ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton export — screens import this directly
// ---------------------------------------------------------------------------

export const photoAssetService: PhotoAssetServiceI = new ExpoPhotoAssetService();
