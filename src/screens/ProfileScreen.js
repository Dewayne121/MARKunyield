import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, ActivityIndicator, TextInput, Platform, ActionSheetIOS, Image, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Video } from 'expo-av';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useStreamlinedOnboarding } from '../context/StreamlinedOnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getUserTier, getTierProgress } from '../constants/tiers';
import api from '../services/api';
import ScreenHeader from '../components/ScreenHeader';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import AccoladePickerModal from '../components/AccoladePickerModal';
import AdminProfileEditModal from '../components/AdminProfileEditModal';
import TutorialModal from '../components/TutorialModal';

// Conditional import for expo-video-thumbnails (not available on web)
let VideoThumbnails;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (e) {
  VideoThumbnails = null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Max content width for web/desktop to maintain mobile-like layout
const MAX_CONTENT_WIDTH = 480;
const CONTENT_WIDTH = Math.min(SCREEN_WIDTH, MAX_CONTENT_WIDTH);
const IS_WIDE_SCREEN = SCREEN_WIDTH > MAX_CONTENT_WIDTH;

const LS_WORKOUT_VIDEOS = 'unyield_workout_videos';

// Profile options
const REGIONS = ['Global', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'];
const GOALS = ['Hypertrophy', 'Leanness', 'Performance'];

// Helper functions for video storage
async function getWorkoutVideos() {
  try {
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
}

async function deleteWorkoutVideo(videoId, serverId, type = 'workout') {
  try {
    if (serverId) {
      if (type === 'challenge') {
        await api.deleteChallengeSubmission(serverId);
      } else {
        await api.deleteVideo(serverId);
      }
    }
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    const videos = existing ? JSON.parse(existing) : [];
    const filtered = videos.filter(v => v.id !== videoId);
    await AsyncStorage.setItem(LS_WORKOUT_VIDEOS, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting video:', e);
    throw e;
  }
}

async function clearAllLocalVideos() {
  try {
    await AsyncStorage.removeItem(LS_WORKOUT_VIDEOS);
    return true;
  } catch (e) {
    return false;
  }
}

export default function ProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user: currentUser, weightUnit, toggleWeightUnit, heightUnit, toggleHeightUnit } = useApp();
  const { signOut, deleteAccount, updateUserProfile, refreshUser } = useAuth();
  const { showTutorial, setShowTutorial, tutorialTopic } = useStreamlinedOnboarding();

  // Profile state
  const [viewedUser, setViewedUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [workoutVideos, setWorkoutVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const videoRef = useRef(null);
  const thumbnailRequestsRef = useRef(new Set());

  // Edit Profile Modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit form fields
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRegion, setEditRegion] = useState('Global');
  const [editGoal, setEditGoal] = useState('Hypertrophy');
  const [editProfileImage, setEditProfileImage] = useState(null);
  const [editFitnessLevel, setEditFitnessLevel] = useState(null);
  const [editWorkoutFrequency, setEditWorkoutFrequency] = useState(null);
  const [editPreferredDays, setEditPreferredDays] = useState([]);
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editAge, setEditAge] = useState('');

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [inviteCodes, setInviteCodes] = useState([]);
  const [inviteLimits, setInviteLimits] = useState({
    maxInviteCodes: 3,
    remainingInviteCodes: 3,
    isUnlimitedInvites: false,
  });
  const [loadingInviteCodes, setLoadingInviteCodes] = useState(false);
  const [generatingInviteCode, setGeneratingInviteCode] = useState(false);

  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Profile picture upload state
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);

  // Custom alert state
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  // Admin state
  const [showAccoladePicker, setShowAccoladePicker] = useState(false);
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);

  const routeUserParam = route?.params?.userId ?? route?.params?.id ?? route?.params?.user;
  const resolvedRouteUserId = typeof routeUserParam === 'string' || typeof routeUserParam === 'number'
    ? String(routeUserParam)
    : String(routeUserParam?.id ?? routeUserParam?._id ?? '');
  const userId = resolvedRouteUserId || null;
  const currentUserId = currentUser?.id ?? currentUser?._id;
  const isViewingOtherUser = Boolean(userId && String(userId) !== String(currentUserId));

  const isAdmin = currentUser?.accolades?.includes('admin');

  useEffect(() => {
    const loadUserProfile = async () => {
      setIsOwnProfile(!isViewingOtherUser);
      if (isViewingOtherUser) {
        if (viewedUser && (viewedUser.id === userId || viewedUser._id === userId)) {
          setLoadingProfile(false);
          return;
        }
        setViewedUser(null);
        setLoadingProfile(true);
        try {
          const response = await api.getUserById(userId);
          if (response.success && response.data) setViewedUser(response.data);
          else setViewedUser(null);
        } catch (err) { setViewedUser(null); }
        finally { setLoadingProfile(false); }
      } else {
        setLoadingProfile(true);
        try {
          const response = await api.getProfile();
          if (response.success && response.data) setViewedUser(response.data);
          else setViewedUser(currentUser);
        } catch (error) { setViewedUser(currentUser); }
        finally { setLoadingProfile(false); }
      }
    };
    loadUserProfile();
  }, [isViewingOtherUser, userId]);

  useFocusEffect(
    useCallback(() => {
      const refreshOnFocus = async () => {
        if (!isViewingOtherUser && refreshUser) {
          const refreshedUser = await refreshUser();
          if (refreshedUser) setViewedUser(refreshedUser);
        } else if (userId) {
          const response = await api.getUserById(userId);
          if (response.success && response.data) setViewedUser(response.data);
        }
      };
      refreshOnFocus().catch(() => {});
    }, [isViewingOtherUser, refreshUser, userId])
  );

  const loadWorkoutVideos = useCallback(async () => {
    try {
      let allVideos = [];
      if (!isViewingOtherUser) {
        const videoResponse = await api.getMyVideos();
        let challengeResponse = { success: false, data: [] };
        try { challengeResponse = await api.getMyChallengeSubmissions(); } catch (e) {}

        if (videoResponse.success && videoResponse.data) {
          allVideos.push(...videoResponse.data.map(v => ({
            id: v.id || v._id || v.serverId || v.videoUrl || v.videoUri,
            serverId: v.id || v._id || v.serverId,
            uri: v.videoUrl,
            exercise: v.exercise,
            reps: v.reps,
            weight: v.weight,
            date: v.createdAt,
            points: v.reps * 10,
            duration: v.duration,
            status: v.status,
            approved: v.status === 'approved',
            type: 'workout',
          })));
        }

        if (challengeResponse.success && challengeResponse.data) {
          allVideos.push(...challengeResponse.data.map(v => ({
            id: v.id || v._id || v.serverId || v.videoUrl || v.videoUri,
            serverId: v.id || v._id || v.serverId,
            uri: v.videoUrl,
            exercise: v.exercise,
            reps: v.reps,
            weight: v.weight,
            date: v.submittedAt || v.createdAt,
            points: v.value || 0,
            status: v.status,
            approved: v.status === 'approved',
            type: 'challenge',
            challengeTitle: v.challenge?.title,
            blurStatus: v.blurStatus || 'none',
            blurStartedAt: v.blurStartedAt,
            blurCompletedAt: v.blurCompletedAt,
            blurError: v.blurError,
          })));
        }

        allVideos.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allVideos.length === 0) {
          const localVideos = await getWorkoutVideos();
          allVideos = localVideos.map(v => ({
            ...v,
            id: v.id || v._id || v.serverId || v.uri,
            status: v.status || 'pending',
            type: 'workout',
          }));
        }
        setWorkoutVideos(allVideos);
      } else if (userId) {
        const response = await api.getUserVideos(userId);
        if (response.success && response.data) {
          setWorkoutVideos(response.data.map(v => ({
            id: v.id || v._id || v.serverId || v.videoUrl || v.videoUri,
            serverId: v.id || v._id || v.serverId,
            uri: v.videoUrl,
            exercise: v.exercise,
            reps: v.reps,
            weight: v.weight,
            date: v.submittedAt || v.createdAt,
            points: v.type === 'challenge' ? (v.value || 0) : ((v.reps || 0) * 10),
            status: v.status,
            approved: v.status === 'approved',
            type: v.type,
          })));
        } else {
          setWorkoutVideos([]);
        }
      }
    } catch (err) {
      if (!isViewingOtherUser) {
        const videos = await getWorkoutVideos();
        setWorkoutVideos(videos);
      } else {
        setWorkoutVideos([]);
      }
    }
  }, [isViewingOtherUser, userId]);

  useFocusEffect(useCallback(() => { loadWorkoutVideos(); }, [loadWorkoutVideos]));
  useEffect(() => { if (refreshKey > 0) loadWorkoutVideos(); }, [refreshKey, loadWorkoutVideos]);

  useEffect(() => {
    let isCancelled = false;
    const generateThumbnails = async () => {
      const pendingVideos = workoutVideos.filter((video) => {
        if (!video?.uri || videoThumbnails[video.id] || thumbnailRequestsRef.current.has(video.id)) return false;
        return true;
      });

      for (const video of pendingVideos) {
        thumbnailRequestsRef.current.add(video.id);
        try {
          if (VideoThumbnails) {
            const { uri } = await VideoThumbnails.getThumbnailAsync(video.uri, { time: 500 });
            if (!isCancelled && uri) setVideoThumbnails(prev => ({ ...prev, [video.id]: uri }));
          }
        } catch (error) {}
      }
    };
    generateThumbnails();
    return () => { isCancelled = true; };
  }, [workoutVideos, videoThumbnails]);

  const loadInviteCodes = useCallback(async () => {
    if (isViewingOtherUser) return;
    setLoadingInviteCodes(true);
    try {
      const response = await api.getMyInviteCodes();
      if (response.success && response.data) {
        setInviteCodes(response.data.inviteCodes || []);
        setInviteLimits({
          maxInviteCodes: response.data.maxInviteCodes ?? 3,
          remainingInviteCodes: response.data.remainingInviteCodes ?? 0,
          isUnlimitedInvites: response.data.isUnlimitedInvites === true,
        });
      }
    } catch (error) {} 
    finally { setLoadingInviteCodes(false); }
  }, [isViewingOtherUser]);

  useEffect(() => {
    if (showSettingsModal && !isViewingOtherUser) loadInviteCodes().catch(() => {});
  }, [showSettingsModal, isViewingOtherUser, loadInviteCodes]);

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const handleEditProfile = () => {
    setEditName(viewedUser?.name || '');
    setEditBio(viewedUser?.bio || '');
    setEditRegion(viewedUser?.region || 'Global');
    setEditGoal(viewedUser?.goal || 'Hypertrophy');
    setEditProfileImage(viewedUser?.profileImage || null);
    setEditFitnessLevel(viewedUser?.fitnessLevel || 'beginner');
    setEditWorkoutFrequency(viewedUser?.workoutFrequency || '3-4');
    setEditPreferredDays(viewedUser?.preferredDays || []);
    setEditAge(viewedUser?.age ? String(viewedUser.age) : '');

    let w = viewedUser?.weight;
    if (w && weightUnit === 'lbs') w = Math.round(w * 2.20462);
    setEditWeight(w ? String(w) : '');

    let h = viewedUser?.height;
    if (h && heightUnit === 'ft') h = (h * 0.0328084).toFixed(2);
    setEditHeight(h ? String(h) : '');

    setShowSettingsModal(false);
    setShowEditProfileModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditProfileModal(false);
    resetEditForm();
    // Small delay to let the modal animation complete before re-opening settings
    setTimeout(() => setShowSettingsModal(true), 100);
  };

  const resetEditForm = () => {
    setEditName('');
    setEditBio('');
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      return showAlert({ title: 'ERROR', message: 'DISPLAY NAME IS REQUIRED.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }

    if (!editWeight || !parseFloat(editWeight) || parseFloat(editWeight) <= 0) {
      return showAlert({ title: 'WEIGHT REQUIRED', message: 'WEIGHT IS REQUIRED FOR COMPETITION FEATURES. ENTER YOUR WEIGHT.', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
    }

    setSavingProfile(true);
    try {
      const updates = {
        name: editName.trim(),
        bio: editBio.trim(),
        region: editRegion,
        goal: editGoal,
        fitnessLevel: editFitnessLevel,
        workoutFrequency: editWorkoutFrequency,
        preferredDays: editPreferredDays,
      };

      if (editProfileImage && editProfileImage !== viewedUser?.profileImage) updates.profileImage = editProfileImage;

      let w = parseFloat(editWeight);
      if (!isNaN(w) && w > 0) {
        if (weightUnit === 'lbs') w = w / 2.20462;
        updates.weight = Math.round(w * 10) / 10;
      }

      if (editHeight) {
        let h = parseFloat(editHeight);
        if (!isNaN(h)) {
          if (heightUnit === 'ft') h = h / 0.0328084;
          updates.height = Math.round(h);
        }
      }

      if (editAge) {
        const a = parseInt(editAge);
        if (!isNaN(a)) updates.age = a;
      }

      const result = await updateUserProfile(updates);
      if (result.success) {
        setViewedUser(result.data);
        setRefreshKey(prev => prev + 1);
        setShowEditProfileModal(false);
        // Small delay to let the modal animation complete before re-opening settings
        setTimeout(() => setShowSettingsModal(true), 100);
        showAlert({ title: 'SUCCESS', message: 'PROFILE UPDATED SUCCESSFULLY.', icon: 'success', buttons: [{ text: 'OK', style: 'default' }] });
      } else {
        showAlert({ title: 'ERROR', message: 'FAILED TO UPDATE PROFILE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
      }
    } catch (e) {
      showAlert({ title: 'ERROR', message: 'FAILED TO UPDATE PROFILE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeProfilePicture = async () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        async (buttonIndex) => {
          if (buttonIndex === 0) await handleTakePhoto();
          else if (buttonIndex === 1) await handleChooseFromLibrary();
        }
      );
    } else {
      showAlert({
        title: 'CHANGE PROFILE PICTURE',
        message: 'CHOOSE HOW TO ADD YOUR PHOTO',
        buttons: [
          { text: 'CAMERA', style: 'default', onPress: handleTakePhoto },
          { text: 'GALLERY', style: 'default', onPress: handleChooseFromLibrary },
        ]
      });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'PERMISSION REQUIRED', message: 'GRANT CAMERA PERMISSION TO PROCEED.', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) await uploadProfilePicture(result.assets[0].base64);
    } catch (error) {
      showAlert({ title: 'ERROR', message: 'FAILED TO TAKE PHOTO.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'PERMISSION REQUIRED', message: 'GRANT PHOTO LIBRARY PERMISSION TO PROCEED.', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) await uploadProfilePicture(result.assets[0].base64);
    } catch (error) {
      showAlert({ title: 'ERROR', message: 'FAILED TO SELECT IMAGE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  };

  const uploadProfilePicture = async (base64) => {
    setUploadingProfilePicture(true);
    try {
      const base64Image = `data:image/jpeg;base64,${base64}`;
      const updateResult = await updateUserProfile({ profileImage: base64Image });
      if (updateResult.success) {
        setViewedUser(updateResult.data);
        await refreshUser();
        showAlert({ title: 'SUCCESS', message: 'PROFILE PICTURE UPDATED.', icon: 'success', buttons: [{ text: 'OK', style: 'default' }] });
      } else {
        throw new Error(updateResult.error || 'Failed to update profile picture');
      }
    } catch (error) {
      showAlert({ title: 'UPLOAD FAILED', message: error.message || 'FAILED TO UPDATE PROFILE PICTURE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const handleDeleteVideo = (video) => {
    showAlert({
      title: 'DELETE EVIDENCE',
      message: 'THIS ACTION IS PERMANENT. DELETE THIS LOG?',
      icon: 'warning',
      buttons: [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: async () => {
          try {
            await deleteWorkoutVideo(video.id, video.serverId, video.type);
            setRefreshKey(prev => prev + 1);
          } catch (e) {
            showAlert({ title: 'ERROR', message: 'FAILED TO DELETE LOG.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
          }
        }}
      ]
    });
  };

  const handleClearLocalVideos = async () => {
    showAlert({
      title: 'CLEAR CACHE',
      message: 'REMOVE LOCALLY CACHED DATA. SERVER DATA REMAINS INTACT.',
      icon: 'warning',
      buttons: [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'CLEAR', style: 'destructive', onPress: async () => {
            await clearAllLocalVideos();
            setRefreshKey(prev => prev + 1);
        }}
      ]
    });
  };

  const handleShareInviteCode = async (code) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await Share.share({ message: `Join me on UNYIELD. Use this invite code: ${code}` });
    } catch (error) {
      showAlert({ title: 'ERROR', message: 'COULD NOT OPEN SHARING OPTIONS.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  };

  const handleGenerateInviteCode = async () => {
    if (generatingInviteCode || (!inviteLimits.isUnlimitedInvites && inviteLimits.remainingInviteCodes <= 0)) return;
    setGeneratingInviteCode(true);
    try {
      const response = await api.generateInviteCode();
      if (response.success && response.data?.inviteCode?.code) {
        const code = response.data.inviteCode.code;
        await loadInviteCodes();
        showAlert({
          title: 'INVITE CODE READY',
          message: `SHARE THIS CODE: ${code}`,
          icon: 'success',
          buttons: [
            { text: 'SHARE', style: 'default', onPress: () => handleShareInviteCode(code) },
            { text: 'DONE', style: 'default' },
          ],
        });
        return;
      }
      throw new Error('Failed to generate invite code');
    } catch (error) {
      showAlert({ title: 'ERROR', message: error.message || 'COULD NOT GENERATE INVITE CODE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setGeneratingInviteCode(false);
    }
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: 'DELETE ACCOUNT',
      message: 'THIS IS PERMANENT. ALL DATA WILL BE LOST.',
      icon: 'warning',
      buttons: [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: async () => { await deleteAccount(); }}
      ]
    });
  };

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);

  const handleQuickChangeGoal = () => setShowGoalModal(true);
  const handleSelectGoal = async (goal) => {
    setShowGoalModal(false);
    const res = await updateUserProfile({ goal });
    if(res.success) {
      setViewedUser(prev => ({ ...prev, goal }));
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleQuickChangeRegion = () => setShowRegionModal(true);
  const handleSelectRegion = async (region) => {
    setShowRegionModal(false);
    const res = await updateUserProfile({ region });
    if(res.success) {
      setViewedUser(prev => ({ ...prev, region }));
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleManageAccolades = () => setShowAccoladePicker(true);
  const handleAdminEditProfile = () => setShowAdminEditModal(true);
  const handleUserUpdated = (updatedUser) => {
    setViewedUser(prev => ({ ...prev, ...updatedUser }));
    setRefreshKey(prev => prev + 1);
  };

  const handleChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswords(false);
    setShowChangePasswordModal(true);
    setShowSettingsModal(false);
  };

  const handleClosePasswordModal = () => {
    setShowChangePasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    // Small delay to let the modal animation complete before re-opening settings
    setTimeout(() => setShowSettingsModal(true), 100);
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('ALL FIELDS ARE REQUIRED');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('NEW PASSWORD MUST BE AT LEAST 6 CHARACTERS');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('NEW PASSWORDS DO NOT MATCH');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('NEW PASSWORD MUST BE DIFFERENT');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');

    try {
      const response = await api.changePassword(currentPassword, newPassword);
      if (response.success) {
        setShowChangePasswordModal(false);
        // Small delay to let the modal animation complete before re-opening settings
        setTimeout(() => setShowSettingsModal(true), 100);
        showAlert({ title: 'SUCCESS', message: 'PASSWORD CHANGED SUCCESSFULLY.', icon: 'success', buttons: [{ text: 'OK', style: 'default' }] });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setPasswordError(error.message || 'FAILED TO CHANGE PASSWORD');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loadingProfile || !viewedUser) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#b91c1c" />
      </View>
    );
  }

  const displayName = viewedUser?.name || viewedUser?.username || 'OPERATOR';
  const handle = viewedUser?.username ? `@${viewedUser.username}` : '@' + displayName.toLowerCase().replace(/\s/g, '_');
  const workouts = viewedUser?.logs?.length || 0;
  const points = viewedUser?.totalPoints || 0;
  const streak = viewedUser?.streak || 0;
  const bio = viewedUser?.bio || '';

  const formatPoints = (p) => p >= 1000 ? (p / 1000).toFixed(1) + 'K' : p.toString();

  const userTier = getUserTier(points);
  const tierProgress = getTierProgress(points);
  const bestStreak = viewedUser?.streakBest || 0;

  const userAccolades = viewedUser?.accolades || [];
  const accoladeConfig = {
    admin: { label: 'ADMIN', color: '#9b2c2c', icon: 'shield' },
    community_support: { label: 'SUPPORT', color: '#3B82F6', icon: 'people' },
    beta: { label: 'BETA TESTER', color: '#8B5CF6', icon: 'flask' },
    staff: { label: 'STAFF', color: '#10B981', icon: 'construct' },
    verified_athlete: { label: 'VERIFIED ATHLETE', color: '#F59E0B', icon: 'checkmark-circle' },
    founding_member: { label: 'FOUNDER', color: '#D4AF37', icon: 'star' },
    challenge_master: { label: 'CHALLENGE MASTER', color: '#6366F1', icon: 'trophy' },
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="PROFILE"
        subtitle={isOwnProfile ? "PERSONNEL FILE" : "INTEL DOSSIER"}
        showBackButton={true}
        onBackPress={handleBack}
        rightAction={!isOwnProfile && isAdmin ? (
          <View style={styles.adminActions}>
            <TouchableOpacity onPress={handleAdminEditProfile} style={styles.adminActionBtn} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleManageAccolades} style={styles.adminActionBtn} activeOpacity={0.8}>
              <Ionicons name="shield-checkmark" size={20} color="#b91c1c" />
            </TouchableOpacity>
          </View>
        ) : isOwnProfile ? (
          <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="settings-sharp" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={isOwnProfile ? handleChangeProfilePicture : undefined}
            activeOpacity={isOwnProfile ? 0.8 : 1}
            disabled={!isOwnProfile}
          >
            {viewedUser?.profileImage ? (
              <Image source={{ uri: viewedUser.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{displayName.substring(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <Image source={userTier.image} style={styles.tierBadgeImage} resizeMode="contain" />
            {isOwnProfile && (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.userName}>{displayName.toUpperCase()}</Text>
          <Text style={styles.userHandle}>{handle.toUpperCase()}</Text>

          {userAccolades.length > 0 && (
            <View style={styles.accoladesContainer}>
              {userAccolades.map(accolade => {
                const config = accoladeConfig[accolade];
                if (!config) return null;
                return (
                  <View key={accolade} style={[styles.accoladeBadge, { borderColor: config.color }]}>
                    <Ionicons name={config.icon} size={10} color={config.color} />
                    <Text style={[styles.accoladeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.bioSection}>
             {bio ? (
               <Text style={styles.bioText}>{bio.toUpperCase()}</Text>
             ) : isOwnProfile ? (
               <TouchableOpacity onPress={handleEditProfile} activeOpacity={0.8}>
                 <Text style={styles.bioPlaceholder}>[ ADD BIO ]</Text>
               </TouchableOpacity>
             ) : null}
          </View>
        </View>

        {/* Progress Panel - HUD Style */}
        <View style={styles.tacticalDataBlock}>
          <View style={styles.progressHeader}>
            <View style={styles.tierInfo}>
              <Image source={userTier.image} style={styles.progressTierImage} resizeMode="contain" />
              <View>
                <Text style={[styles.tierName, { color: userTier.color }]}>{userTier.name.toUpperCase()}</Text>
                <Text style={styles.tierPoints}>{formatPoints(points)} XP</Text>
              </View>
            </View>
            {tierProgress.nextTier ? (
              <Text style={styles.nextTierLabel}>
                [{tierProgress.current.toLocaleString()} / {tierProgress.target.toLocaleString()}]
              </Text>
            ) : (
              <Text style={styles.maxTierLabel}>[ MAX TIER ]</Text>
            )}
          </View>
          <View style={styles.hudProgressTrackOuter}>
            <View style={styles.hudProgressTrackInner}>
              <View
                style={[
                  styles.hudProgressFill,
                  { width: `${tierProgress.percentage}%`, backgroundColor: userTier.color }
                ]}
              />
            </View>
          </View>
        </View>

        {/* Stats Matrix */}
        <View style={[styles.tacticalDataBlock, styles.statsMatrix]}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{workouts}</Text>
            <Text style={styles.statLabel}>LOGS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#b91c1c' }]}>{formatPoints(points)}</Text>
            <Text style={styles.statLabel}>MERIT</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.streakRow}>
              <Ionicons name="flame" size={16} color="#ff4500" />
              <Text style={[styles.statVal, { color: '#ff4500' }]}>{streak}</Text>
            </View>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#D4AF37' }]}>{bestStreak}</Text>
            <Text style={styles.statLabel}>BEST</Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
           <TouchableOpacity 
             style={styles.infoCard} 
             onPress={isOwnProfile ? handleQuickChangeRegion : null} 
             activeOpacity={isOwnProfile ? 0.8 : 1}
           >
              <View style={styles.infoIconContainer}>
                <Ionicons name="location" size={18} color="#b91c1c" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>REGION</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{(viewedUser?.region || 'UNKNOWN').toUpperCase()}</Text>
              </View>
           </TouchableOpacity>

           <TouchableOpacity
             style={styles.infoCard}
             onPress={isOwnProfile ? handleQuickChangeGoal : null}
             activeOpacity={isOwnProfile ? 0.8 : 1}
           >
              <View style={styles.infoIconContainer}>
                <Ionicons name="flag" size={18} color="#b91c1c" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>OBJECTIVE</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{(viewedUser?.goal || 'CLASSIFIED').toUpperCase()}</Text>
              </View>
           </TouchableOpacity>

           <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="barbell" size={18} color="#b91c1c" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>WEIGHT</Text>
                <Text style={styles.infoValue}>
                  {viewedUser?.weight
                    ? (weightUnit === 'lbs'
                        ? `${Math.round(viewedUser.weight * 2.20462)} LBS`
                        : `${viewedUser.weight} KG`)
                    : '--'
                  }
                </Text>
              </View>
           </View>

           <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="resize" size={18} color="#b91c1c" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>HEIGHT</Text>
                <Text style={styles.infoValue}>
                  {viewedUser?.height
                    ? (heightUnit === 'ft'
                        ? `${(viewedUser.height * 0.0328084).toFixed(1)} FT`
                        : `${viewedUser.height} CM`)
                    : '--'
                  }
                </Text>
              </View>
           </View>
        </View>

        {/* Workout Videos Section */}
        {workoutVideos.length > 0 && (
          <View style={styles.videosSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>EVIDENCE LOG</Text>
              <Text style={styles.sectionCount}>[{workoutVideos.length}]</Text>
            </View>

            <View style={styles.videosGrid}>
              {workoutVideos.map((video, index) => {
                const thumbnailUri = video.thumbnailUrl || videoThumbnails[video.id];
                const videoKey = video.id || video.serverId || video.uri || `video-${index}`;
                return (
                  <TouchableOpacity
                    key={videoKey}
                    style={styles.videoCard}
                    onPress={() => setSelectedVideo(video)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.videoThumbnail}>
                      {thumbnailUri ? (
                        <Image source={{ uri: thumbnailUri }} style={styles.videoThumbnailImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.videoThumbnailFallback}>
                          <Ionicons name="videocam" size={24} color="#333" />
                        </View>
                      )}
                      <View style={styles.videoOverlay}>
                         <View style={styles.videoStatus}>
                            {video.approved ? (
                                <Ionicons name="checkmark-sharp" size={14} color="#10B981" />
                            ) : video.status === 'rejected' ? (
                                <Ionicons name="close-sharp" size={14} color="#ff003c" />
                            ) : (
                                <Ionicons name="time-sharp" size={14} color="#F59E0B" />
                            )}
                         </View>
                         {/* Blur Status Indicator */}
                         {video.type === 'challenge' && video.blurStatus !== 'none' && (
                           <View style={styles.videoStatus}>
                             {video.blurStatus === 'processing' && (
                               <>
                                   <Ionicons name="time-sharp" size={14} color="#F59E0B" />
                                 </>
                               )}
                             {video.blurStatus === 'blurred' && (
                               <>
                                   <Ionicons name="checkmark-sharp" size={14} color="#10B981" />
                                 </>
                               )}
                             {video.blurStatus === 'failed' && (
                               <>
                                   <Ionicons name="alert-circle-sharp" size={14} color="#ff003c" />
                                 </>
                               )}
                           </View>
                         )}
                      </View>
                      {isOwnProfile && (
                        <TouchableOpacity
                          style={styles.videoDeleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(video);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash" size={14} color="#ff003c" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.videoExercise} numberOfLines={1}>{video.exercise.toUpperCase()}</Text>
                    <Text style={styles.videoMeta}>{video.reps}X • +{video.points} XP</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
          <TouchableOpacity style={styles.brutalistSheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>SYSTEM SETTINGS</Text>

            <ScrollView style={styles.settingsScroll} showsVerticalScrollIndicator={false}>
              {(userAccolades.includes('admin') || userAccolades.includes('community_support')) && (
                  <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => { setShowSettingsModal(false); navigation.navigate('AdminDashboard'); }}>
                      <Ionicons name="shield" size={20} color="#b91c1c" />
                      <Text style={[styles.settingText, { color: '#b91c1c' }]}>ADMIN PANEL</Text>
                  </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={handleEditProfile}>
                 <Ionicons name="person" size={20} color="#fff" />
                 <Text style={styles.settingText}>EDIT PROFILE</Text>
              </TouchableOpacity>

              {isOwnProfile && (
                <>
                  <TouchableOpacity
                    style={styles.settingItem}
                    activeOpacity={0.8}
                    onPress={handleGenerateInviteCode}
                    disabled={generatingInviteCode || (!inviteLimits.isUnlimitedInvites && inviteLimits.remainingInviteCodes <= 0)}
                  >
                    <Ionicons
                      name="ticket"
                      size={20}
                      color={inviteLimits.isUnlimitedInvites || inviteLimits.remainingInviteCodes > 0 ? '#fff' : '#333'}
                    />
                    <View style={styles.settingTextWrap}>
                      <Text style={[styles.settingText, (!inviteLimits.isUnlimitedInvites && inviteLimits.remainingInviteCodes <= 0) && { color: '#666' }]}>
                        GENERATE INVITE
                      </Text>
                      <Text style={styles.settingSubText}>
                        {inviteLimits.isUnlimitedInvites
                          ? 'UNLIMITED (ADMIN)'
                          : `[${inviteLimits.remainingInviteCodes}/${inviteLimits.maxInviteCodes}] REMAINING`}
                      </Text>
                    </View>
                    {generatingInviteCode ? (
                      <ActivityIndicator color="#b91c1c" />
                    ) : (
                      <Ionicons
                        name="add-sharp"
                        size={24}
                        color={inviteLimits.isUnlimitedInvites || inviteLimits.remainingInviteCodes > 0 ? '#b91c1c' : '#333'}
                      />
                    )}
                  </TouchableOpacity>

                  <View style={styles.inviteCodesList}>
                    {loadingInviteCodes ? (
                      <ActivityIndicator color="#b91c1c" />
                    ) : inviteCodes.length > 0 ? (
                      inviteCodes.map((invite) => (
                        <View key={invite.id} style={styles.inviteCodeRow}>
                          <View style={styles.inviteCodeMain}>
                            <Text style={styles.inviteCodeText}>{invite.code}</Text>
                            <Text style={[styles.inviteCodeStatus, invite.isUsed && styles.inviteCodeStatusUsed]}>
                              {invite.isUsed ? 'USED' : 'READY'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleShareInviteCode(invite.code)}
                            disabled={invite.isUsed}
                            style={styles.inviteShareButton}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="share-social" size={16} color={invite.isUsed ? '#333' : '#fff'} />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.inviteEmptyText}>NO INVITE CODES GENERATED.</Text>
                    )}
                  </View>
                </>
              )}

              {viewedUser?.provider === 'email' && (
              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={handleChangePassword}>
                 <Ionicons name="lock-closed" size={20} color="#fff" />
                 <Text style={styles.settingText}>CHANGE PASSWORD</Text>
              </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={toggleWeightUnit}>
                 <Ionicons name="scale" size={20} color="#fff" />
                 <Text style={styles.settingText}>UNIT: {weightUnit.toUpperCase()}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.8}
                onPress={() => { setShowSettingsModal(false); navigation.navigate('Notifications'); }}
              >
                 <Ionicons name="notifications" size={20} color="#fff" />
                 <Text style={styles.settingText}>NOTIFICATION CENTER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.8}
                onPress={() => { setShowSettingsModal(false); navigation.navigate('NotificationSettings'); }}
              >
                 <Ionicons name="options" size={20} color="#fff" />
                 <Text style={styles.settingText}>NOTIFICATION SETTINGS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.8}
                onPress={() => { setShowSettingsModal(false); setShowTutorial(true); }}
              >
                 <Ionicons name="help-circle" size={20} color="#fff" />
                 <Text style={styles.settingText}>TUTORIAL</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={handleClearLocalVideos}>
                 <Ionicons name="trash" size={20} color="#fff" />
                 <Text style={styles.settingText}>CLEAR CACHE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => navigation.navigate('DebugNotifications')}>
                 <Ionicons name="bug" size={20} color="#8b0000" />
                 <Text style={[styles.settingText, { color: '#8b0000' }]}>DEBUG NOTIFICATIONS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={signOut}>
                 <Ionicons name="log-out" size={20} color="#ff0000" />
                 <Text style={[styles.settingText, { color: '#ff0000' }]}>SIGN OUT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={handleDeleteAccount}>
                 <Ionicons name="warning" size={20} color="#666" />
                 <Text style={[styles.settingText, { color: '#666' }]}>DELETE ACCOUNT</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseEditModal}>
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
                <TouchableOpacity onPress={handleCloseEditModal} activeOpacity={0.8}>
                    <Text style={styles.editModalCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <Text style={styles.editModalTitle}>EDIT PROFILE</Text>
                <TouchableOpacity onPress={handleSaveProfile} disabled={savingProfile} activeOpacity={0.8}>
                    {savingProfile ? <ActivityIndicator color="#b91c1c" /> : <Text style={styles.editModalSaveText}>SAVE</Text>}
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.editModalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.formCard}>
                    <Text style={styles.cardLabel}>PUBLIC INFO</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                        <TextInput style={styles.modernInput} value={editName} onChangeText={setEditName} placeholder="ENTER NAME" placeholderTextColor="#555" />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>BIO</Text>
                        <TextInput style={[styles.modernInput, styles.textArea]} value={editBio} onChangeText={setEditBio} placeholder="ENTER BIO" placeholderTextColor="#555" multiline />
                    </View>
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.cardLabel}>STATS</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statInputWrap}>
                            <Text style={styles.statInputLabel}>WEIGHT ({weightUnit.toUpperCase()})</Text>
                            <TextInput style={styles.statInput} value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad" placeholder="--" placeholderTextColor="#555" />
                        </View>
                        <View style={styles.statInputWrap}>
                            <Text style={styles.statInputLabel}>HEIGHT ({(heightUnit || 'cm').toUpperCase()})</Text>
                            <TextInput style={styles.statInput} value={editHeight} onChangeText={setEditHeight} keyboardType="decimal-pad" placeholder="--" placeholderTextColor="#555" />
                        </View>
                    </View>
                </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePasswordModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClosePasswordModal}>
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <TouchableOpacity onPress={handleClosePasswordModal} activeOpacity={0.8}>
                <Text style={styles.editModalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <Text style={styles.editModalTitle}>CHANGE PASSWORD</Text>
              <TouchableOpacity onPress={handleSavePassword} disabled={changingPassword} activeOpacity={0.8}>
                {changingPassword ? <ActivityIndicator color="#b91c1c" /> : <Text style={styles.editModalSaveText}>SAVE</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.formCard}>
                <Text style={styles.cardLabel}>SECURITY</Text>

                {passwordError ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert" size={16} color="#ff0000" />
                    <Text style={styles.errorText}>{passwordError.toUpperCase()}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.modernInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="ENTER CURRENT PASSWORD"
                      placeholderTextColor="#555"
                      secureTextEntry={!showPasswords}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPasswords(!showPasswords)}>
                      <Ionicons name={showPasswords ? "eye-off" : "eye"} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.modernInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="ENTER NEW PASSWORD"
                      placeholderTextColor="#555"
                      secureTextEntry={!showPasswords}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.modernInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="RE-ENTER NEW PASSWORD"
                      placeholderTextColor="#555"
                      secureTextEntry={!showPasswords}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={16} color="#666" />
                  <Text style={styles.infoText}>MINIMUM 6 CHARACTERS REQUIRED</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Goal Selection Modal */}
      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGoalModal(false)}>
          <View style={styles.brutalistSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>SELECT OBJECTIVE</Text>
            {GOALS.map(goal => (
              <TouchableOpacity key={goal} style={styles.selectionItem} activeOpacity={0.8} onPress={() => handleSelectGoal(goal)}>
                <Text style={[styles.selectionText, viewedUser?.goal === goal && styles.selectionTextActive]}>
                  {goal.toUpperCase()}
                </Text>
                {viewedUser?.goal === goal && <Ionicons name="checkmark-sharp" size={20} color="#b91c1c" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Region Selection Modal */}
      <Modal visible={showRegionModal} transparent animationType="fade" onRequestClose={() => setShowRegionModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRegionModal(false)}>
          <View style={styles.brutalistSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>SELECT REGION</Text>
            {REGIONS.map(region => (
              <TouchableOpacity key={region} style={styles.selectionItem} activeOpacity={0.8} onPress={() => handleSelectRegion(region)}>
                <Text style={[styles.selectionText, viewedUser?.region === region && styles.selectionTextActive]}>
                  {region.toUpperCase()}
                </Text>
                {viewedUser?.region === region && <Ionicons name="checkmark-sharp" size={20} color="#b91c1c" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Video Modal */}
      <Modal visible={selectedVideo !== null} animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        <View style={styles.videoModalContainer}>
          <TouchableOpacity style={styles.videoModalClose} onPress={() => setSelectedVideo(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedVideo && (
            <Video source={{ uri: selectedVideo.uri }} style={styles.fullScreenVideo} useNativeControls resizeMode="contain" shouldPlay />
          )}
        </View>
      </Modal>

      {/* Uploading Progress Overlay */}
      {uploadingProfilePicture && (
        <Modal visible={uploadingProfilePicture} transparent animationType="fade">
          <View style={styles.uploadLoadingOverlay}>
            <View style={styles.uploadLoadingCard}>
              <ActivityIndicator size="large" color="#b91c1c" />
              <Text style={styles.uploadLoadingText}>UPLOADING IMAGE...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Shared Components */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />

      {!isOwnProfile && isAdmin && (
        <>
          <AccoladePickerModal
            visible={showAccoladePicker}
            onClose={() => setShowAccoladePicker(false)}
            userId={viewedUser?.id || viewedUser?._id}
            currentAccolades={viewedUser?.accolades || []}
            onAccoladesUpdated={handleUserUpdated}
            api={api}
          />
          <AdminProfileEditModal
            visible={showAdminEditModal}
            onClose={() => setShowAdminEditModal(false)}
            user={viewedUser}
            onUserUpdated={handleUserUpdated}
            api={api}
          />
        </>
      )}

      <TutorialModal topic={tutorialTopic} visible={showTutorial} onClose={() => setShowTutorial(false)} />
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Gritty Gym Industrial HUD
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505' // Abyss black
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#161616',
    borderWidth: 2,
    borderColor: '#333333'
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8
  },
  adminActionBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#161616',
    borderWidth: 2,
    borderColor: '#333333'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    alignSelf: 'center',
    width: CONTENT_WIDTH,
    maxWidth: MAX_CONTENT_WIDTH
  },

  // --- Hero Section ---
  profileHero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20
  },
  avatarContainer: {
    marginBottom: 16
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 20, // Smooth armor curve
    borderWidth: 3,
    borderColor: '#333333',
    backgroundColor: '#121212'
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '900',
    color: '#666666',
    letterSpacing: 2
  },
  tierBadgeImage: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#050505',
    backgroundColor: '#121212'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    backgroundColor: '#b91c1c',
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#050505'
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 4
  },
  userHandle: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // --- Bio & Accolades ---
  bioSection: {
    marginTop: 16,
    paddingHorizontal: 32
  },
  bioText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 1
  },
  bioPlaceholder: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555555',
    letterSpacing: 1
  },
  accoladesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16
  },
  accoladeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    borderWidth: 2,
    backgroundColor: '#121212'
  },
  accoladeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // --- Tactical Data Blocks ---
  tacticalDataBlock: {
    backgroundColor: '#161616',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16, // Smooth armor curve
    padding: 16,
    borderTopWidth: 2,
    borderTopColor: '#333333',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },

  // --- HUD Progress Panel ---
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  progressTierImage: {
    width: 44,
    height: 44
  },
  tierName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tierPoints: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 1
  },
  nextTierLabel: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '800',
    letterSpacing: 1.5
  },
  maxTierLabel: {
    fontSize: 10,
    color: '#D4AF37',
    fontWeight: '900',
    letterSpacing: 1.5
  },
  // HUD Nested Progress Track (Armor > Slot > Fill)
  hudProgressTrackOuter: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#0a0a0a'
  },
  hudProgressTrackInner: {
    height: 6,
    backgroundColor: '#161616',
    borderRadius: 999,
    overflow: 'hidden'
  },
  hudProgressFill: {
    height: '100%',
    borderRadius: 999
  },

  // --- Stats Matrix ---
  statsMatrix: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 8,
    padding: 16
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.5
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#333333'
  },

  // --- Info Grid (Tactical Cards) ---
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
    justifyContent: 'space-between'
  },
  infoCard: {
    width: IS_WIDE_SCREEN ? '48%' : (CONTENT_WIDTH - 44) / 2,
    minWidth: 150,
    backgroundColor: '#161616',
    padding: 14,
    borderRadius: 16, // Smooth armor curve
    borderTopWidth: 2,
    borderTopColor: '#333333',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12, // Smooth curve
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#333333'
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#666666',
    marginBottom: 2,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },

  // --- Evidence Log (Videos) ---
  videosSection: {
    paddingHorizontal: 16,
    marginTop: 32
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#555555',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 1
  },
  videosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    justifyContent: 'flex-start'
  },
  videoCard: {
    width: IS_WIDE_SCREEN ? '31%' : (CONTENT_WIDTH - 32 - 24) / 3,
    minWidth: 100,
    maxWidth: 140,
    marginHorizontal: 4,
    marginBottom: 16
  },
  videoThumbnail: {
    aspectRatio: 1,
    backgroundColor: '#121212',
    borderRadius: 12, // Smooth curve
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#333333'
  },
  videoThumbnailImage: {
    width: '100%',
    height: '100%'
  },
  videoThumbnailFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  videoOverlay: {
    position: 'absolute',
    top: 6,
    left: 6
  },
  videoStatus: {
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333'
  },
  videoDeleteButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff003c'
  },
  videoExercise: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f5f5f5',
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  videoMeta: {
    fontSize: 9,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1
  },

  // --- Settings & Selection Modals (Brutalist Sheets) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.92)',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  brutalistSheet: {
    backgroundColor: '#121212',
    borderTopWidth: 3,
    borderTopColor: '#333333',
    padding: 24,
    maxHeight: '80%',
    width: IS_WIDE_SCREEN ? MAX_CONTENT_WIDTH : '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    borderRadius: 20, // Top corners smooth
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  settingsScroll: {
    flexGrow: 0
  },
  sheetHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#666666',
    marginBottom: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 16
  },
  settingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1
  },
  settingTextWrap: {
    flex: 1
  },
  settingSubText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    marginTop: 4,
    letterSpacing: 1
  },
  inviteCodesList: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 12
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  inviteCodeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  inviteCodeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2
  },
  inviteCodeStatus: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '900',
    letterSpacing: 1.5
  },
  inviteCodeStatusUsed: {
    color: '#666666'
  },
  inviteShareButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333333'
  },
  inviteEmptyText: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 8,
    letterSpacing: 1
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  selectionTextActive: {
    color: '#ffffff'
  },

  // --- Edit Profile / Password Modals ---
  editModalContainer: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center'
  },
  editModalContent: {
    width: IS_WIDE_SCREEN ? MAX_CONTENT_WIDTH : '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flex: 1
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    backgroundColor: '#0a0a0a'
  },
  editModalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  editModalCancelText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },
  editModalSaveText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  editModalScroll: {
    flex: 1,
    padding: 16
  },
  formCard: {
    marginBottom: 24,
    backgroundColor: '#161616',
    padding: 16,
    borderRadius: 16,
    borderTopWidth: 2,
    borderTopColor: '#333333',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#666666',
    marginBottom: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888888',
    marginBottom: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  modernInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333333',
    padding: 16,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16
  },
  statInputWrap: {
    flex: 1
  },
  statInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888888',
    marginBottom: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333333',
    padding: 16,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5
  },

  // --- Video Player Modal ---
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center'
  },
  videoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333333'
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%'
  },

  // --- Error & Information Boxes ---
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0a0a',
    borderLeftWidth: 4,
    borderLeftColor: '#ff0000',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10
  },
  errorText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff0000',
    flex: 1,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  passwordInputContainer: {
    position: 'relative'
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 8
  },
  infoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    flex: 1,
    letterSpacing: 1
  },

  // --- Upload Loading Overlay ---
  uploadLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.92)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadLoadingCard: {
    backgroundColor: '#121212',
    padding: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#333333',
    alignItems: 'center',
    minWidth: 220
  },
  uploadLoadingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
