import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    settings,
    setTimeWindow,
    setSimilarityThreshold,
    setConfidenceThreshold,
    togglePreferRecent,
    togglePreferLarger,
    toggleRequireExplicitConfirmation,
    resetToDefaults,
  } = useSettingsStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Analysis Settings</Text>

      <SettingRow
        label="Time Window"
        value={`${settings.timeWindowSeconds}s`}
        description="Photos taken within this window may be grouped as duplicates"
      />
      <View style={styles.sliderRow}>
        {[5, 10, 15, 30, 60, 120, 300].map((seconds) => (
          <Pressable
            key={seconds}
            style={[
              styles.sliderButton,
              settings.timeWindowSeconds === seconds && styles.sliderButtonActive,
            ]}
            onPress={() => setTimeWindow(seconds)}
          >
            <Text
              style={[
                styles.sliderButtonText,
                settings.timeWindowSeconds === seconds && styles.sliderButtonTextActive,
              ]}
            >
              {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
            </Text>
          </Pressable>
        ))}
      </View>

      <SettingRow
        label="Similarity Threshold"
        value={`${Math.round(settings.minSimilarityThreshold * 100)}%`}
        description="Minimum score for two photos to be considered similar"
      />
      <View style={styles.sliderRow}>
        {[0.5, 0.6, 0.7, 0.8, 0.9].map((threshold) => (
          <Pressable
            key={threshold}
            style={[
              styles.sliderButton,
              Math.abs(settings.minSimilarityThreshold - threshold) < 0.05 &&
                styles.sliderButtonActive,
            ]}
            onPress={() => setSimilarityThreshold(threshold)}
          >
            <Text
              style={[
                styles.sliderButtonText,
                Math.abs(settings.minSimilarityThreshold - threshold) < 0.05 &&
                  styles.sliderButtonTextActive,
              ]}
            >
              {Math.round(threshold * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>

      <SettingRow
        label="Confidence Threshold"
        value={`${Math.round(settings.confidenceThreshold * 100)}%`}
        description="Minimum confidence for auto-recommendations (lower = more manual review)"
      />
      <View style={styles.sliderRow}>
        {[0.5, 0.6, 0.7, 0.8, 0.9].map((threshold) => (
          <Pressable
            key={threshold}
            style={[
              styles.sliderButton,
              Math.abs(settings.confidenceThreshold - threshold) < 0.05 &&
                styles.sliderButtonActive,
            ]}
            onPress={() => setConfidenceThreshold(threshold)}
          >
            <Text
              style={[
                styles.sliderButtonText,
                Math.abs(settings.confidenceThreshold - threshold) < 0.05 &&
                  styles.sliderButtonTextActive,
              ]}
            >
              {Math.round(threshold * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Preferences</Text>

      <ToggleRow
        label="Prefer Recent"
        value={settings.preferRecent}
        onToggle={togglePreferRecent}
        description="In burst sequences, prefer the later photo"
      />

      <ToggleRow
        label="Prefer Larger File"
        value={settings.preferLarger}
        onToggle={togglePreferLarger}
        description="Favor photos with larger file sizes (often more detail)"
      />

      <ToggleRow
        label="Require Confirmation"
        value={settings.requireExplicitConfirmation}
        onToggle={toggleRequireExplicitConfirmation}
        description="Always show review screen before any deletion suggestion"
      />

      <Pressable style={styles.resetButton} onPress={resetToDefaults}>
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </Pressable>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>About</Text>
        <Text style={styles.infoText}>
          Photo Cleanup v1.0.0{'\n'}
          All processing happens on your device. No photos are uploaded to any server.{'\n\n'}
          This is an offline-first app. No account, no cloud sync, no ads, no subscriptions.
        </Text>
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingHeader}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value}</Text>
      </View>
      <Text style={styles.settingDescription}>{description}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
  description,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  description: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginTop: 8,
  },
  settingRow: {
    gap: 4,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212529',
  },
  settingValue: {
    fontSize: 15,
    color: '#0d6efd',
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  sliderRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sliderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
  },
  sliderButtonActive: {
    backgroundColor: '#0d6efd',
  },
  sliderButtonText: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '500',
  },
  sliderButtonTextActive: {
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212529',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  resetButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  infoSection: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
});
