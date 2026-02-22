import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import { Spacing, Typography, BorderRadius } from '../../../constants/colors';
import OnboardingLayout from '../../../components/onboarding/OnboardingLayout';
import * as Haptics from 'expo-haptics';

const BodyProfileScreen = () => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {
    onboardingData,
    updateStepData,
    goToNextStep,
    STEPS,
    canGoNext,
  } = useStreamlinedOnboarding();

  const bodyProfileData = onboardingData[STEPS.BODY_PROFILE] || {};
  const [useMetric, setUseMetric] = useState(bodyProfileData.useMetric ?? true);
  const [age, setAge] = useState(bodyProfileData.age || '');
  const [heightCm, setHeightCm] = useState(bodyProfileData.heightCm || '');
  const [heightFt, setHeightFt] = useState(bodyProfileData.heightFt || '');
  const [heightIn, setHeightIn] = useState(bodyProfileData.heightIn || '');
  const [weightKg, setWeightKg] = useState(bodyProfileData.weightKg || '');
  const [weightLbs, setWeightLbs] = useState(bodyProfileData.weightLbs || '');

  const handleSkip = useCallback(() => {
    // Skip with default values (weight is now mandatory)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateStepData(STEPS.BODY_PROFILE, {
      age: '25',
      heightCm: '170',
      heightFt: '5',
      heightIn: '7',
      weightKg: '70',
      weightLbs: '154',
      useMetric: true,
    });
    goToNextStep();
  }, [updateStepData, goToNextStep, STEPS]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const toggleUnit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newUseMetric = !useMetric;
    setUseMetric(newUseMetric);
    // Clear height values when toggling
    if (newUseMetric) {
      setHeightFt('');
      setHeightIn('');
      setWeightLbs('');
    } else {
      setHeightCm('');
      setWeightKg('');
    }
    updateStepData(STEPS.BODY_PROFILE, {
      useMetric: newUseMetric,
      heightCm: newUseMetric ? heightCm : '',
      heightFt: !newUseMetric ? heightFt : '',
      heightIn: !newUseMetric ? heightIn : '',
      weightKg: newUseMetric ? weightKg : '',
      weightLbs: !newUseMetric ? weightLbs : '',
    });
  }, [useMetric, heightCm, heightFt, heightIn, weightKg, weightLbs, STEPS, updateStepData]);

  const handleAgeChange = useCallback((text) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, '');
    setAge(numericText);
    updateStepData(STEPS.BODY_PROFILE, { age: numericText });
  }, [STEPS, updateStepData]);

  const handleHeightCmChange = useCallback((text) => {
    // Only allow numbers, max 3 digits
    const numericText = text.replace(/[^0-9]/g, '').slice(0, 3);
    setHeightCm(numericText);
    updateStepData(STEPS.BODY_PROFILE, { heightCm: numericText });
  }, [STEPS, updateStepData]);

  const handleHeightFtChange = useCallback((text) => {
    // Only allow numbers
    let numericText = text.replace(/[^0-9]/g, '');

    // Auto-format: if more than 1 digit, parse as feet + inches (e.g., "510" -> 5ft 10in)
    if (numericText.length > 1) {
      const ft = numericText.slice(0, 1);
      const inches = numericText.slice(1);

      // Validate feet (3-7)
      const parsedFt = parseInt(ft, 10);
      if (parsedFt >= 3 && parsedFt <= 7) {
        setHeightFt(ft);

        // Validate and set inches (0-11)
        const parsedInches = parseInt(inches, 10);
        if (!isNaN(parsedInches) && parsedInches >= 0 && parsedInches <= 11) {
          setHeightIn(inches);
          updateStepData(STEPS.BODY_PROFILE, { heightFt: ft, heightIn: inches });
        } else {
          // Clear inches if out of range
          setHeightIn('');
          updateStepData(STEPS.BODY_PROFILE, { heightFt: ft, heightIn: '' });
        }
        return;
      }
    }

    // Normal single-digit input
    numericText = numericText.slice(0, 1);
    setHeightFt(numericText);
    updateStepData(STEPS.BODY_PROFILE, { heightFt: numericText });
  }, [STEPS, updateStepData]);

  const handleHeightInChange = useCallback((text) => {
    // Only allow numbers, max 2 digits (max 11 inches)
    const numericText = text.replace(/[^0-9]/g, '').slice(0, 2);
    setHeightIn(numericText);
    updateStepData(STEPS.BODY_PROFILE, { heightIn: numericText });
  }, [STEPS, updateStepData]);

  const handleWeightKgChange = useCallback((text) => {
    // Allow numbers and decimal, max 6 characters
    const numericText = text.replace(/[^0-9.]/g, '').slice(0, 6);
    // Only allow one decimal point
    const parts = numericText.split('.');
    if (parts.length > 2) {
      return;
    }
    setWeightKg(numericText);
    updateStepData(STEPS.BODY_PROFILE, { weightKg: numericText });
  }, [STEPS, updateStepData]);

  const handleWeightLbsChange = useCallback((text) => {
    // Allow numbers and decimal, max 6 characters
    const numericText = text.replace(/[^0-9.]/g, '').slice(0, 6);
    // Only allow one decimal point
    const parts = numericText.split('.');
    if (parts.length > 2) {
      return;
    }
    setWeightLbs(numericText);
    updateStepData(STEPS.BODY_PROFILE, { weightLbs: numericText });
  }, [STEPS, updateStepData]);

  const handleNext = useCallback(() => {
    // Validate weight before proceeding
    const weight = useMetric ? parseFloat(weightKg) : parseFloat(weightLbs) / 2.20462;

    if (!weight || weight < 40 || weight > 200) {
      // Show alert or prevent navigation
      // For now, we'll just not proceed if weight is invalid
      return;
    }

    // Ensure data is saved before proceeding
    updateStepData(STEPS.BODY_PROFILE, {
      age,
      heightCm: useMetric ? heightCm : '',
      heightFt: !useMetric ? heightFt : '',
      heightIn: !useMetric ? heightIn : '',
      weightKg: useMetric ? weightKg : '',
      weightLbs: !useMetric ? weightLbs : '',
      useMetric,
    });
    goToNextStep();
  }, [age, heightCm, heightFt, heightIn, weightKg, weightLbs, useMetric, STEPS, updateStepData, goToNextStep]);

  const isNextDisabled = !canGoNext(STEPS.BODY_PROFILE);

  return (
    <OnboardingLayout
      title="Tell us about yourself"
      subtitle="This helps us personalize your experience"
      showBack={true}
      showSkip={true}
      showProgress={true}
      nextLabel="Continue"
      disableNext={isNextDisabled}
      onNext={handleNext}
      onSkip={handleSkip}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Age Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textMain }]}>Age</Text>
          <View
            style={[
              styles.inputContainer,
              { backgroundColor: theme.bgCard, borderColor: theme.border },
            ]}
          >
            <Ionicons name="calendar-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.textMain }]}
              placeholder="Enter your age"
              placeholderTextColor={theme.textMuted}
              value={age}
              onChangeText={handleAgeChange}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[styles.unitSuffix, { color: theme.textMuted }]}>years</Text>
          </View>
        </View>

        {/* Height Input with Unit Toggle */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textMain }]}>Height</Text>
            <TouchableOpacity
              style={[styles.unitToggle, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
              onPress={toggleUnit}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.unitToggleText,
                  { color: useMetric ? theme.primary : theme.textMuted },
                ]}
              >
                cm
              </Text>
              <View style={[styles.toggleDivider, { backgroundColor: theme.border }]} />
              <Text
                style={[
                  styles.unitToggleText,
                  { color: !useMetric ? theme.primary : theme.textMuted },
                ]}
              >
                ft/in
              </Text>
            </TouchableOpacity>
          </View>

          {useMetric ? (
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Ionicons name="resize-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textMain }]}
                placeholder="Enter height"
                placeholderTextColor={theme.textMuted}
                value={heightCm}
                onChangeText={handleHeightCmChange}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={[styles.unitSuffix, { color: theme.textMuted }]}>cm</Text>
            </View>
          ) : (
            <View style={styles.imperialContainer}>
              <View
                style={[
                  styles.inputContainer,
                  styles.imperialInput,
                  { backgroundColor: theme.bgCard, borderColor: theme.border },
                ]}
              >
                <Ionicons name="resize-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textMain }]}
                  placeholder="ft"
                  placeholderTextColor={theme.textMuted}
                  value={heightFt}
                  onChangeText={handleHeightFtChange}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={[styles.unitSuffix, { color: theme.textMuted }]}>ft</Text>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  styles.imperialInput,
                  { backgroundColor: theme.bgCard, borderColor: theme.border },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: theme.textMain }]}
                  placeholder="in"
                  placeholderTextColor={theme.textMuted}
                  value={heightIn}
                  onChangeText={handleHeightInChange}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={[styles.unitSuffix, { color: theme.textMuted }]}>in</Text>
              </View>
            </View>
          )}
        </View>

        {/* Weight Input - Required for competition */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textMain }]}>
              Weight <Text style={{ color: theme.primary }}>*</Text>
            </Text>
            <Text style={[styles.requiredHint, { color: theme.textMuted }]}>
              Required for fair competition
            </Text>
          </View>

          {useMetric ? (
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Ionicons name="fitness-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textMain }]}
                placeholder="Enter weight"
                placeholderTextColor={theme.textMuted}
                value={weightKg}
                onChangeText={handleWeightKgChange}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={[styles.unitSuffix, { color: theme.textMuted }]}>kg</Text>
            </View>
          ) : (
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Ionicons name="fitness-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textMain }]}
                placeholder="Enter weight"
                placeholderTextColor={theme.textMuted}
                value={weightLbs}
                onChangeText={handleWeightLbsChange}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={[styles.unitSuffix, { color: theme.textMuted }]}>lbs</Text>
            </View>
          )}
        </View>

        {/* Validation Hints */}
        {age.length > 0 && (parseInt(age, 10) < 13 || parseInt(age, 10) > 100) && (
          <View style={[styles.hintBox, { backgroundColor: theme.bgCard, borderColor: '#FFA500' }]}>
            <Ionicons name="warning-outline" size={18} color="#FFA500" />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              Please enter a valid age (13-100)
            </Text>
          </View>
        )}

        {useMetric && heightCm.length > 0 && (parseInt(heightCm, 10) < 100 || parseInt(heightCm, 10) > 250) && (
          <View style={[styles.hintBox, { backgroundColor: theme.bgCard, borderColor: '#FFA500' }]}>
            <Ionicons name="warning-outline" size={18} color="#FFA500" />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              Please enter a valid height (100-250 cm)
            </Text>
          </View>
        )}

        {!useMetric && (heightFt.length > 0 || heightIn.length > 0) && (
          (parseInt(heightFt, 10) < 3 || parseInt(heightFt, 10) > 7 || parseInt(heightIn || '0', 10) > 11) && (
            <View style={[styles.hintBox, { backgroundColor: theme.bgCard, borderColor: '#FFA500' }]}>
              <Ionicons name="warning-outline" size={18} color="#FFA500" />
              <Text style={[styles.hintText, { color: theme.textMuted }]}>
                Please enter a valid height (3'0" - 7'11")
              </Text>
            </View>
          )
        )}

        {useMetric && weightKg.length > 0 && (parseFloat(weightKg) < 40 || parseFloat(weightKg) > 200) && (
          <View style={[styles.hintBox, { backgroundColor: theme.bgCard, borderColor: '#FFA500' }]}>
            <Ionicons name="warning-outline" size={18} color="#FFA500" />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              Please enter a valid weight (40-200 kg)
            </Text>
          </View>
        )}

        {!useMetric && weightLbs.length > 0 && (parseFloat(weightLbs) < 88 || parseFloat(weightLbs) > 440) && (
          <View style={[styles.hintBox, { backgroundColor: theme.bgCard, borderColor: '#FFA500' }]}>
            <Ionicons name="warning-outline" size={18} color="#FFA500" />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              Please enter a valid weight (88-440 lbs)
            </Text>
          </View>
        )}

        {/* Privacy Note */}
        <View style={[styles.privacyBox, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.privacyIcon} />
          <Text style={[styles.privacyText, { color: theme.textMuted }]}>
            Your weight is required for fair competition (strength ratio ranking). This helps us match you with competitors in your weight class. You can update this anytime in your profile.
          </Text>
        </View>

        {/* Height Input Hint */}
        {!useMetric && (
          <View style={[styles.hintBox, { backgroundColor: theme.bgCard, borderColor: theme.primary }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.primary} style={styles.privacyIcon} />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              Quick entry: Type "510" in the feet field to enter 5ft 10in
            </Text>
          </View>
        )}
      </Animated.View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.body,
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  requiredHint: {
    ...Typography.bodySmall,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    backgroundColor: '#161616',
    borderRadius: 4,
    padding: Spacing.xs,
  },
  unitToggleText: {
    ...Typography.bodySmall,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  toggleDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    backgroundColor: '#161616',
    borderRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: Spacing.sm,
  },
  unitSuffix: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imperialContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  imperialInput: {
    flex: 1,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: '#161616',
  },
  hintText: {
    ...Typography.bodySmall,
    fontSize: 12,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 18,
    fontWeight: '600',
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 4,
    borderColor: '#333',
    backgroundColor: '#161616',
    marginTop: Spacing.lg,
  },
  privacyIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  privacyText: {
    ...Typography.bodySmall,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
});

export default BodyProfileScreen;
