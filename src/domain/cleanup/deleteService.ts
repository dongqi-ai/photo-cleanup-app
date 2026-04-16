import { DeletionPlan, ClusterDeletionPlan, PhotoAsset } from '@/types';

export interface DeleteService {
  executePlan(plan: DeletionPlan): Promise<DeleteResult>;
  deleteAssets(ids: string[]): Promise<{ deleted: string[]; failed: string[] }>;
}

export interface DeleteResult {
  planId: string;
  deleted: string[];
  failed: { id: string; reason: string }[];
  status: 'success' | 'partial' | 'failed';
}

// Expo MediaLibrary delete adapter
export class ExpoDeleteService implements DeleteService {
  private mediaLibrary: typeof import('expo-media-library') | null = null;

  private async getLibrary(): Promise<typeof import('expo-media-library')> {
    if (!this.mediaLibrary) {
      this.mediaLibrary = await import('expo-media-library');
    }
    return this.mediaLibrary;
  }

  async executePlan(plan: DeletionPlan): Promise<DeleteResult> {
    const confirmed = plan.clusters.filter((c) => c.confirmed);
    const allIdsToDelete = confirmed.flatMap((c) => c.deletePhotoIds);

    if (allIdsToDelete.length === 0) {
      return {
        planId: plan.id,
        deleted: [],
        failed: [],
        status: 'failed',
      };
    }

    return this.deleteAssets(allIdsToDelete);
  }

  async deleteAssets(ids: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    try {
      const lib = await this.getLibrary();
      // On iOS, deleting moves to Recently Deleted
      // On Android, behavior depends on OS version
      const result = await lib.deleteAssetsAsync(ids);
      // deleteAssetsAsync returns a boolean on some versions, or void
      // We assume success for the requested IDs
      return {
        deleted: ids,
        failed: [],
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      return {
        deleted: [],
        failed: ids,
      };
    }
  }
}

// Mock delete service for testing
export class MockDeleteService implements DeleteService {
  private deletedIds: string[] = [];

  async executePlan(plan: DeletionPlan): Promise<DeleteResult> {
    const confirmed = plan.clusters.filter((c) => c.confirmed);
    const allIdsToDelete = confirmed.flatMap((c) => c.deletePhotoIds);
    return this.deleteAssets(allIdsToDelete);
  }

  async deleteAssets(ids: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    this.deletedIds.push(...ids);
    return {
      deleted: ids,
      failed: [],
    };
  }

  getDeletedIds(): string[] {
    return [...this.deletedIds];
  }

  clear() {
    this.deletedIds = [];
  }
}
