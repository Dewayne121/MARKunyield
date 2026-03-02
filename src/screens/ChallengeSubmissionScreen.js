import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
  Linking,
  AppState,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { EXERCISES } from '../constants/exercises';
import { COMPETITIVE_LIFTS, resolveCompetitiveLiftId } from '../constants/competitiveLifts';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/colors';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

// Helper component for form sections - Operator Style
const FormSection = ({ title, children, required, theme, styles }) => (
  <View style={styles.sectionContainer}>
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
      {required && <Text style={[styles.requiredMark, { color: theme.danger }]}>*</Text>}
    </View>
    {children}
  </View>
);

export default function ChallengeSubmissionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { challenge } = route.params;
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef(null);

  const [selectedExercise, setSelectedExercise] = useState(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [videoUri, setVideoUri] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0);
  const recordStartRef = useRef(0);
  const [facing, setFacing] = useState('back');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [videoSource, setVideoSource] = useState('camera');
  const [blurFaces, setBlurFaces] = useState(false);
  const [blurring, setBlurring] = useState(false); 

  const recordingTimerRef = useRef(null);
  const recordingRef = useRef(false);
  const startRecordingLockRef = useRef(false);
  const cameraBootTimeoutRef = useRef(null);
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const styles = createStyles(theme);

  const competitiveLiftSet = new Set(COMPETITIVE_LIFTS.map((lift) => lift.id));
  const allowedChallengeExercises = (challenge?.exercises || [])
    .map((value) => resolveCompetitiveLiftId(value))
    .filter(Boolean);
  const availableExercises = challenge?.challengeType === 'exercise'
    ? EXERCISES.filter((exercise) => {
        return allowedChallengeExercises.includes(exercise.id) && competitiveLiftSet.has(exercise.id);
      })
    : EXERCISES.filter((exercise) => competitiveLiftSet.has(exercise.id));

  // Auto-select the first exercise from the challenge when component mounts
  useEffect(() => {
    if (challenge?.challengeType === 'exercise' && availableExercises.length > 0 && !selectedExercise) {
      setSelectedExercise(availableExercises[0]);
    }
  }, [challenge?.challengeType, availableExercises]);

  const resetCamera = useCallback(() => {
    setCameraError('');
    setCameraReady(false);
    setCameraKey(prev => prev + 1);
  }, []);

  const handleCameraReady = useCallback(() => {
    if (cameraBootTimeoutRef.current) {
      clearTimeout(cameraBootTimeoutRef.current);
      cameraBootTimeoutRef.current = null;
    }
    setCameraReady(true);
    setCameraError('');
  }, []);

  const handleCameraError = useCallback((error) => {
    if (cameraBootTimeoutRef.current) {
      clearTimeout(cameraBootTimeoutRef.current);
      cameraBootTimeoutRef.current = null;
    }
    setCameraReady(false);
    setCameraError(error?.message || 'Camera unavailable.');
  }, []);

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const result = await requestPermission();
    if (result.granted) return true;
    showAlert({
      title: 'Camera Permission',
      message: 'Camera access is needed to record video. You can still upload from your gallery.',
      icon: 'warning',
      buttons: [
        { text: 'OK', style: 'cancel' },
        { text: 'Open Settings', style: 'default', onPress: openSettings },
      ]
    });
    return false;
  };

  const ensureMicrophonePermission = async () => {
    if (micPermission?.granted) return true;
    const result = await requestMicPermission();
    if (result.granted) return true;
    showAlert({
      title: 'Microphone Disabled',
      message: 'Your video will record without audio.',
      icon: 'info',
      buttons: [{ text: 'OK', style: 'default' }]
    });
    return false;
  };

  const resolveDurationSeconds = (durationValue) => {
    const duration = typeof durationValue === 'number' ? durationValue : 0;
    if (!duration) return 0;
    return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration);
  };

  const applyVideoSelection = (uri, durationSeconds, source) => {
    if (!uri) return false;
    if (durationSeconds < 5) {
      showAlert({
        title: 'Video Too Short',
        message: 'Video must be at least 5 seconds long. Please try again.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      setVideoUri(null);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      return false;
    }
    setVideoUri(uri);
    setRecordingTime(durationSeconds);
    recordingTimeRef.current = durationSeconds;
    setVideoSource(source);
    setRecording(false);
    setCameraActive(false);
    return true;
  };

  const recordWithSystemCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please allow camera access to record a video.',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoQuality: 1,
        videoMaxDuration: 60,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const durationSeconds = resolveDurationSeconds(asset.duration);
        applyVideoSelection(asset.uri, durationSeconds || 5, 'camera');
      }
    } catch (error) {
      console.error('Error recording with system camera:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to record video. Please try again.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const openCamera = async () => {
    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) return;
    // Reliability-first path: system camera is consistently more stable for challenge capture.
    await recordWithSystemCamera();
  };

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const stopRecordingSafely = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try {
      await cameraRef.current?.stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      setRecording(false);
    }
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    resetCamera();
  }, [cameraActive, resetCamera]);

  useEffect(() => {
    if (!cameraActive || !permission?.granted || !isFocused) return;
    if (cameraBootTimeoutRef.current) {
      clearTimeout(cameraBootTimeoutRef.current);
    }
    cameraBootTimeoutRef.current = setTimeout(() => {
      setCameraError(prev => prev || 'Camera failed to start. Try again or use system camera.');
    }, 6000);
    return () => {
      if (cameraBootTimeoutRef.current) {
        clearTimeout(cameraBootTimeoutRef.current);
        cameraBootTimeoutRef.current = null;
      }
    };
  }, [cameraActive, permission?.granted, isFocused, cameraKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      // iOS can briefly enter `inactive` during transient UI events; do not abort recording for that.
      if (nextState === 'background' && recordingRef.current) {
        stopRecordingSafely();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [stopRecordingSafely]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      startRecordingLockRef.current = false;
      recordingRef.current = false;
    };
  }, []);

  const startRecording = async () => {
    if (recordingRef.current || startRecordingLockRef.current) return;
    startRecordingLockRef.current = true;

    const hasCameraPermission = await ensureCameraPermission();
    if (!hasCameraPermission) {
      startRecordingLockRef.current = false;
      return;
    }

    const micAllowed = await ensureMicrophonePermission();
    if (!cameraRef.current || !cameraReady || cameraError) {
      await recordWithSystemCamera();
      startRecordingLockRef.current = false;
      return;
    }

    try {
      setRecording(true);
      recordingRef.current = true;
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      recordStartRef.current = Date.now();
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
        // Backend upload route enforces a 50MB cap; keep client below that.
        maxFileSize: 45 * 1024 * 1024,
        mute: !micAllowed,
      });
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      recordingRef.current = false;
      const durationSeconds = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
      const applied = applyVideoSelection(video?.uri, durationSeconds, 'camera');
      if (!applied) {
        setRecording(false);
        // Resetting camera helps recover preview on devices that pause/freeze after short recordings.
        resetCamera();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      recordingRef.current = false;
      setRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      showAlert({
        title: 'Error',
        message: 'Failed to record video. Please try again.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      startRecordingLockRef.current = false;
    }
  };

  const stopRecording = () => {
    stopRecordingSafely();
  };

  const pickVideoFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return showAlert({
          title: 'Permission Required',
          message: 'Please grant permission to access your photo library to select a video.',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoQuality: 1, // 0=low, 1=medium, 2=high
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const durationSeconds = resolveDurationSeconds(asset.duration);
        applyVideoSelection(asset.uri, durationSeconds || 5, 'gallery');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to pick video from gallery. Please try again.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const handleSubmit = async () => {
    if (challenge?.challengeType === 'exercise' && !selectedExercise) {
      return showAlert({
        title: 'Missing Info',
        message: 'Please select an exercise.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
    if (!videoUri) {
      return showAlert({
        title: 'Proof Required',
        message: 'Please record or upload a video.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }

    try {
      setSubmitting(true);

      const uploadResponse = await api.uploadVideo(videoUri);
      if (!uploadResponse.success) throw new Error('Upload failed');

      let finalVideoUrl = uploadResponse.data.videoUrl;
      let finalServerVideoId = uploadResponse.data.objectName;
      let originalVideoUrl = null; // Store original for admin view

      if (blurFaces) {
        setBlurring(true);
        try {
          const blurResponse = await api.blurVideo(finalVideoUrl);
          if (!blurResponse.success || !blurResponse.data?.blurredVideoUrl) {
            throw new Error(blurResponse.error || 'Face blur failed. Entry not submitted to protect privacy.');
          }

          originalVideoUrl = blurResponse.data.originalVideoUrl || finalVideoUrl;
          finalVideoUrl = blurResponse.data.blurredVideoUrl;
          const blurredObjectName = blurResponse.data?.objectName || blurResponse.data?.blurredObjectName;
          if (blurredObjectName) {
            finalServerVideoId = blurredObjectName;
          }
        } finally {
          setBlurring(false);
        }
      }

      let value = 0;
      switch (challenge?.metricType) {
        case 'reps': value = parseInt(reps) || 0; break;
        case 'weight': value = parseFloat(weight) || 0; break;
        case 'duration': value = parseInt(duration) || 0; break;
        default: value = 1;
      }

      const challengeId = challenge?.id || challenge?._id;
      if (!challengeId) {
        throw new Error('Challenge ID is missing.');
      }
      const response = await api.submitChallengeEntry(challengeId, {
        exercise: selectedExercise?.id,
        reps: parseInt(reps) || 0,
        weight: parseFloat(weight) || 0,
        duration: parseInt(duration) || 0,
        videoUrl: finalVideoUrl,
        originalVideoUrl: originalVideoUrl, // Original unblurred URL (admin only)
        serverVideoId: finalServerVideoId,
        value,
        blurFaces: blurFaces, // Pass blur flag to backend
        notes: notes.trim(),
      });

      if (response.success) {
        const message = blurFaces
          ? 'Entry submitted! Face blur is processing in the background. Check your profile for status.'
          : 'Your entry is now pending admin approval. XP will be confirmed once verified.';
        showAlert({
          title: 'Entry Submitted',
          message: message,
          icon: 'success',
          buttons: [{ text: 'Done', style: 'default', onPress: () => navigation.goBack() }]
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to submit entry. Please try again.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (cameraActive) {
    return (
      <View style={styles.fullScreenCamera}>
        {permission?.granted ? (
          <>
            <CameraView
              key={cameraKey}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode="video"
              videoQuality="480p"
              mute={!micPermission?.granted}
              active={cameraActive && isFocused}
              onCameraReady={handleCameraReady}
              onMountError={handleCameraError}
            />
            {!cameraReady && !cameraError && (
              <View style={styles.cameraOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.cameraOverlayText}>STARTING CAMERA...</Text>
              </View>
            )}
            {!!cameraError && (
              <View style={styles.cameraErrorOverlay}>
                <Ionicons name="alert-circle-outline" size={36} color="#fff" />
                <Text style={styles.cameraErrorTitle}>CAMERA UNAVAILABLE</Text>
                <Text style={styles.cameraErrorText}>{cameraError}</Text>
                <View style={styles.cameraErrorActions}>
                  <TouchableOpacity onPress={resetCamera} style={styles.cameraErrorButton}>
                    <Text style={styles.cameraErrorButtonText}>RETRY</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={recordWithSystemCamera} style={styles.cameraErrorButtonAlt}>
                    <Text style={styles.cameraErrorButtonAltText}>USE SYSTEM CAMERA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.cameraPermissionGate}>
            <Ionicons name="videocam-outline" size={48} color="#fff" />
            <Text style={styles.cameraPermissionTitle}>CAMERA ACCESS NEEDED</Text>
            <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>ENABLE CAMERA</Text>
            </TouchableOpacity>
            {!permission?.canAskAgain && (
              <TouchableOpacity onPress={openSettings} style={styles.permissionButtonSecondary}>
                <Text style={styles.permissionButtonSecondaryText}>OPEN SETTINGS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={recordWithSystemCamera} style={styles.permissionButtonSecondary}>
              <Text style={styles.permissionButtonSecondaryText}>USE SYSTEM CAMERA</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.cameraHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setCameraActive(false)} style={styles.cameraCloseButton}>
                <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {recording && (
                <View style={[styles.recordingIndicator, { backgroundColor: theme.danger }]}>
                    <View style={styles.redDot} />
                    <Text style={styles.recordingTime}>{formatTime(recordingTime)}</Text>
                </View>
            )}
            <TouchableOpacity
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                style={styles.cameraFlipButton}
                disabled={recording}
            >
                <Ionicons name="camera-reverse" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
        <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.recordButtonOuter} onPress={recording ? stopRecording : startRecording}>
                <View style={[styles.recordButtonInner, recording && { width: 28, height: 28, borderRadius: 4, backgroundColor: theme.danger }]} />
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                <Ionicons name="arrow-back" size={24} color={theme.textMain} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SUBMIT ENTRY</Text>
            <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            {/* Media Selection */}
            <View style={styles.sectionContainer}>
            {videoUri ? (
                <View style={styles.videoSuccessBox}>
                    <View style={[styles.videoSuccessIndicator, { backgroundColor: theme.success }]} />
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} style={{marginRight: 12}} />
                    <View style={{flex: 1}}>
                        <Text style={styles.videoSuccessTitle}>VIDEO ATTACHED</Text>
                        <Text style={styles.videoSuccessSub}>{formatTime(recordingTime)} • {videoSource.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setVideoUri(null)} style={styles.trashBtn}>
                        <Ionicons name="trash" size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.mediaRow}>
                    <TouchableOpacity style={[styles.mediaBtn, { borderColor: theme.border }]} onPress={openCamera}>
                        <View style={styles.mediaBtnGradient}>
                            <Ionicons name="videocam" size={28} color={theme.primary} />
                            <Text style={styles.mediaBtnText}>RECORD</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mediaBtn, { borderColor: theme.border }]} onPress={pickVideoFromGallery}>
                        <View style={styles.mediaBtnGradient}>
                            <Ionicons name="cloud-upload" size={28} color={theme.textMain} />
                            <Text style={styles.mediaBtnText}>UPLOAD</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
        </View>

        {/* Form Fields */}
        <View style={styles.formPanel}>
            {/* Notes section moved to TOP for visibility */}
            <FormSection title="COMMS / NOTES" theme={theme} styles={styles}>
                <TextInput
                    style={[styles.operatorInput, styles.textArea]}
                    placeholder="OPTIONAL INTEL..."
                    placeholderTextColor={theme.textMuted}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    returnKeyType="done"
                    submitBehavior="blurAndSubmit"
                />
            </FormSection>

            {challenge?.challengeType === 'exercise' && (
                <FormSection title="EXERCISE" required theme={theme} styles={styles}>
                    <TouchableOpacity style={styles.operatorInput} onPress={() => availableExercises.length > 1 ? setShowExerciseSelector(true) : null}>
                        <Text style={[styles.inputText, !selectedExercise && { color: theme.textMuted }]}>
                            {selectedExercise ? selectedExercise.name.toUpperCase() : "SELECT EXERCISE"}
                        </Text>
                        {availableExercises.length > 1 && (
                            <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                        )}
                    </TouchableOpacity>
                </FormSection>
            )}

            <View style={styles.row}>
                {(challenge?.metricType === 'reps' || challenge?.metricType === 'weight') && (
                    <View style={{flex: 1, marginRight: 8}}>
                        <FormSection title="REPS" required={challenge?.metricType === 'reps'} theme={theme} styles={styles}>
                            <TextInput
                                style={styles.operatorInput}
                                placeholder={`0  •  Goal: ${challenge?.target || '?'} ${challenge?.metricType?.toUpperCase() || ''}`}
                                placeholderTextColor={theme.textMuted}
                                value={reps}
                                onChangeText={setReps}
                                keyboardType="number-pad"
                            />
                        </FormSection>
                    </View>
                )}
                {challenge?.metricType === 'weight' && (
                    <View style={{flex: 1, marginLeft: 8}}>
                        <FormSection title="WEIGHT (KG)" required theme={theme} styles={styles}>
                            <TextInput
                                style={styles.operatorInput}
                                placeholder={`0.0  •  Goal: ${challenge?.target || '?'} ${challenge?.metricType?.toUpperCase() || ''}`}
                                placeholderTextColor={theme.textMuted}
                                value={weight}
                                onChangeText={setWeight}
                                keyboardType="decimal-pad"
                            />
                        </FormSection>
                    </View>
                )}
            </View>

            {challenge?.metricType === 'duration' && (
                <FormSection title="DURATION (SEC)" required theme={theme} styles={styles}>
                    <TextInput
                        style={styles.operatorInput}
                        placeholder={`0  •  Goal: ${challenge?.target || '?'} ${challenge?.metricType?.toUpperCase() || ''}`}
                        placeholderTextColor={theme.textMuted}
                        value={duration}
                        onChangeText={setDuration}
                        keyboardType="number-pad"
                    />
                </FormSection>
            )}
        </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {/* Blur Faces Toggle */}
        {videoUri && (
          <TouchableOpacity
            style={[
                styles.blurToggle, 
                { borderColor: blurFaces ? theme.primary : theme.border, backgroundColor: blurFaces ? theme.primary : theme.bgCard }
            ]}
            onPress={() => setBlurFaces(!blurFaces)}
            disabled={submitting}
          >
            <Ionicons
              name={blurFaces ? "eye-off" : "eye"}
              size={20}
              color={blurFaces ? "#fff" : theme.textMuted}
            />
            <Text style={[styles.blurToggleText, blurFaces ? { color: '#fff' } : { color: theme.textMuted }]}>
              {blurFaces ? "FACE BLUR: ON" : "FACE BLUR: OFF"}
            </Text>
            {blurring && (
              <ActivityIndicator
                size="small"
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
            style={[
                styles.submitBtn, 
                { backgroundColor: theme.primary, shadowColor: theme.primary },
                (!videoUri || submitting || blurring) && styles.submitBtnDisabled
            ]}
            onPress={handleSubmit}
            disabled={submitting || !videoUri || blurring}
        >
            {submitting || blurring ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={styles.submitBtnText}>DEPLOY ENTRY</Text>
            )}
        </TouchableOpacity>
      </View>

      {/* Exercise Modal */}
      <Modal visible={showExerciseSelector} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => setShowExerciseSelector(false)}>
                    <Ionicons name="close" size={28} color={theme.textMain} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SELECT EXERCISE</Text>
                <View style={{ width: 28 }} />
            </View>
          </View>
          <ScrollView style={{flex: 1, padding: 20}}>
            {availableExercises.map(ex => (
              <TouchableOpacity
                key={ex.id}
                style={[styles.modalItem, selectedExercise?.id === ex.id && { backgroundColor: theme.bgPanel }]}
                onPress={() => { setSelectedExercise(ex); setShowExerciseSelector(false); }}
              >
                <Text style={[styles.modalItemText, selectedExercise?.id === ex.id ? { color: theme.primary } : { color: theme.textMuted }]}>
                  {ex.name.toUpperCase()}
                </Text>
                {selectedExercise?.id === ex.id && <Ionicons name="flash" size={18} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

function createStyles(theme) {
    return StyleSheet.create({
      container: { flex: 1, backgroundColor: theme.bgDeep },
      keyboardView: { flex: 1 },
      header: { paddingHorizontal: 24, paddingBottom: 16, backgroundColor: theme.bgPanel, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
      headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
      headerTitle: { fontSize: 16, fontWeight: '800', color: theme.textMain, letterSpacing: 1 },
      content: { flex: 1 },
      scrollContent: { padding: 20 },
      
      challengeCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 24, backgroundColor: theme.bgCard, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
      cardGradient: { padding: 20 },
      cardHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
      challengeHeader: { flexDirection: 'row', alignItems: 'center' },
      iconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
      challengeTitle: { fontSize: 16, fontWeight: '800', color: theme.textMain, marginBottom: 4 },
      challengeTarget: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1 },

      sectionContainer: { marginBottom: 20, marginTop: 16 },
      sectionHeader: { flexDirection: 'row', marginBottom: 10 },
      sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
      requiredMark: { marginLeft: 4, fontSize: 12 },

      mediaRow: { flexDirection: 'row', gap: 12 },
      mediaBtn: { flex: 1, height: 100, borderRadius: 16, overflow: 'hidden', borderWidth: 1, backgroundColor: theme.bgCard },
      mediaBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
      mediaBtnText: { fontSize: 11, fontWeight: '800', color: theme.textMain, letterSpacing: 1 },
      
      videoSuccessBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgCard, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
      videoSuccessIndicator: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2 },
      videoSuccessTitle: { fontSize: 13, fontWeight: '800', color: theme.textMain, letterSpacing: 0.5 },
      videoSuccessSub: { fontSize: 11, fontWeight: '700', color: theme.textMuted },

      formPanel: { backgroundColor: theme.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
      operatorInput: { backgroundColor: theme.bgDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: theme.textMain, fontSize: 15, fontWeight: '700', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      textArea: { minHeight: 80, textAlignVertical: 'top' },
      inputText: { color: theme.textMain, fontSize: 15, fontWeight: '700' },
      row: { flexDirection: 'row' },

      footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, backgroundColor: 'transparent' },
      submitBtn: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
      submitBtnDisabled: { backgroundColor: theme.bgCard, shadowOpacity: 0, elevation: 0 },
      submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
      blurToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
      blurToggleText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginLeft: 8 },

      fullScreenCamera: { flex: 1, backgroundColor: '#000' },
      cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      },
      cameraOverlayText: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 1,
      },
      cameraErrorOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: 'rgba(0,0,0,0.6)',
      },
      cameraErrorTitle: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1.2,
      },
      cameraErrorText: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
      },
      cameraErrorActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
      },
      cameraErrorButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
      },
      cameraErrorButtonText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 1,
      },
      cameraErrorButtonAlt: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
      },
      cameraErrorButtonAltText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1,
      },
      cameraPermissionGate: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: '#000',
      },
      cameraPermissionTitle: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1.2,
      },
      permissionButton: {
        marginTop: 18,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#fff',
      },
      permissionButtonText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 1,
      },
      permissionButtonSecondary: {
        marginTop: 10,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
      },
      permissionButtonSecondaryText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1,
      },
      cameraHeader: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
      cameraCloseButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
      cameraFlipButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
      recordingIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
      redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 },
      recordingTime: { color: '#fff', fontWeight: '800', fontSize: 12 },
      cameraFooter: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
      recordButtonOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
      recordButtonInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

      modalContainer: { flex: 1, backgroundColor: theme.bgDeep },
      modalItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      modalItemText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
      contextChip: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderRadius: 8,
        alignSelf: 'flex-start',
      },
      contextChipText: {
        fontSize: 10,
        fontWeight: '600',
        color: theme.textMuted,
        letterSpacing: 0.5,
      },
    });
}
