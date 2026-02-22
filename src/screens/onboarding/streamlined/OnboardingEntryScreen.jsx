import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import { Spacing, BorderRadius, Typography } from '../../../constants/colors';
import * as Haptics from 'expo-haptics';

// Import Unyield logo
const UnyieldLogo = require('../../../../assets/logo.png');

const OnboardingEntryScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme, skin } = useTheme();
  const { setOnboardingComplete } = useAuth();
  const { updateStepData, goToNextStep, completeOnboarding, STEPS } = useStreamlinedOnboarding();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim1 = useRef(new Animated.Value(30)).current;
  const slideAnim2 = useRef(new Animated.Value(30)).current;
  const slideAnim3 = useRef(new Animated.Value(30)).current;
  const slideAnim4 = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.stagger(100, [
        Animated.timing(slideAnim1, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim2, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim3, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim4, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleGetStarted = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateStepData(STEPS.ENTRY, { isGuest: true });
    goToNextStep();
  }, [updateStepData, goToNextStep, STEPS]);

  const handleSkipForNow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Skip onboarding and complete it - user can do it later
    completeOnboarding();
    // Update AuthContext to trigger navigation to Main screen
    await setOnboardingComplete();
  }, [completeOnboarding, setOnboardingComplete]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bgDeep }]}>
      {/* Background gradient overlay */}
      <LinearGradient
        colors={['rgba(155, 44, 44, 0.15)', 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <Animated.View
          style={[styles.heroSection, { paddingTop: insets.top + Spacing.xxl, opacity: fadeAnim }]}
        >
          {/* Logo */}
          <Animated.View
            style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim1 }] }]}
          >
            <Image
              source={UnyieldLogo}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={[styles.titleContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim2 }] }]}
          >
            <Text style={[styles.heroTitle, { color: theme.textMain }]}>
              Build Your{'\n'}Legacy
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>
              Compete. Track. Improve.
            </Text>
          </Animated.View>

          {/* Feature Pills */}
          <Animated.View
            style={[styles.featuresContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim3 }] }]}
          >
            <View style={[styles.featurePill, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Ionicons name="trophy" size={16} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textMain }]}>Compete on Leaderboards</Text>
            </View>
            <View style={[styles.featurePill, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Ionicons name="stats-chart" size={16} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textMain }]}>Track Your Progress</Text>
            </View>
            <View style={[styles.featurePill, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Ionicons name="flash" size={16} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.textMain }]}>Earn Real Rewards</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* CTA Section */}
        <Animated.View
          style={[styles.ctaSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim4 }] }]}
        >
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleGetStarted}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[theme.primary + 'cc', theme.primary]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={handleSkipForNow}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textMain }]}>
              I'll do this later
            </Text>
          </TouchableOpacity>

          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    paddingBottom: Spacing.xxxl,
  },
  logoContainer: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heroTitle: {
    ...Typography.display,
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 52,
    letterSpacing: -1,
  },
  heroSubtitle: {
    ...Typography.h4,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    backgroundColor: '#161616',
    gap: Spacing.xs,
  },
  featureText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    fontSize: 13,
  },
  ctaSection: {
    gap: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 4,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    backgroundColor: '#161616',
  },
  secondaryButtonText: {
    ...Typography.body,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  disclaimerText: {
    ...Typography.caption,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    lineHeight: 16,
  },
});

export default OnboardingEntryScreen;
