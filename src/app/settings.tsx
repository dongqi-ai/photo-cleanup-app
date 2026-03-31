/**
 * Settings Screen
 *
 * Exposes tunable pipeline parameters and informational details
 * about what the app does and doesn't do.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '../store/settingsStore';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, RADIUS, APP_VERSION } from '../constants';

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();

  const handleReset = () => {
    Alert.alert(
      'Reset settings',
      'All settings will be restored to defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetSettings },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Pipeline tunables */}
        <SectionHeader title="Analysis Settings" />

        <SettingCard>
          <SettingRow
            label="Similarity threshold"
            description={`Minimum similarity score to group photos (${(settings.similarityThreshold * 100).toFixed(0)}%). Higher = more conservative grouping.`}
            value={`${(settings.similarityThreshold * 100).toFixed(0)}%`}
          />
          <SliderRow
            value={settings.similarityThreshold}
            min={0.50}
            max={0.85}
            step={0.05}
            onChange={(v) => updateSettings({ similarityThreshold: v })}
          />
        </SettingCard>

        <SettingCard>
          <SettingRow
            label="Recommendation confidence"
            description={`Minimum confidence to auto-recommend a keep (${(settings.recommendationConfidenceThreshold * 100).toFixed(0)}%). Below this, groups go to manual review.`}
            value={`${(settings.recommendationConfidenceThreshold * 100).toFixed(0)}%`}
          />
          <SliderRow
            value={settings.recommendationConfidenceThreshold}
            min={0.50}
            max={0.95}
            step={0.05}
            onChange={(v) => updateSettings({ recommendationConfidenceThreshold: v })}
          />
        </SettingCard>

        <SettingCard>
          <SettingRow
            label="Burst window"
            description={`Photos taken within ${settings.burstWindowSeconds}s of each other are burst candidates.`}
            value={`${settings.burstWindowSeconds}s`}
          />
          <SliderRow
            value={settings.burstWindowSeconds}
            min={3}
            max={30}
            step={1}
            onChange={(v) => updateSettings({ burstWindowSeconds: v })}
          />
        </SettingCard>

        <SettingCard>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.settingLabel}>Show debug signals</Text>
              <Text style={styles.settingDescription}>
                Display raw quality scores in the review screen.
              </Text>
            </View>
            <Switch
              value={settings.showDebugSignals}
              onValueChange={(v) => updateSettings({ showDebugSignals: v })}
              trackColor={{ true: COLORS.primary, false: COLORS.borderLight }}
              thumbColor={COLORS.textInverse}
            />
          </View>
        </SettingCard>

        {/* About */}
        <SectionHeader title="About" />

        <SettingCard>
          <InfoRow label="Version" value={APP_VERSION} />
          <InfoRow label="Algorithm" value="Metadata heuristics (MVP)" />
          <InfoRow label="ML adapter" value="Not yet integrated" />
          <InfoRow label="Network" value="None — fully offline" />
          <InfoRow label="Accounts" value="None" />
          <InfoRow label="Analytics" value="None" />
        </SettingCard>

        <SettingCard>
          <Text style={styles.aboutText}>
            Photo Cleanup uses timing, filename patterns, and file metadata to detect
            likely duplicate and burst-like photos. No image pixels are analyzed in
            this MVP — a native TFLite embedding adapter is planned for a future version.
          </Text>
        </SettingCard>

        {/* Privacy */}
        <SectionHeader title="Privacy" />
        <SettingCard>
          <Text style={styles.aboutText}>
            All photo analysis happens entirely on your device. No data is sent to
            any server. No accounts, no cloud sync, no ads.
            {'\n\n'}
            The app only accesses photos you explicitly select. Deletion requires
            your explicit review and confirmation before any photo is removed.
          </Text>
        </SettingCard>

        {/* Reset */}
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>Reset all settings</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Photo Cleanup v{APP_VERSION}</Text>
          <Text style={styles.footerText}>Built for offline use. No backend.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SettingRow({ label, description, value }: { label: string; description: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLabelGroup}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

interface SliderRowProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderRow({ value, min, max, step, onChange }: SliderRowProps) {
  const decrease = () => {
    const next = Math.max(min, parseFloat((value - step).toFixed(2)));
    onChange(next);
  };
  const increase = () => {
    const next = Math.min(max, parseFloat((value + step).toFixed(2)));
    onChange(next);
  };

  return (
    <View style={styles.sliderRow}>
      <TouchableOpacity style={styles.sliderBtn} onPress={decrease}>
        <Text style={styles.sliderBtnText}>−</Text>
      </TouchableOpacity>
      <View style={styles.sliderTrack}>
        <View
          style={[
            styles.sliderFill,
            { width: `${((value - min) / (max - min)) * 100}%` },
          ]}
        />
      </View>
      <TouchableOpacity style={styles.sliderBtn} onPress={increase}>
        <Text style={styles.sliderBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.base,
    gap: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  sectionHeader: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  settingLabelGroup: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textPrimary,
  },
  settingDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  settingValue: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.primary,
    minWidth: 48,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  switchLabel: {
    flex: 1,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sliderBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 24,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontWeight: FONT_WEIGHTS.medium,
  },
  aboutText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  resetBtn: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.danger,
    fontWeight: FONT_WEIGHTS.medium,
  },
  footer: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
});
