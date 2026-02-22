import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, BorderRadius, Typography } from '../../constants/colors';
import { useStreamlinedOnboarding } from '../../context/StreamlinedOnboardingContext';

const OnboardingLayout = ({
  children,
  title,
  subtitle,
  showBack = true,
  showSkip = false,
  showProgress = true,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Continue',
  backLabel,
  disableNext = false,
  loading = false,
  safeAreaEnabled = true,
  keyboardBehavior = 'padding',
  footerContent,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { getStepProgress, goToPreviousStep } = useStreamlinedOnboarding();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const progress = getStepProgress();
  const canShowBack = showBack && progress.current > 1;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goToPreviousStep();
    }
  };

  const handleNext = () => {
    if (!disableNext && !loading && onNext) {
      onNext();
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const content = (
    <>
      {/* Progress Bar */}
      {showProgress && (
        <View style={[styles.progressBarContainer, { paddingTop: insets.top + Spacing.lg, marginTop: Spacing.xs }]}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress.percentage}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            >
              <LinearGradient
                colors={[theme.primary, theme.primary + 'cc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>
          <Text style={[styles.progressText, { color: theme.textMuted }]}>
            {progress.current} of {progress.total}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {canShowBack ? (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.border }]}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={theme.textMain} />
              <Text style={[styles.backButtonText, { color: theme.textMain }]}>
                {backLabel || 'Back'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonSpacer} />
          )}

          {showSkip && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipButtonText, { color: theme.textMuted }]}>
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {title && (
          <Animated.View style={[styles.titleContainer, { opacity: fadeAnim }]}>
            <Text style={[styles.title, { color: theme.textMain }]}>{title}</Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
            )}
          </Animated.View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeAreaEnabled ? insets.bottom + Spacing.xxl : Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>{children}</View>
      </ScrollView>

      {/* Footer with Next Button or Custom Footer Content */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: safeAreaEnabled ? insets.bottom + Spacing.md : Spacing.md,
            borderTopColor: theme.border,
          },
        ]}
      >
        {footerContent ? (
          // Custom footer content (e.g., ProfileSetupScreen's custom Continue button)
          footerContent
        ) : (
          // Default footer with Next button
          <>
            <TouchableOpacity
              style={[
                styles.nextButton,
                {
                  backgroundColor: disableNext ? theme.bgCard : theme.primary,
                  opacity: disableNext ? 0.5 : 1,
                },
              ]}
              onPress={handleNext}
              activeOpacity={0.8}
              disabled={disableNext || loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={[styles.nextButtonText, { color: theme.textMuted }]}>Loading...</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.nextButtonText, { color: disableNext ? theme.textMuted : '#fff' }]}>
                    {nextLabel}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={disableNext ? theme.textMuted : '#fff'}
                  />
                </>
              )}
            </TouchableOpacity>

            {progress.current < progress.total && showSkip && onSkip && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={[styles.laterButtonText, { color: theme.textMuted }]}>
                  I'll do this later
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </>
  );

  if (safeAreaEnabled) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.container, { backgroundColor: theme.bgDeep }]}>
          {content}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgDeep }]}>{content}</View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBarContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: '#333',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: Spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingRight: Spacing.md,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    backgroundColor: '#161616',
  },
  backButtonText: {
    ...Typography.body,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  backButtonSpacer: {
    width: 80,
  },
  skipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    ...Typography.body,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  titleContainer: {
    marginTop: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    marginTop: Spacing.xs,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 4,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  nextButtonText: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  laterButtonText: {
    ...Typography.bodySmall,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
});

export default OnboardingLayout;
