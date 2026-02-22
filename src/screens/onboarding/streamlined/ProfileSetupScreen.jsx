import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Animated, Platform, ActionSheetIOS } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import OnboardingLayout from '../../../components/onboarding/OnboardingLayout';
import { Spacing, BorderRadius, Typography } from '../../../constants/colors';
import * as Haptics from 'expo-haptics';
import CustomAlert, { useCustomAlert } from '../../../components/CustomAlert';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zack',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Molly',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
];

const ProfileSetupScreen = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { updateStepData, goToNextStep, goToPreviousStep, onboardingData, STEPS, canGoNext } = useStreamlinedOnboarding();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const [displayName, setDisplayName] = useState(onboardingData[STEPS.PROFILE]?.displayName || user?.username || '');
  const [profileImage, setProfileImage] = useState(onboardingData[STEPS.PROFILE]?.profileImage || null);
  const [selectedAvatarIndex, setSelectedAvatarIndex] = useState(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Update context when values change
  useEffect(() => {
    const finalImage = profileImage || (selectedAvatarIndex !== null ? DEFAULT_AVATARS[selectedAvatarIndex] : null);
    updateStepData(STEPS.PROFILE, { displayName, profileImage: finalImage });
  }, [displayName, profileImage, selectedAvatarIndex]);

  const isValid = displayName.trim().length >= 2;

  const handleContinue = useCallback(() => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    goToNextStep();
  }, [isValid, goToNextStep]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToPreviousStep();
  }, [goToPreviousStep]);

  const handleImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          if (buttonIndex === 2) handleChooseFromLibrary();
          if (buttonIndex === 3) handleRemovePhoto();
        }
      );
    } else {
      showAlert({
        title: 'Profile Photo',
        message: 'Choose an option',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Library', onPress: handleChooseFromLibrary },
          { text: 'Remove Photo', style: 'destructive', onPress: handleRemovePhoto },
        ]
      });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission needed',
          message: 'Camera permission is required to take a photo',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfileImage(base64Image);
        setSelectedAvatarIndex(null);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to take photo',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission needed',
          message: 'Photo library permission is required',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfileImage(base64Image);
        setSelectedAvatarIndex(null);
      }
    } catch (error) {
      console.error('Error choosing photo:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to choose photo',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const handleRemovePhoto = () => {
    setProfileImage(null);
    setSelectedAvatarIndex(null);
  };

  const handleSelectAvatar = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProfileImage(null);
    setSelectedAvatarIndex(index);
  };

  return (
    <>
      <OnboardingLayout
      title="Set Up Your Profile"
      subtitle="How should we call you?"
      showProgress={true}
      showBackButton={true}
      onBack={handleBack}
      footerContent={
        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: theme.primary },
            !isValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
          activeOpacity={0.85}
        >
          <Text style={[styles.continueButtonText, { color: '#fff' }]}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      }
    >
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            onPress={handleImagePicker}
            style={styles.photoContainer}
            activeOpacity={0.8}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.photo} />
            ) : selectedAvatarIndex !== null ? (
              <Image source={{ uri: DEFAULT_AVATARS[selectedAvatarIndex] }} style={styles.photo} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Ionicons name="camera-outline" size={32} color={theme.textMuted} />
              </View>
            )}
            <View style={[styles.photoEditButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="pencil" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Default Avatars */}
          <Text style={[styles.avatarsTitle, { color: theme.textMuted }]}>Or pick an avatar</Text>
          <View style={styles.avatarsContainer}>
            {DEFAULT_AVATARS.map((avatar, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSelectAvatar(index)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.avatarWrapper,
                    { borderColor: theme.border },
                    selectedAvatarIndex === index && { borderColor: theme.primary, borderWidth: 3 },
                  ]}
                >
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Display Name Input */}
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: theme.textMain }]}>Display Name</Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: theme.bgCard, borderColor: theme.border },
              displayName.length > 0 && !isValid && { borderColor: theme.danger },
            ]}
          >
            <Ionicons name="person-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.textMain }]}
              placeholder="Enter your display name"
              placeholderTextColor={theme.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={30}
            />
            {displayName.length > 0 && (
              <Text style={[styles.charCount, { color: theme.textMuted }]}>
                {displayName.length}/30
              </Text>
            )}
          </View>
          {displayName.length > 0 && !isValid && (
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              At least 2 characters required
            </Text>
          )}
        </View>

        {/* Preview Card */}
        {isValid && (
          <Animated.View style={[styles.previewCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            <Text style={[styles.previewLabel, { color: theme.textMuted }]}>How you'll appear</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewInfo}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.previewPhoto} />
                ) : selectedAvatarIndex !== null ? (
                  <Image source={{ uri: DEFAULT_AVATARS[selectedAvatarIndex] }} style={styles.previewPhoto} />
                ) : (
                  <View style={[styles.previewPhotoPlaceholder, { backgroundColor: theme.primary }]}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>
                )}
                <Text style={[styles.previewName, { color: theme.textMain }]}>{displayName}</Text>
              </View>
              <View style={[styles.rankBadge, { backgroundColor: theme.bgDeep }]}>
                <Text style={[styles.rankText, { color: theme.primary }]}>Initiate</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </OnboardingLayout>
    <CustomAlert {...alertConfig} onClose={hideAlert} />
  </>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 6,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 6,
    borderWidth: 2,
    borderTopWidth: 3,
    borderLeftWidth: 4,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
  },
  photoEditButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarsTitle: {
    ...Typography.caption,
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  avatarsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  avatarWrapper: {
    borderRadius: 6,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatar: {
    width: 44,
    height: 44,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    borderRadius: 4,
    backgroundColor: '#161616',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    fontSize: 16,
  },
  charCount: {
    ...Typography.caption,
    fontSize: 12,
  },
  hintText: {
    ...Typography.caption,
    fontSize: 12,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  previewCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 4,
    borderColor: '#333',
    backgroundColor: '#161616',
    padding: Spacing.md,
  },
  previewLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewPhoto: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  previewPhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '600',
  },
  rankBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  rankText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 4,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default ProfileSetupScreen;
