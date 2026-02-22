import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import { Spacing, Typography } from '../../../constants/colors';
import OnboardingLayout from '../../../components/onboarding/OnboardingLayout';
import OptionCard from '../../../components/onboarding/OptionCard';
import * as Haptics from 'expo-haptics';

const GoalSelectionScreen = () => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {
    onboardingData,
    updateStepData,
    goToNextStep,
    STEPS,
    GOAL_OPTIONS,
  } = useStreamlinedOnboarding();

  const selectedGoal = onboardingData[STEPS.GOAL]?.selectedGoal;

  const handleSkip = useCallback(() => {
    // Skip with a default option
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateStepData(STEPS.GOAL, { selectedGoal: 'consistency' });
    goToNextStep();
  }, [updateStepData, goToNextStep, STEPS]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleSelectGoal = useCallback(
    (goalId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateStepData(STEPS.GOAL, { selectedGoal: goalId });
      // Removed auto-advance - user must press Continue to proceed
    },
    [updateStepData, STEPS]
  );

  return (
    <OnboardingLayout
      title="What's your main goal?"
      subtitle="Select the option that best describes what you want to achieve"
      showBack={true}
      showSkip={true}
      showProgress={true}
      nextLabel="Continue"
      disableNext={!selectedGoal}
      onNext={goToNextStep}
      onSkip={handleSkip}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {GOAL_OPTIONS.map((goal, index) => (
          <OptionCard
            key={goal.id}
            title={goal.title}
            description={goal.description}
            icon={goal.icon}
            color={goal.color}
            selected={selectedGoal === goal.id}
            onPress={() => handleSelectGoal(goal.id)}
          />
        ))}

        {/* Tip */}
        <View style={[styles.tipContainer, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={[styles.tipIconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Text style={styles.tipIcon}>💡</Text>
          </View>
          <View style={styles.tipContent}>
            <Text style={[styles.tipTitle, { color: theme.textMain }]}>You can change this later</Text>
            <Text style={[styles.tipText, { color: theme.textMuted }]}>
              Your goals can evolve, and so can your plan
            </Text>
          </View>
        </View>
      </Animated.View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 4,
    borderColor: '#333',
    backgroundColor: '#161616',
    marginTop: Spacing.md,
  },
  tipIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tipText: {
    ...Typography.bodySmall,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default GoalSelectionScreen;
