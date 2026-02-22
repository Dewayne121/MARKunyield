import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import { Spacing, Typography } from '../../../constants/colors';
import OnboardingLayout from '../../../components/onboarding/OnboardingLayout';
import OptionCard from '../../../components/onboarding/OptionCard';
import * as Haptics from 'expo-haptics';

const TrainingAvailabilityScreen = () => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {
    onboardingData,
    updateStepData,
    goToNextStep,
    STEPS,
    FREQUENCY_OPTIONS,
  } = useStreamlinedOnboarding();

  const selectedDays = onboardingData[STEPS.TRAINING_AVAILABILITY]?.selectedDays;

  const handleSkip = useCallback(() => {
    // Skip with default option (3 days)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateStepData(STEPS.TRAINING_AVAILABILITY, { selectedDays: '3' });
    goToNextStep();
  }, [updateStepData, goToNextStep, STEPS]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Get recommended days based on experience level
  const getRecommendedDays = () => {
    const experienceId = onboardingData[STEPS.EXPERIENCE]?.selectedExperience;
    switch (experienceId) {
      case 'never':
        return '2';
      case 'beginner':
        return '3';
      case 'intermediate':
        return '4';
      case 'advanced':
        return '5';
      default:
        return '3';
    }
  };

  const recommendedDays = getRecommendedDays();

  const handleSelectDays = useCallback(
    (daysId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateStepData(STEPS.TRAINING_AVAILABILITY, { selectedDays: daysId });
      // Removed auto-advance - user must press Continue to proceed
    },
    [updateStepData, STEPS]
  );

  const getColorForDays = (daysId) => {
    const numDays = parseInt(daysId, 10);
    switch (numDays) {
      case 2:
        return '#4ECDC4';
      case 3:
        return '#45B7D1';
      case 4:
        return '#96CEB4';
      case 5:
        return '#FECA57';
      default:
        return theme.primary;
    }
  };

  const getIconForDays = (daysId) => {
    const numDays = parseInt(daysId, 10);
    switch (numDays) {
      case 2:
        return 'calendar-outline';
      case 3:
        return 'calendar-clear-outline';
      case 4:
        return 'calendar-number-outline';
      case 5:
        return 'flame-outline';
      default:
        return 'time-outline';
    }
  };

  return (
    <OnboardingLayout
      title="How many days per week?"
      subtitle="Be realistic - consistency beats intensity"
      showBack={true}
      showSkip={true}
      showProgress={true}
      nextLabel="Continue"
      disableNext={!selectedDays}
      onNext={goToNextStep}
      onSkip={handleSkip}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {FREQUENCY_OPTIONS.map((option) => (
          <OptionCard
            key={option.id}
            title={option.title}
            subtitle={option.subtitle}
            description={option.description}
            icon={getIconForDays(option.id)}
            color={getColorForDays(option.id)}
            selected={selectedDays === option.id}
            onPress={() => handleSelectDays(option.id)}
            recommended={option.id === recommendedDays}
          />
        ))}

        {/* Context Box */}
        <View style={[styles.contextBox, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Text style={[styles.contextBoxTitle, { color: theme.textMain }]}>
            Finding your sweet spot
          </Text>
          <Text style={[styles.contextBoxText, { color: theme.textMuted }]}>
            {selectedDays === '2' &&
              '2 days is perfect for building the habit. You can always add more later.'}
            {selectedDays === '3' &&
              '3 days provides great results while allowing for proper recovery.'}
            {selectedDays === '4' &&
              '4 days allows for more targeted training while maintaining life balance.'}
            {selectedDays === '5' &&
              '5+ days is for serious athletes. Make sure you can recover properly.'}
            {!selectedDays &&
              'Choose a frequency you can stick with consistently. It\'s better to start conservatively.'}
          </Text>
        </View>
      </Animated.View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  contextBox: {
    padding: Spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 4,
    borderColor: '#333',
    backgroundColor: '#161616',
    marginTop: Spacing.md,
  },
  contextBoxTitle: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  contextBoxText: {
    ...Typography.bodySmall,
    fontSize: 13,
    lineHeight: 20,
  },
});

export default TrainingAvailabilityScreen;
