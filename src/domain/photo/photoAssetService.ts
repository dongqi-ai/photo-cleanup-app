import { PhotoAsset } from '@/types';

export interface PhotoAssetService {
  requestPermissions(): Promise<boolean>;
  getAssets(options: {
    first: number;
    after?: string;
    mediaType?: ('photo' | 'video')[];
  }): Promise<{ assets: PhotoAsset[]; hasNextPage: boolean; endCursor?: string }>;
  getAssetInfo(id: string): Promise<PhotoAsset | null>;
}

// Expo MediaLibrary adapter implementation
export class ExpoPhotoAssetService implements PhotoAssetService {
  private mediaLibrary: typeof import('expo-media-library') | null = null;

  constructor() {
    // Lazy import to allow testing without expo
    this.mediaLibrary = null;
  }

  private async getLibrary(): Promise<typeof import('expo-media-library')> {
    if (!this.mediaLibrary) {
      this.mediaLibrary = await import('expo-media-library');
    }
    return this.mediaLibrary;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const lib = await this.getLibrary();
      const { status } = await lib.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  async getAssets(options: {
    first: number;
    after?: string;
    mediaType?: ('photo' | 'video')[];
  }): Promise<{ assets: PhotoAsset[]; hasNextPage: boolean; endCursor?: string }> {
    const lib = await this.getLibrary();
    const result = await lib.getAssetsAsync({
      first: options.first,
      after: options.after,
      mediaType: options.mediaType ?? ['photo'],
      sortBy: [lib.SortBy.creationTime],
    });

    const assets: PhotoAsset[] = result.assets.map((a) => ({
      id: a.id,
      uri: a.uri,
      filename: a.filename ?? '',
      width: a.width,
      height: a.height,
      creationTime: a.creationTime,
      modificationTime: a.modificationTime,
      duration: a.duration,
      mediaType: a.mediaType === 'photo' ? 'photo' : a.mediaType === 'video' ? 'video' : 'unknown',
      mediaSubtypes: a.mediaSubtypes,
    }));

    return {
      assets,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    };
  }

  async getAssetInfo(id: string): Promise<PhotoAsset | null> {
    try {
      const lib = await this.getLibrary();
      const info = await lib.getAssetInfoAsync(id);
      if (!info) return null;
      return {
        id: info.id,
        uri: info.uri,
        filename: info.filename ?? '',
        width: info.width,
        height: info.height,
        creationTime: info.creationTime,
        modificationTime: info.modificationTime,
        duration: info.duration,
        mediaType: info.mediaType === 'photo' ? 'photo' : info.mediaType === 'video' ? 'video' : 'unknown',
        mediaSubtypes: info.mediaSubtypes,
      };
    } catch {
      return null;
    }
  }
}

// Mock implementation for testing
export class MockPhotoAssetService implements PhotoAssetService {
  private mockAssets: PhotoAsset[];

  constructor(assets: PhotoAsset[] = []) {
    this.mockAssets = assets;
  }

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async getAssets(options: {
    first: number;
    after?: string;
    mediaType?: ('photo' | 'video')[];
  }): Promise<{ assets: PhotoAsset[]; hasNextPage: boolean; endCursor?: string }> {
    const startIndex = options.after ? parseInt(options.after, 10) : 0;
    const endIndex = Math.min(startIndex + options.first, this.mockAssets.length);
    const assets = this.mockAssets.slice(startIndex, endIndex);
    return {
      assets,
      hasNextPage: endIndex < this.mockAssets.length,
      endCursor: endIndex < this.mockAssets.length ? String(endIndex) : undefined,
    };
  }

  async getAssetInfo(id: string): Promise<PhotoAsset | null> {
    return this.mockAssets.find((a) => a.id === id) ?? null;
  }

  setMockAssets(assets: PhotoAsset[]) {
    this.mockAssets = assets;
  }
}
