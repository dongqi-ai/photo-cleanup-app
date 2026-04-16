import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelectionStore } from '@/store/selectionStore';
import { usePhotoPicker } from '@/hooks/usePhotoPicker';
import { ExpoPhotoAssetService } from '@/domain/photo/photoAssetService';
import { PhotoAsset } from '@/types';
import { MAX_PHOTOS_FOR_CLEANUP } from '@/constants';

const assetService = new ExpoPhotoAssetService();

export default function PickerScreen() {
  const router = useRouter();
  const {
    isLoading,
    error,
    hasPermission,
    loadPhotos,
    toggleSelection,
    getSelectedAssets,
  } = usePhotoPicker(assetService);

  const assets = useSelectionStore((s) => s.assets);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectedCount = selectedIds.size;

  useEffect(() => {
    if (!hasPermission) {
      loadPhotos();
    }
  }, [hasPermission, loadPhotos]);

  const handleToggle = useCallback(
    (asset: PhotoAsset) => {
      if (!selectedIds.has(asset.id) && selectedCount >= MAX_PHOTOS_FOR_CLEANUP) {
        Alert.alert(
          'Limit reached',
          `You can select up to ${MAX_PHOTOS_FOR_CLEANUP} photos at once.`
        );
        return;
      }
      toggleSelection(asset);
    },
    [selectedIds, selectedCount, toggleSelection]
  );

  const handleDone = useCallback(() => {
    if (selectedCount < 2) {
      Alert.alert('Select more photos', 'Please select at least 2 photos to analyze.');
      return;
    }
    router.back();
  }, [selectedCount, router]);

  const renderItem = useCallback(
    ({ item }: { item: PhotoAsset }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <Pressable
          style={[styles.gridItem, isSelected && styles.gridItemSelected]}
          onPress={() => handleToggle(item)}
        >
          <Image source={{ uri: item.uri }} style={styles.thumbnail} />
          {isSelected && (
            <View style={styles.selectionOverlay}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            </View>
          )}
        </Pressable>
      );
    },
    [selectedIds, handleToggle]
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.headerBar}>
        <Text style={styles.headerText}>
          {selectedCount} selected{selectedCount > 0 ? ` / ${MAX_PHOTOS_FOR_CLEANUP} max` : ''}
        </Text>
        <Pressable
          style={[styles.doneButton, selectedCount < 2 && styles.doneButtonDisabled]}
          onPress={handleDone}
          disabled={selectedCount < 2}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      {isLoading && assets.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d6efd" />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  errorBanner: {
    backgroundColor: '#f8d7da',
    padding: 12,
  },
  errorText: {
    color: '#842029',
    fontSize: 14,
    textAlign: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerText: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: '#0d6efd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6c757d',
  },
  gridContent: {
    padding: 2,
  },
  gridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
    position: 'relative',
  },
  gridItemSelected: {
    opacity: 0.85,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 110, 253, 0.3)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 8,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0d6efd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
