/**
 * Processing Screen
 *
 * Shows pipeline progress while analysis runs. Navigates to the
 * review screen when complete, or shows an error state if the pipeline fails.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProcessingStore } from '../store/processingStore';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, RADIUS } from '../constants';

const STAGE_LABELS: Record<string, string> = {
  idle: 'Getting ready…',
  normalizing: 'Filtering photos…',
  analyzing: 'Analyzing metadata…',
  pairing: 'Finding similar pairs…',
  clustering: 'Grouping photos…',
  ranking: 'Ranking quality…',
  'building-plan': 'Building recommendations…',
  complete: 'Done!',
  error: 'Something went wrong',
};

export default function ProcessingScreen() {
  const router = useRouter();
  const { stage, progress, message, error, result } = useProcessingStore();
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (stage === 'complete' && result) {
      const timeout = setTimeout(() => {
        router.replace('/review');
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [stage, result, router]);

  if (stage === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Analysis failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stageLabel = STAGE_LABELS[stage] ?? message;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        {/* Animated icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.analysisIcon}>
            {stage === 'complete' ? '✓' : '✦'}
          </Text>
        </View>

        <Text style={styles.title}>
          {stage === 'complete' ? 'Analysis complete' : 'Analyzing photos…'}
        </Text>

        <Text style={styles.stageLabel}>{stageLabel}</Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: animatedWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <Text style={styles.progressText}>
          {(progress * 100).toFixed(0)}%
        </Text>

        {result && stage === 'complete' && (
          <View style={styles.summaryCard}>
            <SummaryRow label="Photos analyzed" value={String(result.totalPhotosAnalyzed)} />
            <SummaryRow label="Likely-duplicate groups" value={String(result.actionableGroups)} />
            <SummaryRow label="Manual review needed" value={String(result.manualReviewGroups)} />
            <SummaryRow label="Photos eligible to delete" value={String(result.photosEligibleForDeletion)} />
          </View>
        )}

        <Text style={styles.offlineNote}>All processing happens on your device</Text>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
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
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.base,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  analysisIcon: {
    fontSize: 32,
    color: COLORS.primary,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  stageLabel: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontWeight: FONT_WEIGHTS.medium,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.base,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
  },
  offlineNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.danger,
  },
  errorMessage: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
