import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator, Linking, AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

import { useApp, EXERCISES, LS_GEMINI_KEY, calcPoints, calcStrengthRatio, formatStrengthRatio, MAX_REPS, MAX_WEIGHT_KG, MAX_WEIGHT_LBS } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { SKINS } from '../constants/colors';
import api from '../services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

const LS_WORKOUT_VIDEOS = 'unyield_workout_videos';

// Helper functions for video storage
async function saveWorkoutVideo(videoData) {
  try {
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    const videos = existing ? JSON.parse(existing) : [];
    videos.unshift(videoData); // Add to beginning
    await AsyncStorage.setItem(LS_WORKOUT_VIDEOS, JSON.stringify(videos.slice(0, 50))); // Keep max 50
  } catch (e) {
    console.error('Error saving video:', e);
  }
}

async function getWorkoutVideos() {
  try {
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
}

async function deleteWorkoutVideo(videoId, serverId) {
  try {
    // Delete from server first if it has a server ID
    if (serverId) {
      try {
        await api.deleteVideo(serverId);
        console.log('Video deleted from server:', serverId);
      } catch (apiError) {
        console.error('Error deleting video from server:', apiError);
        // Continue with local deletion even if server deletion fails
        // This handles cases where the video may have already been deleted server-side
      }
    }

    // Also delete from local storage
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    const videos = existing ? JSON.parse(existing) : [];
    const filtered = videos.filter(v => v.id !== videoId);
    await AsyncStorage.setItem(LS_WORKOUT_VIDEOS, JSON.stringify(filtered));
    console.log('Video deleted from local storage:', videoId);
  } catch (e) {
    console.error('Error deleting video:', e);
    throw e;
  }
}

const Spacing = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

async function generateWorkoutReport({ apiKey, exerciseName, reps, weight }) {
  if (!apiKey) {
    return `Logged: ${reps} reps of ${exerciseName}. Your effort is recorded.`;
  }

  const prompt = `User just completed ${reps} reps of ${exerciseName}${weight ? ` at ${weight}kg` : ''}.
Write a short intense workout report (1-3 sentences).
Use fitness/gaming terms like "XP", "grind", "Level Up", "progress". Keep it motivating but not military-themed.`;

  try {
    const model = 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: 'You are the coach of UNYIELD, a gritty competitive fitness app. You speak with intensity and motivation. Keep it short, punchy, and encouraging. Avoid military jargon.' }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generation_config: { temperature: 0.9 },
      }),
    });

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
                data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) return String(text).trim();
    return 'Report unavailable. Keep grinding.';
  } catch (err) {
    try {
      const url2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res2 = await fetch(url2, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: 'You are the coach of UNYIELD, a gritty competitive fitness app. You speak with intensity and motivation. Keep it short, punchy, and encouraging. Avoid military jargon.' }],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generation_config: { temperature: 0.9 },
        }),
      });
      if (!res2.ok) throw new Error(`Gemini HTTP ${res2.status}`);
      const data2 = await res2.json();
      const text2 = data2?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
                   data2?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text2) return String(text2).trim();
    } catch {}
    return 'Systems are down, but your effort is logged. Keep pushing.';
  }
}

export default function WorkoutSubmitScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, skin } = useTheme();
  const isDark = skin === SKINS.operator || skin === SKINS.midnight;
  const { user, addLog, weightUnit, toggleWeightUnit } = useApp();
  const isFocused = useIsFocused();

  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordingUri, setRecordingUri] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const recTimer = useRef(null);
  const recordStartRef = useRef(0);
  const recordSecondsRef = useRef(0);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [videoSource, setVideoSource] = useState('camera'); // 'camera' or 'gallery'
  const [blurFaces, setBlurFaces] = useState(false);
  const [blurring, setBlurring] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [facing, setFacing] = useState('back');
  const cameraBootTimeoutRef = useRef(null);

  // Custom alert state
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  // Get max weight based on current unit
  const maxWeight = weightUnit === 'kg' ? MAX_WEIGHT_KG : MAX_WEIGHT_LBS;

  const resetCamera = useCallback(() => {
    setCameraError('');
    setCameraReady(false);
    setCameraKey((prev) => prev + 1);
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

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      if (recTimer.current) {
        clearInterval(recTimer.current);
      }
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    resetCamera();
  }, [isFocused, resetCamera]);

  // Show warning if user doesn't have weight set
  useEffect(() => {
    if (!isFocused) return;

    if (!hasValidWeight && user) {
      showAlert({
        title: 'Weight Required',
        message: 'Please update your profile with your weight to participate in competition. This is required for fair strength ratio ranking.',
        icon: 'warning',
        buttons: [
          { text: 'Update Profile', style: 'default', onPress: () => navigation.navigate('Profile') },
          { text: 'Cancel', style: 'cancel' }
        ]
      });
    }
  }, [isFocused, hasValidWeight, user]);

  useEffect(() => {
    if (!permission?.granted || !isFocused) return;
    if (cameraBootTimeoutRef.current) {
      clearTimeout(cameraBootTimeoutRef.current);
    }
    cameraBootTimeoutRef.current = setTimeout(() => {
      setCameraError((prev) => prev || 'Camera failed to start. Try again or use system camera.');
    }, 6000);
    return () => {
      if (cameraBootTimeoutRef.current) {
        clearTimeout(cameraBootTimeoutRef.current);
        cameraBootTimeoutRef.current = null;
      }
    };
  }, [permission?.granted, isFocused, cameraKey]);


  const handleCancel = () => {
    if (isRecording) {
      showAlert({
        title: 'Recording in Progress',
        message: 'A recording is currently in progress. Are you sure you want to cancel?',
        icon: 'warning',
        buttons: [
          { text: 'Keep Recording', style: 'cancel' },
          {
            text: 'Cancel Anyway',
            style: 'destructive',
            onPress: async () => {
              await stopRecordingSafely();
              navigation.pop();
            },
          },
        ]
      });
    } else {
      navigation.pop();
    }
  };

  const exercise = useMemo(() => EXERCISES.find((x) => x.id === exerciseId) || EXERCISES[0], [exerciseId]);
  const hasValidWeight = user?.weight && user.weight > 0;

  // Calculate strength ratio instead of points
  const strengthRatio = useMemo(() => {
    if (!hasValidWeight) return 0;

    // Convert weight to kg if needed
    const weightKg = weightUnit === 'lbs' ? weight / 2.20462 : weight;

    return calcStrengthRatio({
      reps,
      weightLifted: weightKg,
      bodyweight: user.weight
    });
  }, [exercise, reps, weight, user?.weight, weightUnit, hasValidWeight]);

  const points = useMemo(() => calcPoints(exercise, reps, weight, user?.streak || 0), [exercise, reps, weight, user]);
  const canSubmitVideo = hasRecording && !!recordingUri && recordSeconds >= 5 && hasValidWeight;
  const isSubmitDisabled = isSubmitting || blurring || (reps <= 0 && exercise.name !== 'Run (Km)') || !canSubmitVideo;

  const adjustReps = (delta) => {
    setReps((prev) => Math.max(0, prev + delta));
  };

  const adjustWeight = (delta) => {
    setWeight((prev) => Math.max(0, prev + delta));
  };

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const result = await requestPermission();
    if (result.granted) return true;
    showAlert({
      title: 'Camera Permission',
      message: 'Camera access is needed to record. You can still upload a video from your gallery.',
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
      setRecordingUri(null);
      setHasRecording(false);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      return false;
    }
    setRecordingUri(uri);
    setRecordSeconds(durationSeconds);
    recordSecondsRef.current = durationSeconds;
    setHasRecording(true);
    setIsRecording(false);
    setVideoSource(source);
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
        mediaTypes: ImagePicker.MediaType.Videos,
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

  const stopRecordingSafely = useCallback(async () => {
    if (!isRecording) return;
    if (recTimer.current) {
      clearInterval(recTimer.current);
    }
    try {
      await cameraRef.current?.stopRecording();
    } catch (err) {
      console.error('Error stopping recording:', err);
    } finally {
      setIsRecording(false);
    }
  }, [isRecording]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        stopRecordingSafely();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [stopRecordingSafely]);

  const startRecording = async () => {
    const hasCameraPermission = await ensureCameraPermission();
    if (!hasCameraPermission) return;

    const micAllowed = await ensureMicrophonePermission();
    if (!cameraRef.current || !cameraReady || cameraError) {
      await recordWithSystemCamera();
      return;
    }

    try {
      setIsRecording(true);
      setHasRecording(false);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      setRecordingUri(null);
      setVideoSource('camera');

      recordStartRef.current = Date.now();
      recTimer.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
      }, 1000);

      const result = await cameraRef.current.recordAsync({
        quality: '480p',
        maxDuration: 60,
        mute: !micAllowed,
      });

      const durationSeconds = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
      if (recTimer.current) {
        clearInterval(recTimer.current);
      }
      applyVideoSelection(result?.uri, durationSeconds, 'camera');
      console.log('Recording saved:', result?.uri);
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (recTimer.current) {
        clearInterval(recTimer.current);
      }
      setIsRecording(false);
      showAlert({
        title: 'Recording Error',
        message: 'Could not start recording. Please try again.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecordingSafely();
      return;
    }
    await startRecording();
  };

  const formatTimer = () => {
    const minutes = Math.floor(recordSeconds / 60).toString().padStart(2, '0');
    const seconds = (recordSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const pickVideoFromGallery = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please grant permission to access your photo library to select a video.',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        return;
      }

      // Pick video from gallery
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Videos,
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

  async function submit() {
    if (!user || isSubmitting || (reps <= 0 && exercise.name !== 'Run (Km)')) return;

    // Check if recording exists and is at least 5 seconds
    if (!canSubmitVideo) {
      showAlert({
        title: 'Recording Required',
        message: 'You must record at least 5 seconds of your workout to submit.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }

    setIsSubmitting(true);

    // Convert weight to kg for storage (always store as kg internally)
    const weightInKg = weightUnit === 'lbs' ? weight / 2.20462 : weight;

    const log = {
      id: Math.random().toString(36).slice(2),
      exercise: exercise.name,
      reps,
      weight: weightInKg,
      date: new Date().toISOString(),
      points,
      type: 'competition', // Differentiate from personal logs
    };

    await new Promise((r) => setTimeout(r, 650));

    const apiKey = (await AsyncStorage.getItem(LS_GEMINI_KEY))?.trim() || '';
    const report = await generateWorkoutReport({
      apiKey,
      exerciseName: exercise.name,
      reps,
      weight: weightInKg,
    });

    // Save workout video with recording duration (locally and to server)
    if (hasRecording && recordingUri) {
      // Save locally for offline access
      await saveWorkoutVideo({
        id: log.id,
        uri: recordingUri,
        exercise: exercise.name,
        reps,
        weight: weightInKg,
        date: new Date().toISOString(),
        points,
        duration: recordSeconds,
        status: 'pending',
        approved: false,
        userId: user._id || user.id,
      });

      // Upload video to server and submit for verification
      try {
        console.log('[WORKOUT SUBMIT] ===== Starting video submission process =====');
        // Step 1: Upload the video file
        console.log('[WORKOUT SUBMIT] Step 1: Uploading video file to server...', { recordingUri });
        const uploadResponse = await api.uploadVideo(recordingUri);
        console.log('[WORKOUT SUBMIT] Upload response received:', JSON.stringify(uploadResponse));

        console.log('[WORKOUT SUBMIT] Checking condition:', {
          hasSuccess: !!uploadResponse.success,
          successValue: uploadResponse.success,
          hasData: !!uploadResponse.data,
          hasVideoUrl: !!uploadResponse.data?.videoUrl
        });

        if (uploadResponse.success && uploadResponse.data) {
          let serverVideoUrl = uploadResponse.data.videoUrl;
          let originalVideoUrl = null; // Store original for admin view
          console.log('[WORKOUT SUBMIT] ✓ Step 1 complete - Video uploaded successfully');
          console.log('[WORKOUT SUBMIT] serverVideoUrl:', serverVideoUrl);

          // Step 1.5: Blur faces if enabled
          if (blurFaces) {
            console.log('[WORKOUT SUBMIT] Blurring faces...');
            setBlurring(true);

            try {
              const blurResponse = await api.blurVideo(serverVideoUrl);

              if (!blurResponse.success || !blurResponse.data?.blurredVideoUrl) {
                throw new Error(blurResponse.error || 'Face blur failed. Video was not submitted.');
              }

              originalVideoUrl = blurResponse.data.originalVideoUrl || serverVideoUrl;
              serverVideoUrl = blurResponse.data.blurredVideoUrl;
              console.log('[WORKOUT SUBMIT] Faces blurred:', blurResponse.data.facesFound || blurResponse.data.facesDetected);
            } catch (blurError) {
              console.warn('[WORKOUT SUBMIT] Blur error:', blurError.message);
              throw blurError;
            } finally {
              setBlurring(false);
            }
          }

          // Step 2: Submit video metadata with the server URL
          console.log('[WORKOUT SUBMIT] Step 2: Submitting video metadata...', {
            exercise: exercise.name,
            reps,
            weight: weightInKg,
            duration: recordSeconds,
            videoUrl: serverVideoUrl,
            originalVideoUrl: originalVideoUrl
          });

          console.log('[WORKOUT SUBMIT] About to call api.submitVideo...');
          const submitResponse = await api.submitVideo({
            exercise: exercise.name,
            reps,
            weight: weightInKg,
            duration: recordSeconds,
            videoUrl: serverVideoUrl, // Blurred video URL (public)
            originalVideoUrl: originalVideoUrl, // Original unblurred URL (admin only)
            thumbnailUrl: null,
          });

          console.log('[WORKOUT SUBMIT] ✓ Step 2 complete - Video submitted successfully:', JSON.stringify(submitResponse));
        } else {
          console.error('[WORKOUT SUBMIT] ✗ Upload response invalid:', uploadResponse);
          console.error('[WORKOUT SUBMIT] Condition failed:', {
            success: uploadResponse.success,
            data: uploadResponse.data,
            hasVideoUrl: uploadResponse.data?.videoUrl
          });
        }
      } catch (err) {
        console.error('[WORKOUT SUBMIT] ✗ Error submitting video to server:', {
          message: err.message,
          stack: err.stack?.substring(0, 500),
          response: err.response
        });
        showAlert({
          title: 'Video Privacy Error',
          message: blurFaces
            ? (err.message || 'Face blur failed. The workout was saved, but video was not submitted for verification.')
            : 'Video upload failed. The workout was saved locally.',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        // Don't block the workout submission if video upload fails
        // Video will remain in local storage only
      }

      console.log('[WORKOUT SUBMIT] ===== Video submission process completed =====');
    }

    await addLog(log);
    setIsSubmitting(false);
    navigation.replace('WorkoutSummary', {
      report,
      earned: points,
      log,
    });
  }

  if (!user) return <View style={{ flex: 1, backgroundColor: theme.bgDeep }} />;

  const styles = createStyles(theme, isDark);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Full-screen camera background */}
      <View style={styles.cameraContainer}>
        {permission?.granted ? (
          <>
            <CameraView
              key={cameraKey}
              ref={cameraRef}
              style={styles.cameraPreview}
              facing={facing}
              mode="video"
              mute={!micPermission?.granted}
              active={isFocused}
              onCameraReady={handleCameraReady}
              onMountError={handleCameraError}
            />
            {!cameraReady && !cameraError && (
              <View style={styles.cameraOverlay}>
                <ActivityIndicator size="large" color={theme.textMain} />
                <Text style={styles.cameraOverlayText}>STARTING CAMERA...</Text>
              </View>
            )}
            {!!cameraError && (
              <View style={styles.cameraErrorOverlay}>
                <Ionicons name="alert-circle-outline" size={36} color={theme.textMain} />
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
          <View style={styles.cameraPlaceholder}>
            <Ionicons name="videocam-outline" size={64} color={theme.textMuted} />
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
      </View>

      {/* Top Header - floating */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleCancel} activeOpacity={0.85} style={styles.iconButton}>
          <Ionicons name="close" size={24} color={theme.textMain} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>RECORD</Text>
          {(isRecording || hasRecording) && (
            <Text style={styles.timer}>{formatTimer()}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          activeOpacity={0.85}
          style={styles.iconButton}
          disabled={isRecording}
        >
          <Ionicons name="camera-reverse" size={24} color={theme.textMain} />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls - floating */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 + keyboardHeight }]}>
        {/* Exercise selector */}
        <View style={styles.exerciseSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroller}>
            {EXERCISES.map((x) => {
              const active = x.id === exerciseId;
              return (
                <TouchableOpacity
                  key={x.id}
                  onPress={() => setExerciseId(x.id)}
                  activeOpacity={0.7}
                  style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
                    {x.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Stats row with text inputs */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>REPS</Text>
            <TextInput
              style={styles.statInput}
              value={reps.toString()}
              onChangeText={(text) => {
                const val = Math.max(0, parseInt(text) || 0);
                setReps(Math.min(val, MAX_REPS));
              }}
              keyboardType="number-pad"
              placeholder="0"
              maxLength={4}
            />
          </View>
          <View style={styles.statBox}>
            <View style={styles.weightLabelRow}>
              <Text style={styles.statLabel}>LOAD</Text>
              <TouchableOpacity onPress={toggleWeightUnit} style={styles.unitToggle}>
                <Text style={styles.unitText}>{weightUnit.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.statInput}
              value={weight.toString()}
              onChangeText={(text) => {
                const val = Math.max(0, parseInt(text) || 0);
                setWeight(Math.min(val, maxWeight));
              }}
              keyboardType="number-pad"
              placeholder="0"
              maxLength={4}
            />
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RATIO</Text>
            <Text style={[styles.statValue, { color: theme.primary }]}>{formatStrengthRatio(strengthRatio)}</Text>
          </View>
        </View>

        {/* Video source buttons */}
        <View style={styles.videoSourceButtons}>
          <TouchableOpacity
            onPress={toggleRecording}
            activeOpacity={0.8}
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          >
            <Ionicons
              name={isRecording ? "stop" : "videocam"}
              size={32}
              color={isRecording ? theme.bgDeep : theme.textMain}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickVideoFromGallery}
            activeOpacity={0.8}
            style={styles.galleryButton}
            disabled={isRecording}
          >
            <Ionicons
              name="image-outline"
              size={28}
              color={isRecording ? theme.textMuted : theme.textMain}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.recordStatus}>
          {isRecording ? 'RECORDING...' :
           hasRecording ? `${videoSource === 'gallery' ? 'UPLOADED' : 'RECORDED'} (${formatTimer()})` :
           'RECORD OR UPLOAD (MIN 5s)'}
        </Text>

        {/* Blur faces toggle */}
        {hasRecording && (
          <TouchableOpacity
            onPress={() => setBlurFaces(!blurFaces)}
            disabled={isSubmitting}
            style={[
              styles.blurToggleButton,
              blurFaces && styles.blurToggleActive
            ]}
          >
            <Ionicons
              name={blurFaces ? "eye-off" : "eye"}
              size={18}
              color={blurFaces ? theme.bgDeep : theme.textMuted}
            />
            <Text style={[
              styles.blurToggleText,
              blurFaces && styles.blurToggleTextActive
            ]}>
              {blurFaces ? "FACE BLUR: ON" : "FACE BLUR: OFF"}
            </Text>
            {blurring && (
              <ActivityIndicator
                size="small"
                color={theme.bgDeep}
                style={{ marginLeft: 8 }}
              />
            )}
          </TouchableOpacity>
        )}

        {/* Submit button */}
        <TouchableOpacity
          onPress={submit}
          activeOpacity={0.8}
          style={[
            styles.submitButton,
            isSubmitDisabled && styles.submitDisabled
          ]}
          disabled={isSubmitDisabled}
        >
          <Text style={styles.submitText}>
            {isSubmitting || blurring ? 'TRANSMITTING...' :
             !recordingUri ? 'RECORD REQUIRED (5s MIN)' :
             !canSubmitVideo ? `KEEP RECORDING (${5 - recordSeconds}s)` :
             'TRANSMIT LOG'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </KeyboardAvoidingView>
  );
}

function createStyles(theme, isDark) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.bgDeep },
    cameraContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    cameraPreview: {
      width: '100%',
      height: '100%',
    },
    cameraPlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgPanel,
    },
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
      color: theme.textMain,
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
      color: theme.textMain,
      letterSpacing: 1.2,
    },
    cameraErrorText: {
      marginTop: 8,
      fontSize: 11,
      fontWeight: '600',
      color: theme.textMuted,
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
      backgroundColor: theme.primary,
    },
    cameraErrorButtonText: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.textMain,
      letterSpacing: 1,
    },
    cameraErrorButtonAlt: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.shadow,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cameraErrorButtonAltText: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.textMain,
      letterSpacing: 1,
    },
    permissionButton: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    permissionButtonText: {
      color: theme.textMain,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    },
    permissionButtonSecondary: {
      marginTop: 10,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.shadow,
    },
    permissionButtonSecondaryText: {
      color: theme.textMain,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 10,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.shadow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      alignItems: 'center',
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: theme.textMain,
    },
    timer: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.danger,
      fontFamily: 'monospace',
      marginTop: 4,
    },
    bottomControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingBottom: 20,
      zIndex: 10,
    },
    exerciseSelector: {
      marginBottom: 16,
    },
    pillScroller: {
      gap: 8,
      paddingHorizontal: 4,
    },
    pill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      backgroundColor: theme.shadow,
    },
    pillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    pillInactive: {
      borderColor: theme.border,
    },
    pillText: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'monospace',
      textTransform: 'uppercase',
    },
    pillTextActive: {
      color: theme.textMain,
    },
    pillTextInactive: {
      color: theme.textMuted,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    statBox: {
      flex: 1,
      backgroundColor: theme.shadow,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    statLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.textMain,
      fontFamily: 'monospace',
    },
    statInput: {
      fontSize: 24,
      fontWeight: '900',
      color: theme.textMain,
      fontFamily: 'monospace',
      textAlign: 'center',
      padding: 0,
      margin: 0,
    },
    weightLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    unitToggle: {
      backgroundColor: theme.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    unitText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.textMain,
      letterSpacing: 0.5,
    },
    recordButton: {
      alignSelf: 'center',
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.border,
    },
    recordButtonActive: {
      backgroundColor: theme.textMain,
    },
    videoSourceButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 12,
    },
    galleryButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.shadowSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.border,
    },
    recordStatus: {
      alignSelf: 'center',
      fontSize: 11,
      fontWeight: '700',
      color: theme.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 16,
    },
    submitButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitDisabled: {
      opacity: 0.4,
    },
    submitText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: theme.textMain,
      fontFamily: 'monospace',
    },
    blurToggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgPanel,
      borderWidth: 1,
      borderColor: theme.textMuted,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    blurToggleActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    blurToggleText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.textMuted,
      marginLeft: 8,
    },
    blurToggleTextActive: {
      color: theme.textMain,
    },
  });
}
