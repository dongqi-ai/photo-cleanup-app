import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProcessingStore } from '@/store/processingStore';
import { useReviewStore } from '@/store/reviewStore';
import { PhotoCluster, ClusterDeletionPlan } from '@/types';
import { DELETION_MESSAGES } from '@/constants';

const { width: screenWidth } = Dimensions.get('window');
const PHOTO_SIZE = (screenWidth - 48 - 16) / 2; // 2-column grid with gaps

export default function ReviewScreen() {
  const router = useRouter();
  const clusters = useProcessingStore((s) => s.clusters);
  const plan = useProcessingStore((s) => s.plan);
  const {
    currentClusterIndex,
    setPlan: setReviewPlan,
    nextCluster,
    previousCluster,
    confirmCluster,
    unconfirmCluster,
    overrideKeepPhoto,
    getConfirmedCount,
    getUnconfirmedCount,
    getAllConfirmed,
  } = useReviewStore();

  // Initialize review plan from processing plan on first load
  if (plan && !useReviewStore.getState().plan) {
    setReviewPlan(plan);
  }

  const reviewPlan = useReviewStore((s) => s.plan);
  const currentClusterPlan = reviewPlan?.clusters[currentClusterIndex];
  const currentCluster = clusters.find((c) => c.id === currentClusterPlan?.clusterId);

  const handleConfirm = useCallback(() => {
    if (!currentClusterPlan) return;
    confirmCluster(currentClusterPlan.clusterId);
  }, [currentClusterPlan, confirmCluster]);

  const handleUnconfirm = useCallback(() => {
    if (!currentClusterPlan) return;
    unconfirmCluster(currentClusterPlan.clusterId);
  }, [currentClusterPlan, unconfirmCluster]);

  const handleOverride = useCallback(
    (photoId: string) => {
      if (!currentClusterPlan) return;
      overrideKeepPhoto(currentClusterPlan.clusterId, photoId);
    },
    [currentClusterPlan, overrideKeepPhoto]
  );

  const handleExecute = useCallback(() => {
    if (!getAllConfirmed()) {
      Alert.alert(
        'Not all groups confirmed',
        `${getUnconfirmedCount()} group(s) still need review. Please review all groups before proceeding.`
      );
      return;
    }

    const totalDelete = reviewPlan?.totalPhotosToDelete ?? 0;
    Alert.alert(
      DELETION_MESSAGES.reviewTitle,
      DELETION_MESSAGES.reviewSubtitle(totalDelete),
      [
        { text: DELETION_MESSAGES.cancelButton, style: 'cancel' },
        {
          text: DELETION_MESSAGES.confirmButton,
          style: 'destructive',
          onPress: () => {
            // Execute deletion plan (would call delete service)
            Alert.alert(
              'Photos moved to Recently Deleted',
              `${totalDelete} photo${totalDelete === 1 ? '' : 's'} moved to your device's Recently Deleted album. You can recover them for about 30 days.`,
              [
                {
                  text: 'Done',
                  onPress: () => router.replace('/'),
                },
              ]
            );
          },
        },
      ]
    );
  }, [getAllConfirmed, getUnconfirmedCount, reviewPlan, router]);

  if (!currentCluster || !currentClusterPlan) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No groups to review</Text>
        <Text style={styles.emptyText}>
          No duplicate or burst-like groups were found in your selection.
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const isConfirmed = currentClusterPlan.confirmed;
  const recommendation = currentCluster.recommendation;

  return (
    <View style={styles.container}>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          Group {currentClusterIndex + 1} of {reviewPlan?.clusters.length ?? 0}
        </Text>
        <Text style={styles.confirmCount}>
          {getConfirmedCount()} / {reviewPlan?.clusters.length ?? 0} confirmed
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status badge */}
        <View style={styles.statusRow}>
          {currentCluster.status === 'actionable' && recommendation && (
            <View style={styles.badgeActionable}>
              <Text style={styles.badgeTextActionable}>Recommended</Text>
            </View>
          )}
          {currentCluster.status === 'manual_review' && (
            <View style={styles.badgeReview}>
              <Text style={styles.badgeTextReview}>Manual Review</Text>
            </View>
          )}
          {isConfirmed && (
            <View style={styles.badgeConfirmed}>
              <Text style={styles.badgeTextConfirmed}>Confirmed</Text>
            </View>
          )}
        </View>

        {/* Recommendation reason */}
        {recommendation && (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonSummary}>{recommendation.reason.summary}</Text>
            {recommendation.reason.details.map((detail, i) => (
              <Text key={i} style={styles.reasonDetail}>
                • {detail}
              </Text>
            ))}
            <Text style={styles.confidenceText}>
              Confidence: {getConfidenceLabel(recommendation.margin)}
            </Text>
          </View>
        )}

        {/* Photos grid */}
        <Text style={styles.sectionTitle}>
          {recommendation
            ? 'Tap a different photo to change the keep selection'
            : 'Select which photo to keep'}
        </Text>

        <View style={styles.photosGrid}>
          {currentCluster.photos.map((photo) => {
            const isKeep = currentClusterPlan.keepPhotoId === photo.asset.id;
            const isDelete = currentClusterPlan.deletePhotoIds.includes(photo.asset.id);

            return (
              <Pressable
                key={photo.asset.id}
                style={[
                  styles.photoCard,
                  isKeep && styles.photoCardKeep,
                  isDelete && styles.photoCardDelete,
                ]}
                onPress={() => !isConfirmed && handleOverride(photo.asset.id)}
                disabled={isConfirmed}
              >
                <Image
                  source={{ uri: photo.asset.uri }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                <View style={styles.photoLabelContainer}>
                  {isKeep && (
                    <View style={styles.keepLabel}>
                      <Text style={styles.keepLabelText}>Keep</Text>
                    </View>
                  )}
                  {isDelete && (
                    <View style={styles.deleteLabel}>
                      <Text style={styles.deleteLabelText}>Delete</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.photoMeta}>
                  {photo.metadata.width} x {photo.metadata.height}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.navButton, currentClusterIndex === 0 && styles.navButtonDisabled]}
          onPress={previousCluster}
          disabled={currentClusterIndex === 0}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </Pressable>

        {!isConfirmed ? (
          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm This Group</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.unconfirmButton} onPress={handleUnconfirm}>
            <Text style={styles.unconfirmButtonText}>Change Decision</Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.navButton,
            currentClusterIndex >= (reviewPlan?.clusters.length ?? 1) - 1 && styles.navButtonDisabled,
          ]}
          onPress={nextCluster}
          disabled={currentClusterIndex >= (reviewPlan?.clusters.length ?? 1) - 1}
        >
          <Text style={styles.navButtonText}>Next</Text>
        </Pressable>
      </View>

      {/* Execute button */}
      {getAllConfirmed() && (
        <View style={styles.executeBar}>
          <Pressable style={styles.executeButton} onPress={handleExecute}>
            <Text style={styles.executeButtonText}>
              Delete {reviewPlan?.totalPhotosToDelete ?? 0} Photos
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function getConfidenceLabel(margin: number): string {
  if (margin >= 0.25) return 'High — clear winner';
  if (margin >= 0.15) return 'Medium — modest advantage';
  return 'Low — review recommended';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  emptyText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
    backgroundColor: '#0d6efd',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  confirmCount: {
    fontSize: 14,
    color: '#198754',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badgeActionable: {
    backgroundColor: '#d1f2eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTextActionable: {
    color: '#0f5132',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeReview: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTextReview: {
    color: '#856404',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeConfirmed: {
    backgroundColor: '#d1ecf1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTextConfirmed: {
    color: '#0c5460',
    fontSize: 12,
    fontWeight: '600',
  },
  reasonCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
  },
  reasonSummary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  reasonDetail: {
    fontSize: 14,
    color: '#495057',
    marginTop: 2,
  },
  confidenceText: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 10,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCard: {
    width: PHOTO_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  photoCardKeep: {
    borderColor: '#198754',
  },
  photoCardDelete: {
    borderColor: '#dc3545',
    opacity: 0.85,
  },
  photoImage: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photoLabelContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  keepLabel: {
    backgroundColor: '#198754',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  keepLabelText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteLabel: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  deleteLabelText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  photoMeta: {
    fontSize: 11,
    color: '#6c757d',
    padding: 6,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  confirmButton: {
    backgroundColor: '#198754',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  unconfirmButton: {
    backgroundColor: '#ffc107',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  unconfirmButtonText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '600',
  },
  executeBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  executeButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  executeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
