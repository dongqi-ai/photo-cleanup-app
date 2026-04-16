import { PhotoAsset, PhotoAnalysisInput, PhotoMetadata } from '@/types';

export interface ThumbnailService {
  buildAnalysisInput(asset: PhotoAsset): Promise<PhotoAnalysisInput>;
  buildAnalysisInputs(assets: PhotoAsset[]): Promise<PhotoAnalysisInput[]>;
}

// Extract metadata-derived analysis inputs without heavy native processing
export class MetadataThumbnailService implements ThumbnailService {
  async buildAnalysisInput(asset: PhotoAsset): Promise<PhotoAnalysisInput> {
    const metadata = this.extractMetadata(asset);
    return {
      asset,
      metadata,
    };
  }

  async buildAnalysisInputs(assets: PhotoAsset[]): Promise<PhotoAnalysisInput[]> {
    return assets.map((asset) => ({
      asset,
      metadata: this.extractMetadata(asset),
    }));
  }

  private extractMetadata(asset: PhotoAsset): PhotoMetadata {
    const isPortrait = asset.height > asset.width;
    const aspectRatio = asset.width / Math.max(asset.height, 1);

    // Infer file size from dimensions as a proxy (we don't always have real fileSize)
    const estimatedFileSize = asset.width * asset.height * 3; // rough bytes for uncompressed

    return {
      width: asset.width,
      height: asset.height,
      fileSize: estimatedFileSize,
      creationTime: asset.creationTime,
      isPortrait,
      aspectRatio,
      hasHDR: asset.mediaSubtypes?.includes('hdr') ?? false,
      hasLivePhoto: asset.mediaSubtypes?.includes('livePhoto') ?? false,
    };
  }
}

// Placeholder for future native thumbnail generation via expo-image-manipulator
export class NativeThumbnailService implements ThumbnailService {
  private fallback: MetadataThumbnailService;

  constructor() {
    this.fallback = new MetadataThumbnailService();
  }

  async buildAnalysisInput(asset: PhotoAsset): Promise<PhotoAnalysisInput> {
    // TODO: generate actual thumbnail via expo-image-manipulator when available
    // For now, delegate to metadata-based approach
    return this.fallback.buildAnalysisInput(asset);
  }

  async buildAnalysisInputs(assets: PhotoAsset[]): Promise<PhotoAnalysisInput[]> {
    return this.fallback.buildAnalysisInputs(assets);
  }
}
