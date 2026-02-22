import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import { Spacing, Typography } from '../../../constants/colors';
import OnboardingLayout from '../../../components/onboarding/OnboardingLayout';
import OptionCard from '../../../components/onboarding/OptionCard';
import * as Haptics from 'expo-haptics';

const ExperienceLevelScreen = () => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {
    onboardingData,
    updateStepData,
    goToNextStep,
    STEPS,
    EXPERIENCE_OPTIONS,
  } = useStreamlinedOnboarding();

  const selectedExperience = onboardingData[STEPS.EXPERIENCE]?.selectedExperience;

  const handleSkip = useCallback(() => {
    // Skip with a default option
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateStepData(STEPS.EXPERIENCE, { selectedExperience: 'beginner' });
    goToNextStep();
  }, [updateStepData, goToNextStep, STEPS]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleSelectExperience = useCallback(
    (experienceId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateStepData(STEPS.EXPERIENCE, { selectedExperience: experienceId });
      // Removed auto-advance - user must press Continue to proceed
    },
    [updateStepData, STEPS]
  );

  // Get icons for each level
  const getIconForLevel = (level) => {
    switch (level) {
      case 'beginner':
        return 'leaf-outline';
      case 'intermediate':
        return 'trending-up-outline';
      case 'advanced':
        return 'fitness-outline';
      default:
        return 'sparkles-outline';
    }
  };

  // Get color for each level
  const getColorForLevel = (level) => {
    switch (level) {
      case 'beginner':
        return '#4ECDC4';
      case 'intermediate':
        return '#45B7D1';
      case 'advanced':
        return '#F38181';
      default:
        return '#95E1D3';
    }
  };

  // Mark recommended option based on previous selection
  const getRecommended = (experienceId) => {
    // If user selected "consistency" or "weight_loss", recommend beginner
    // If user selected "strength" or "muscle", recommend intermediate
    const goalId = onboardingData[STEPS.GOAL]?.selectedGoal;
    if (goalId === 'consistency' || goalId === 'weight_loss') {
      return experienceId === 'beginner' || experienceId === 'never';
    }
    return experienceId === 'beginner';
  };

  return (
    <OnboardingLayout
      title="How experienced are you?"
      subtitle="This helps us set the right starting difficulty"
      showBack={true}
      showSkip={true}
      showProgress={true}
      nextLabel="Continue"
      disableNext={!selectedExperience}
      onNext={goToNextStep}
      onSkip={handleSkip}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {EXPERIENCE_OPTIONS.map((experience) => (
          <OptionCard
            key={experience.id}
            title={experience.title}
            subtitle={experience.description}
            description={
              experience.level === 'beginner'
                ? `${experience.recommendedDays} days/week • ${experience.sessionLength}min sessions`
                : experience.level === 'intermediate'
                ? `${experience.recommendedDays} days/week • ${experience.sessionLength}min sessions`
                : `${experience.recommendedDays} days/week • ${experience.sessionLength}min sessions`
            }
            icon={getIconForLevel(experience.level)}
            color={getColorForLevel(experience.level)}
            selected={selectedExperience === experience.id}
            onPress={() => handleSelectExperience(experience.id)}
            recommended={getRecommended(experience.id)}
          />
        ))}

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Text style={[styles.infoBoxTitle, { color: theme.textMain }]}>Why this matters</Text>
          <Text style={[styles.infoBoxText, { color: theme.textMuted }]}>
            Your experience level helps us select the right exercises, starting weights, and
            progression rate for your plan.
          </Text>
        </View>
      </Animated.View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  infoBox: {
    padding: Spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 4,
    borderColor: '#333',
    backgroundColor: '#161616',
    marginTop: Spacing.md,
  },
  infoBoxTitle: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  infoBoxText: {
    ...Typography.bodySmall,
    fontSize: 13,
    lineHeight: 20,
  },
});

export default ExperienceLevelScreen;
