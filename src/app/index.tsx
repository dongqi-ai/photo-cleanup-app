import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelectionStore } from '@/store/selectionStore';
import { useProcessingStore } from '@/store/processingStore';
import { APP_NAME, APP_TAGLINE } from '@/constants';

export default function HomeScreen() {
  const router = useRouter();
  const selectedCount = useSelectionStore((s) => s.selectedIds.size);
  const processingComplete = useProcessingStore((s) => s.isComplete);
  const actionableCount = useProcessingStore((s) => s.getActionableClusters().length);
  const manualReviewCount = useProcessingStore((s) => s.getManualReviewClusters().length);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>{APP_TAGLINE}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        <View style={styles.steps}>
          <Step number={1} text="Select 20-50 photos from your library" />
          <Step number={2} text="We group likely duplicates and burst shots" />
          <Step number={3} text="Review recommendations and confirm deletions" />
        </View>
        <Text style={styles.privacyNote}>
          All processing happens on your device. No photos are uploaded.
        </Text>
      </View>

      {selectedCount > 0 && (
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            {selectedCount} photo{selectedCount === 1 ? '' : 's'} selected
          </Text>
        </View>
      )}

      {processingComplete && (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Analysis Results</Text>
          <Text style={styles.resultsText}>
            {actionableCount} group{actionableCount === 1 ? '' : 's'} with recommendations
          </Text>
          {manualReviewCount > 0 && (
            <Text style={styles.resultsText}>
              {manualReviewCount} group{manualReviewCount === 1 ? '' : 's'} need manual review
            </Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/picker')}
        >
          <Text style={styles.primaryButtonText}>
            {selectedCount > 0 ? 'Change Selection' : 'Select Photos'}
          </Text>
        </Pressable>

        {selectedCount >= 2 && !processingComplete && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/processing')}
          >
            <Text style={styles.secondaryButtonText}>Analyze Photos</Text>
          </Pressable>
        )}

        {processingComplete && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/review')}
          >
            <Text style={styles.secondaryButtonText}>Review Results</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.tertiaryButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.tertiaryButtonText}>Settings</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  steps: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0d6efd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 15,
    color: '#495057',
    flex: 1,
  },
  privacyNote: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 16,
    fontStyle: 'italic',
  },
  statusCard: {
    backgroundColor: '#e7f3ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0d6efd',
  },
  resultsCard: {
    backgroundColor: '#e7f3ff',
    borderRadius: 12,
    padding: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#495057',
    marginTop: 2,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#0d6efd',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#212529',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: '#6c757d',
    fontSize: 15,
    fontWeight: '500',
  },
});
