import { useCallback, useState } from 'react';
import { PhotoAsset } from '@/types';
import { PhotoAssetService } from '@/domain/photo/photoAssetService';
import { useSelectionStore } from '@/store/selectionStore';

export function usePhotoPicker(assetService: PhotoAssetService) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const { setAssets, toggleSelection, selectMultiple, deselectAll, getSelectedAssets } =
    useSelectionStore();

  const requestPermission = useCallback(async () => {
    try {
      const granted = await assetService.requestPermissions();
      setHasPermission(granted);
      return granted;
    } catch {
      setHasPermission(false);
      return false;
    }
  }, [assetService]);

  const loadPhotos = useCallback(
    async (count: number = 50) => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setError('Photo library permission is required.');
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await assetService.getAssets({ first: count, mediaType: ['photo'] });
        setAssets(result.assets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      } finally {
        setIsLoading(false);
      }
    },
    [assetService, hasPermission, requestPermission, setAssets]
  );

  const loadMore = useCallback(
    async (after: string, count: number = 50) => {
      setIsLoading(true);
      try {
        const result = await assetService.getAssets({
          first: count,
          after,
          mediaType: ['photo'],
        });
        const currentAssets = useSelectionStore.getState().assets;
        useSelectionStore.getState().setAssets([...currentAssets, ...result.assets]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load more photos');
      } finally {
        setIsLoading(false);
      }
    },
    [assetService]
  );

  return {
    isLoading,
    error,
    hasPermission,
    requestPermission,
    loadPhotos,
    loadMore,
    toggleSelection,
    selectMultiple,
    deselectAll,
    getSelectedAssets,
  };
}
