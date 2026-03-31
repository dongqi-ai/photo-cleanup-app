/**
 * Picker Screen
 *
 * Displays the device photo library in a grid. The user taps photos
 * to select them (2–50). Selected photos are passed to the pipeline.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { usePipeline } from '../hooks/usePipeline';
import { useSelectionStore } from '../store/selectionStore';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, RADIUS, THUMBNAIL_SIZE, MIN_SELECTION_SIZE, MAX_SELECTION_SIZE } from '../constants';
import type { PhotoAsset } from '../types';

const COLUMN_COUNT = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

export default function PickerScreen() {
  const router = useRouter();
  const { loading, error, requestPermission, loadAssets } = usePhotoLibrary();
  const { run } = usePipeline();

  const {
    availableAssets,
    selectedIds,
    toggleSelection,
    clearSelection,
    selectedAssets,
    selectionCount,
    isSelected,
    canSelectMore,
  } = useSelectionStore();

  useEffect(() => {
    (async () => {
      const status = await requestPermission();
      if (status === 'granted' || status === 'limited') {
        await loadAssets();
      } else {
        Alert.alert(
          'Permission Required',
          'Photo Cleanup needs access to your photo library to find duplicates.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    })();
  }, []);

  const handleAnalyze = useCallback(async () => {
    const assets = selectedAssets();
    if (assets.length < MIN_SELECTION_SIZE) {
      Alert.alert('Select more photos', `Please select at least ${MIN_SELECTION_SIZE} photos.`);
      return;
    }
    router.push('/processing');
    await run(assets);
  }, [selectedAssets, run, router]);

  const renderItem = useCallback(({ item }: { item: PhotoAsset }) => {
    const selected = isSelected(item.id);
    const disabled = !selected && !canSelectMore();

    return (
      <TouchableOpacity
        style={[styles.cell, disabled && styles.cellDisabled]}
        onPress={() => !disabled && toggleSelection(item.id)}
        activeOpacity={0.8}
        accessibilityLabel={`${selected ? 'Deselect' : 'Select'} photo ${item.filename}`}
        accessibilityState={{ selected }}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="cover"
          recyclingKey={item.id}
          cachePolicy="memory-disk"
        />
        {selected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          </View>
        )}
        {disabled && <View style={styles.disabledOverlay} />}
      </TouchableOpacity>
    );
  }, [isSelected, canSelectMore, toggleSelection]);

  const count = selectionCount();

  if (loading && availableAssets.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading photos…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {count === 0
            ? 'Tap photos to select (2–50)'
            : `${count} of ${MAX_SELECTION_SIZE} selected`}
        </Text>
        {count > 0 && (
          <TouchableOpacity onPress={clearSelection}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={availableAssets}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: CELL_SIZE + GAP,
          offset: (CELL_SIZE + GAP) * Math.floor(index / COLUMN_COUNT),
          index,
        })}
      />

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.analyzeBtn, count < MIN_SELECTION_SIZE && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={count < MIN_SELECTION_SIZE}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Analyze ${count} selected photos`}
          accessibilityState={{ disabled: count < MIN_SELECTION_SIZE }}
        >
          <Text style={styles.analyzeBtnText}>
            {count < MIN_SELECTION_SIZE
              ? `Select at least ${MIN_SELECTION_SIZE} photos`
              : `Analyze ${count} photo${count !== 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  clearText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  grid: {
    padding: GAP,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    position: 'relative',
  },
  cellDisabled: {
    opacity: 0.5,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 113, 194, 0.3)',
    borderRadius: 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 4,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: COLORS.textInverse,
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.bold,
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
  loadingText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textMuted,
  },
  errorText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.danger,
    textAlign: 'center',
    marginHorizontal: SPACING.xl,
  },
  bottomBar: {
    padding: SPACING.base,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  analyzeBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  analyzeBtnDisabled: {
    backgroundColor: COLORS.neutralMuted,
  },
  analyzeBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
