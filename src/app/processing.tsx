import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useProcessingStore } from '@/store/processingStore';
import { useSelectionStore } from '@/store/selectionStore';
import { useProcessing } from '@/hooks/useProcessing';
import { CleanupPipeline } from '@/domain/cleanup/pipeline';
import { MetadataThumbnailService } from '@/domain/photo/thumbnailService';
import { HeuristicSimilarityEngine } from '@/domain/similarity/similarityEngine';
import { TransitiveClusteringEngine } from '@/domain/similarity/clusteringEngine';
import { ConservativeRecommendationService } from '@/domain/recommendation/recommendationService';
import { DeletionPlanner } from '@/domain/cleanup/deletionPlanner';
import { ExpoPhotoAssetService } from '@/domain/photo/photoAssetService';

const pipelineDeps = {
  assetService: new ExpoPhotoAssetService(),
  thumbnailService: new MetadataThumbnailService(),
  similarityEngine: new HeuristicSimilarityEngine(),
  clusteringEngine: new TransitiveClusteringEngine(),
  recommendationService: new ConservativeRecommendationService(),
  deletionPlanner: new DeletionPlanner(),
};

export default function ProcessingScreen() {
  const router = useRouter();
  const { isRunning, runPipeline, cancel } = useProcessing(pipelineDeps);
  const stage = useProcessingStore((s) => s.stage);
  const progress = useProcessingStore((s) => s.progress);
  const isComplete = useProcessingStore((s) => s.isComplete);
  const error = useProcessingStore((s) => s.error);
  const selectedAssets = useSelectionStore((s) => s.getSelectedAssets());

  useEffect(() => {
    if (selectedAssets.length >= 2 && !isRunning && !isComplete) {
      runPipeline(selectedAssets);
    }
  }, [selectedAssets, isRunning, isComplete, runPipeline]);

  useEffect(() => {
    if (isComplete && !error) {
      const timer = setTimeout(() => {
        router.replace('/review');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, error, router]);

  const stageLabel = useMemo(() => {
    const labels: Record<string, string> = {
      idle: 'Preparing...',
      normalizing: 'Validating photos...',
      building_thumbnails: 'Analyzing photo details...',
      generating_candidates: 'Finding similar photos...',
      clustering: 'Grouping duplicates...',
      ranking: 'Comparing quality...',
      building_recommendations: 'Building recommendations...',
      building_plan: 'Preparing deletion plan...',
      complete: 'Done!',
    };
    return labels[stage] ?? 'Processing...';
  }, [stage]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ActivityIndicator size="large" color="#0d6efd" />
            <Text style={styles.stageLabel}>{stageLabel}</Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
            </View>

            {isComplete && !error && (
              <Text style={styles.completeText}>Opening review...</Text>
            )}

            {isRunning && !isComplete && (
              <Pressable style={styles.cancelButton} onPress={cancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 20,
  },
  stageLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#212529',
    marginTop: 8,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    minWidth: 36,
    textAlign: 'right',
  },
  completeText: {
    fontSize: 15,
    color: '#198754',
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  errorText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#0d6efd',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
