/**
 * Home Screen
 *
 * Entry point. Shows app branding, a brief description, and the
 * "Get Started" action. Also links to Settings.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, RADIUS } from '../constants';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>✦</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open settings"
          >
            <Text style={styles.settingsBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.appName}>Photo{'\n'}Cleanup</Text>
          <Text style={styles.tagline}>
            Find likely duplicate and burst-like photos.{'\n'}
            Review, keep what matters, delete the rest.
          </Text>
        </View>

        {/* Feature cards */}
        <View style={styles.features}>
          <FeatureCard
            icon="📷"
            title="On-device only"
            description="Your photos never leave your device. No accounts, no cloud, no ads."
          />
          <FeatureCard
            icon="🔍"
            title="Smart grouping"
            description="Detects burst sequences and near-duplicates using timing and metadata."
          />
          <FeatureCard
            icon="✋"
            title="You stay in control"
            description="Review every group before anything is deleted. No auto-delete."
          />
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/picker')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Get started — select photos"
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>
          <Text style={styles.ctaNote}>
            Select 2–50 photos to analyze
          </Text>
        </View>

        {/* Platform note */}
        <View style={styles.platformNote}>
          <Text style={styles.platformNoteText}>
            {Platform.OS === 'ios'
              ? 'iOS: The system will ask you to confirm deletion in a separate dialog.'
              : 'Android: Deleted photos are permanently removed from your library.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    color: COLORS.textInverse,
  },
  settingsBtn: {
    padding: SPACING.sm,
  },
  settingsBtnText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.neutralLight,
  },
  heroSection: {
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  appName: {
    fontSize: 52,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -1.5,
    lineHeight: 56,
    marginBottom: SPACING.base,
  },
  tagline: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  features: {
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  featureIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  ctaSection: {
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: RADIUS.full,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  ctaNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  platformNote: {
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  platformNoteText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    lineHeight: 16,
  },
});
