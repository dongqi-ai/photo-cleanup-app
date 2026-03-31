/**
 * Review Screen
 *
 * The main review flow. Shows each group with:
 *   - Thumbnails of all photos in the group
 *   - The recommended keep (if confidence is high enough)
 *   - Quality signals for each photo
 *   - Accept/override/skip controls
 *   - Navigation to deletion confirmation
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReviewStore } from '../store/reviewStore';
import { useProcessingStore } from '../store/processingStore';
import { useDeletion } from '../hooks/useDeletion';
import { buildDeletionPlan, allItemsConfirmed, confirmAllItems } from '../domain/cleanup/DeletionPlanner';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, RADIUS } from '../constants';
import { formatFileSize, formatResolution, formatConfidence } from '../lib/utils/formatters';
import type { PhotoGroup, PhotoAsset } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.md * 2) / 3;

export default function ReviewScreen() {
  const router = useRouter();
  const { groups, deletionPlan, allGroupsReviewed, reviewedCount, totalActionableGroups, setDeletionPlan } = useReviewStore();
  const { result } = useProcessingStore();
  const { executing, executePlan } = useDeletion();

  const actionableGroups = useMemo(
    () => groups.filter(g => g.status === 'actionable' || g.status === 'manual-review'),
    [groups],
  );

  const handleProceedToDeletion = useCallback(async () => {
    // Rebuild deletion plan from current review state
    const assetFilenameMap: Record<string, string> = {};
    const assetUriMap: Record<string, string> = {};

    // Build asset maps from groups
    for (const group of groups) {
      for (const assetId of group.assetIds) {
        assetFilenameMap[assetId] = assetId;
        assetUriMap[assetId] = '';
      }
    }

    const plan = buildDeletionPlan(groups, assetFilenameMap, assetUriMap);
    const confirmedPlan = confirmAllItems(plan);
    setDeletionPlan(confirmedPlan);

    if (confirmedPlan.items.length === 0) {
      Alert.alert('Nothing to delete', 'No photos have been marked for deletion.');
      return;
    }

    Alert.alert(
      'Confirm Deletion',
      `You are about to delete ${confirmedPlan.items.length} photo${confirmedPlan.items.length !== 1 ? 's' : ''}.\n\nThis cannot be undone. ${'\n\n'}On iOS, the system will ask you to confirm each deletion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${confirmedPlan.items.length} photo${confirmedPlan.items.length !== 1 ? 's' : ''}`,
          style: 'destructive',
          onPress: async () => {
            await executePlan();
            Alert.alert(
              'Deletion complete',
              'Photos have been sent to the deletion queue. You may need to confirm in your Photos app.',
              [{ text: 'Done', onPress: () => router.push('/') }],
            );
          },
        },
      ],
    );
  }, [groups, setDeletionPlan, executePlan, router]);

  if (!result || actionableGroups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>No duplicates found</Text>
          <Text style={styles.emptyDescription}>
            No likely duplicate or burst-like groups were detected in the photos you selected.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/picker')}>
            <Text style={styles.secondaryBtnText}>Try with more photos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const reviewed = reviewedCount();
  const total = totalActionableGroups();
  const allDone = allGroupsReviewed();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          {reviewed} of {total} group{total !== 1 ? 's' : ''} reviewed
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${total > 0 ? (reviewed / total) * 100 : 0}%` }]} />
        </View>
      </View>

      <FlatList
        data={actionableGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroupCard group={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {!allDone && (
          <Text style={styles.bottomNote}>
            Review all groups before deleting
          </Text>
        )}
        <TouchableOpacity
          style={[styles.deleteBtn, (!allDone || executing) && styles.deleteBtnDisabled]}
          onPress={handleProceedToDeletion}
          disabled={!allDone || executing}
          activeOpacity={0.85}
        >
          <Text style={styles.deleteBtnText}>
            {executing ? 'Deleting…' : 'Review & Delete Selected'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── GroupCard ──────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: PhotoGroup }) {
  const { setKeep, acceptRecommendation, markReviewed } = useReviewStore();

  const isManualReview = group.status === 'manual-review';
  const keepId = group.userKeepId ?? group.recommendedKeepId;

  const statusColor = isManualReview ? COLORS.warning : COLORS.success;
  const statusText = isManualReview ? 'Manual review' : 'Recommended keep identified';

  return (
    <View style={styles.groupCard}>
      {/* Group header */}
      <View style={styles.groupHeader}>
        <View style={[styles.statusBadge, { backgroundColor: isManualReview ? COLORS.warningLight : COLORS.successLight }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {isManualReview ? '⚠ Review' : '✓ Actionable'}
          </Text>
        </View>
        {group.reviewed && (
          <View style={styles.reviewedBadge}>
            <Text style={styles.reviewedBadgeText}>Reviewed</Text>
          </View>
        )}
      </View>

      {/* Group reason */}
      <Text style={styles.groupReason}>{group.groupReason}</Text>

      {/* Confidence */}
      {!isManualReview && (
        <Text style={styles.confidenceText}>
          Confidence: {formatConfidence(group.confidence)}
        </Text>
      )}
      {isManualReview && (
        <Text style={styles.manualReviewNote}>
          Quality scores are too similar to auto-recommend. Please select which photo to keep.
        </Text>
      )}

      {/* Keep reason */}
      {group.keepReason && (
        <Text style={styles.keepReason}>{group.keepReason}</Text>
      )}

      {/* Photos grid */}
      <View style={styles.photosRow}>
        {group.assetIds.map((assetId, index) => {
          const isRecommended = assetId === group.recommendedKeepId;
          const isKept = assetId === keepId;
          const isUserMarkedKeep = assetId === group.userKeepId;
          const signals = group.qualitySignals[assetId];

          return (
            <PhotoTile
              key={assetId}
              assetId={assetId}
              isRecommendedKeep={isRecommended}
              isCurrentKeep={isKept}
              isUserMarked={isUserMarkedKeep}
              rank={index}
              qualityScore={signals?.compositeScore ?? 0}
              onSelectKeep={() => setKeep(group.id, assetId)}
            />
          );
        })}
      </View>

      {/* Action buttons */}
      <View style={styles.groupActions}>
        {!isManualReview && group.recommendedKeepId && (
          <TouchableOpacity
            style={[styles.acceptBtn, group.reviewed && styles.acceptBtnActive]}
            onPress={() => acceptRecommendation(group.id)}
          >
            <Text style={[styles.acceptBtnText, group.reviewed && styles.acceptBtnTextActive]}>
              {group.reviewed ? '✓ Accepted' : 'Accept recommendation'}
            </Text>
          </TouchableOpacity>
        )}
        {isManualReview && !group.reviewed && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => markReviewed(group.id)}
          >
            <Text style={styles.skipBtnText}>Skip this group</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── PhotoTile ──────────────────────────────────────────────────────────────

interface PhotoTileProps {
  assetId: string;
  isRecommendedKeep: boolean;
  isCurrentKeep: boolean;
  isUserMarked: boolean;
  rank: number;
  qualityScore: number;
  onSelectKeep: () => void;
}

function PhotoTile({
  assetId,
  isRecommendedKeep,
  isCurrentKeep,
  rank,
  qualityScore,
  onSelectKeep,
}: PhotoTileProps) {
  // In a real app, we'd look up the URI from the asset store
  // For now we just show a placeholder with the ID
  return (
    <TouchableOpacity
      style={[styles.photoTile, isCurrentKeep && styles.photoTileKeep]}
      onPress={onSelectKeep}
      activeOpacity={0.8}
      accessibilityLabel={`Photo ${rank + 1}. ${isCurrentKeep ? 'Selected as keep.' : 'Tap to keep this photo.'}`}
    >
      <View style={styles.photoPlaceholder}>
        <Text style={styles.photoPlaceholderRank}>#{rank + 1}</Text>
        <Text style={styles.photoPlaceholderScore}>
          {(qualityScore * 100).toFixed(0)}
        </Text>
      </View>

      {isRecommendedKeep && !isCurrentKeep && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedBadgeText}>★</Text>
        </View>
      )}
      {isCurrentKeep && (
        <View style={styles.keepBadge}>
          <Text style={styles.keepBadgeText}>Keep</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.base,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressHeader: {
    padding: SPACING.base,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  list: {
    padding: SPACING.base,
  },
  separator: {
    height: SPACING.md,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  reviewedBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
  },
  reviewedBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
  },
  groupReason: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  confidenceText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  manualReviewNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    lineHeight: 16,
    backgroundColor: COLORS.warningLight,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  keepReason: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  photosRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  photoTile: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoTileKeep: {
    borderColor: COLORS.success,
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderRank: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textMuted,
  },
  photoPlaceholderScore: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedBadgeText: {
    fontSize: 10,
    color: COLORS.textInverse,
  },
  keepBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  keepBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textInverse,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  groupActions: {
    marginTop: SPACING.xs,
  },
  acceptBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  acceptBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  acceptBtnText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  acceptBtnTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  skipBtn: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  secondaryBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  bottomBar: {
    padding: SPACING.base,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  bottomNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  deleteBtn: {
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    backgroundColor: COLORS.neutralMuted,
  },
  deleteBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
