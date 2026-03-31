/**
 * usePhotoLibrary
 *
 * Hook for requesting photo library permissions and loading assets
 * into the selection store.
 */

import { useState, useCallback } from 'react';
import { photoAssetService } from '../domain/photo/PhotoAssetService';
import { useSelectionStore } from '../store/selectionStore';
import type { PermissionStatus } from '../domain/photo/PhotoAssetService';

interface UsePhotoLibraryReturn {
  permissionStatus: PermissionStatus | null;
  requesting: boolean;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<PermissionStatus>;
  loadAssets: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function usePhotoLibrary(): UsePhotoLibraryReturn {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    setAvailableAssets,
    appendAssets,
    nextCursor,
    setLoadingMore,
  } = useSelectionStore();

  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    setRequesting(true);
    setError(null);
    try {
      const status = await photoAssetService.requestPermission();
      setPermissionStatus(status);
      return status;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Permission request failed';
      setError(msg);
      return 'denied';
    } finally {
      setRequesting(false);
    }
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assets = await photoAssetService.fetchAssets({
        first: 100,
        mediaType: ['photo'],
        sortBy: 'creationTime',
        sortOrder: 'desc',
      });
      setAvailableAssets(assets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load photos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setAvailableAssets]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const assets = await photoAssetService.fetchAssets({
        first: 100,
        after: nextCursor,
        mediaType: ['photo'],
        sortBy: 'creationTime',
        sortOrder: 'desc',
      });
      appendAssets(assets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load more photos';
      setError(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, appendAssets, setLoadingMore]);

  return {
    permissionStatus,
    requesting,
    loading,
    error,
    requestPermission,
    loadAssets,
    loadMore,
  };
}
