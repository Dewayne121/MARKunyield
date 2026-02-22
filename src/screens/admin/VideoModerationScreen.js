import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { Video } from 'expo-av';
import api from '../../services/api';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_TYPOGRAPHY,
  ADMIN_SHADOWS,
  ADMIN_SURFACES,
} from '../../constants/adminTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;
const T = ADMIN_TYPOGRAPHY;

// Filter options
const SOURCE_FILTERS = {
  all: { label: 'All', value: 'all', icon: 'grid' },
  workout: { label: 'Workouts', value: 'workout', icon: 'fitness' },
  challenge: { label: 'Challenges', value: 'challenge', icon: 'trophy' },
};

const DATE_FILTERS = {
  all: { label: 'All Time', value: 'all' },
  today: { label: 'Today', value: 'today' },
  week: { label: 'This Week', value: 'week' },
};

export default function VideoModerationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false); // Toggle for blurred/original
  const [rejectionReason, setRejectionReason] = useState('');
  const [pointsOverride, setPointsOverride] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [filterExercise, setFilterExercise] = useState('');
  const [debouncedExercise, setDebouncedExercise] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const videoRef = useRef(null);
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedExercise(filterExercise.trim());
    }, 400);

    return () => clearTimeout(handle);
  }, [filterExercise]);

  // Filter videos by date
  const filterByDate = (videos, dateFilter) => {
    if (dateFilter === 'all') return videos;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);

    return videos.filter(video => {
      const videoDate = new Date(video.createdAt || video.submittedAt || 0).getTime();
      if (dateFilter === 'today') {
        return videoDate >= todayStart;
      } else if (dateFilter === 'week') {
        return videoDate >= weekStart;
      }
      return true;
    });
  };

  // Filter videos by source
  const filterBySource = (videos, sourceFilter) => {
    if (sourceFilter === 'all') return videos;
    return videos.filter(video => video.source === sourceFilter);
  };

  const loadVideos = async () => {
    console.log('[VIDEO MODERATION] Loading videos...');
    try {
      setLoading(true);
      const params = {};
      if (debouncedExercise) {
        params.exercise = debouncedExercise;
      }
      console.log('[VIDEO MODERATION] Fetching pending videos with params:', params);

      const [response, challengeResponse] = await Promise.all([
        api.getAdminPendingVideos(params),
        api.getPendingChallengeSubmissions({ limit: 50 }).catch((error) => {
          console.warn('[VIDEO MODERATION] Challenge submissions unavailable:', error.message);
          return null;
        }),
      ]);

      console.log('[VIDEO MODERATION] Response:', {
        success: response.success,
        hasData: !!response.data,
        videoCount: response.data?.videos?.length || 0,
        total: response.data?.pagination?.total || 0
      });

      if (response.success && response.data) {
        console.log('[VIDEO MODERATION] Loaded', response.data.videos?.length || 0, 'videos');
        const workoutVideos = (response.data.videos || []).map((video) => ({
          ...video,
          id: video._id || video.id,
          source: 'workout',
        }));
        const challengeSubmissionsRaw = challengeResponse?.success ? (challengeResponse.data || []) : [];
        const challengeSubmissions = challengeSubmissionsRaw
          .filter((submission) => {
            if (!debouncedExercise) return true;
            return String(submission.exercise || '')
              .toLowerCase()
              .includes(debouncedExercise.toLowerCase());
          })
          .map((submission) => ({
            ...submission,
            id: submission.id || submission._id,
            source: 'challenge',
            createdAt: submission.submittedAt || submission.createdAt,
          }));
        let combined = [...workoutVideos, ...challengeSubmissions];
        // Apply source filter
        combined = filterBySource(combined, sourceFilter);
        // Apply date filter
        combined = filterByDate(combined, dateFilter);
        combined.sort((a, b) => {
          const aTime = new Date(a.createdAt || a.submittedAt || 0).getTime();
          const bTime = new Date(b.createdAt || b.submittedAt || 0).getTime();
          return aTime - bTime;
        });
        setVideos(combined);
      } else {
        console.error('[VIDEO MODERATION] Response not successful:', response);
        setVideos([]);
      }
    } catch (err) {
      console.error('[VIDEO MODERATION] Error loading videos:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to load videos',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      setVideos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [debouncedExercise, sourceFilter, dateFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVideos();
  };

  const handleVerifyWorkout = async (videoId, action, reason = '', pointsValue = null) => {
    console.log('[VIDEO MODERATION] handleVerifyWorkout called:', { videoId, action, reason, pointsValue });
    try {
      setVerifying(true);

      console.log('[VIDEO MODERATION] Calling adminVerifyVideo with:', { videoId, action, reason, pointsValue });

      const response = await api.adminVerifyVideo(videoId, action, reason, pointsValue);

      console.log('[VIDEO MODERATION] Verify response:', response);

      if (response.success) {
        // Remove the video from the list
        setVideos(prev => prev.filter(v => v.id !== videoId));
        setSelectedVideo(null);
        setPointsOverride('');

        // Handle orphan video case
        if (response.data?.deleted) {
          showAlert({
            title: 'Removed',
            message: response.message || 'Orphan video removed',
            icon: 'info',
            buttons: [{ text: 'OK', style: 'default' }]
          });
        } else {
          showAlert({
            title: 'Success',
            message: action === 'approve' ? 'Video approved successfully' : 'Video rejected',
            icon: 'success',
            buttons: [{ text: 'OK', style: 'default' }]
          });
        }
      } else {
        console.error('[VIDEO MODERATION] Verify failed:', response);
        showAlert({
          title: 'Error',
          message: response.error || 'Failed to verify video',
          icon: 'error',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (err) {
      console.error('[VIDEO MODERATION] Error verifying video:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to verify video',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyChallenge = async (submissionId, action, reason = '') => {
    console.log('[VIDEO MODERATION] handleVerifyChallenge called:', { submissionId, action, reason });
    try {
      setVerifying(true);
      const response = await api.verifyChallengeSubmission(submissionId, action, reason);
      if (response.success) {
        setVideos(prev => prev.filter(v => v.id !== submissionId));
        setSelectedVideo(null);
        setRejectionReason('');
        showAlert({
          title: 'Success',
          message: action === 'approve' ? 'Challenge entry approved' : 'Challenge entry rejected',
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      } else {
        showAlert({
          title: 'Error',
          message: response.error || 'Failed to verify challenge entry',
          icon: 'error',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (err) {
      console.error('[VIDEO MODERATION] Error verifying challenge submission:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to verify challenge entry',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleApprove = (video) => {
    const targetVideo = video || selectedVideo;
    console.log('[VIDEO MODERATION] handleApprove called with:', { videoId: targetVideo?.id, source: targetVideo?.source });

    if (!targetVideo) {
      showAlert({
        title: 'Error',
        message: 'No video selected',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }

    if (!targetVideo.id) {
      showAlert({
        title: 'Error',
        message: 'Video ID is missing',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }

    const videoId = targetVideo.id;
    const isChallenge = targetVideo.source === 'challenge';

    if (isChallenge) {
      showAlert({
        title: 'Approve Challenge Entry',
        message: 'Approve this challenge submission?',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Approve',
            style: 'default',
            onPress: () => {
              console.log('[VIDEO MODERATION] Approving challenge:', videoId);
              handleVerifyChallenge(videoId, 'approve');
            }
          },
        ]
      });
      return;
    }

    // For workout videos, go straight to auto approve or show points modal
    showAlert({
      title: 'Approve Video',
      message: 'Award points for this video?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => {
            console.log('[VIDEO MODERATION] Approving workout video:', videoId);
            handleVerifyWorkout(videoId, 'approve');
          },
        },
      ]
    });
  };

  const confirmApproveWithPoints = () => {
    if (!selectedVideo) {
      showAlert({
        title: 'Error',
        message: 'No video selected',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }
    setShowPointsModal(false);
    const pointsValue = pointsOverride ? parseInt(pointsOverride) : null;
    handleVerifyWorkout(selectedVideo.id, 'approve', '', pointsValue);
  };

  const handleReject = (video) => {
    const targetVideo = video || selectedVideo;
    if (!targetVideo) {
      showAlert({
        title: 'Error',
        message: 'No video selected',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }
    setSelectedVideo(targetVideo);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const confirmReject = () => {
    if (!selectedVideo) {
      showAlert({
        title: 'Error',
        message: 'No video selected',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }
    if (!rejectionReason.trim()) {
      showAlert({
        title: 'Required',
        message: 'Please provide a reason for rejection',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }
    setShowRejectionModal(false);
    if (selectedVideo.source === 'challenge') {
      handleVerifyChallenge(selectedVideo.id, 'reject', rejectionReason);
    } else {
      handleVerifyWorkout(selectedVideo.id, 'reject', rejectionReason);
    }
  };

  const VideoCard = ({ video, onPress }) => {
    const userName = String(video.user?.name || 'Unknown');
    const userHandle = video.user?.username ? String(`@${video.user.username}`) : '';
    const exerciseLabel = String(video.exercise || video.challenge?.title || 'Challenge Submission');
    const reps = Number(video.reps) || 0;
    const weight = Number(video.weight) || 0;
    const points = reps * 1.5 + weight * 0.1;
    const dateStr = video.createdAt || video.submittedAt;
    const formattedDate = dateStr
      ? `${new Date(dateStr).toLocaleDateString()} - ${new Date(dateStr).toLocaleTimeString()}`
      : 'Unknown date';

    return (
      <TouchableOpacity
        style={styles.videoCard}
        onPress={() => onPress(video)}
        activeOpacity={0.7}
      >
        {/* Left Border Accent */}
        <View style={styles.videoCardAccent} />

        <View style={styles.videoCardInner}>
          {/* Thumbnail Section */}
          <View style={styles.videoThumbnail}>
            <View style={styles.videoPlayIcon}>
              <Ionicons name="play" size={20} color={C.white} />
            </View>
            <View style={styles.videoOverlay}>
              <Text style={styles.videoExercise}>{exerciseLabel.toUpperCase()}</Text>
              <Text style={styles.videoStats}>{`${reps} REPS x ${weight}KG`}</Text>
            </View>
            <View style={styles.videoTypeTag}>
              <Ionicons
                name={video.source === 'challenge' ? 'trophy' : 'fitness'}
                size={10}
                color={C.white}
              />
              <Text style={styles.videoTypeText}>
                {video.source === 'challenge' ? 'CHALLENGE' : 'WORKOUT'}
              </Text>
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.videoInfo}>
            <View style={styles.videoHeader}>
              <View style={styles.videoUserSection}>
                <View style={styles.videoAvatar}>
                  <Text style={styles.videoAvatarText}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.videoUserName}>{userName}</Text>
                  {userHandle ? <Text style={styles.videoUserHandle}>{userHandle}</Text> : null}
                </View>
              </View>
              <View style={styles.videoPointsBadge}>
                <Text style={styles.videoPointsText}>{`~${Math.round(points)} XP`}</Text>
              </View>
            </View>

            <View style={styles.videoDetails}>
              <View style={styles.videoDetailItem}>
                <Ionicons name="barbell" size={12} color={C.textSubtle} />
                <Text style={styles.videoDetailText}>{exerciseLabel}</Text>
              </View>
              <View style={styles.videoDetailItem}>
                <Ionicons name="repeat" size={12} color={C.textSubtle} />
                <Text style={styles.videoDetailText}>{`${reps} reps`}</Text>
              </View>
              {weight > 0 ? (
                <View style={styles.videoDetailItem}>
                  <Ionicons name="fitness" size={12} color={C.textSubtle} />
                  <Text style={styles.videoDetailText}>{`${weight}kg`}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.videoActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(video)}
              >
                <Ionicons name="checkmark" size={16} color={C.white} />
                <Text style={styles.actionButtonText}>APPROVE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(video)}
              >
                <Ionicons name="close" size={16} color={C.white} />
                <Text style={styles.actionButtonText}>REJECT</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.videoDate}>{formattedDate.toUpperCase()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.pageTitle}>VIDEO QUEUE</Text>
          <Text style={styles.pageSubtitle}>PENDING VERIFICATION</Text>
        </View>
        <View style={styles.queueBadge}>
          <Text style={styles.queueCount}>{videos.length}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={C.textSubtle} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by exercise..."
          placeholderTextColor={C.textSubtle}
          value={filterExercise}
          onChangeText={setFilterExercise}
          autoCapitalize="none"
        />
        {filterExercise.length > 0 && (
          <TouchableOpacity onPress={() => setFilterExercise('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={C.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>TYPE</Text>
          {Object.values(SOURCE_FILTERS).map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[styles.filterChip, sourceFilter === filter.value && styles.filterChipActive]}
              onPress={() => setSourceFilter(filter.value)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={filter.icon}
                size={12}
                color={sourceFilter === filter.value ? C.white : C.textSubtle}
              />
              <Text style={[styles.filterChipText, sourceFilter === filter.value && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>DATE</Text>
          {Object.values(DATE_FILTERS).map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[styles.filterChip, dateFilter === filter.value && styles.filterChipActive]}
              onPress={() => setDateFilter(filter.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, dateFilter === filter.value && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reset Button */}
        {(sourceFilter !== 'all' || dateFilter !== 'all' || filterExercise.length > 0) && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setSourceFilter('all');
              setDateFilter('all');
              setFilterExercise('');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={12} color={C.accent} />
            <Text style={styles.resetButtonText}>RESET FILTERS</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Videos List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading pending videos...</Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="checkmark-done" size={48} color={C.success} />
          </View>
          <Text style={styles.emptyTitle}>ALL CAUGHT UP</Text>
          <Text style={styles.emptySubtext}>No pending videos to review</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {videos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              onPress={(v) => setSelectedVideo(v)}
            />
          ))}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Video Detail Modal */}
      <Modal visible={selectedVideo !== null} animationType="slide">
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.modalClose, { top: insets.top + S.md }]}
            onPress={() => {
              setSelectedVideo(null);
              setShowOriginal(false);
              if (videoRef.current) {
                videoRef.current.stopAsync();
              }
            }}
          >
            <Ionicons name="close" size={24} color={C.white} />
          </TouchableOpacity>

          {selectedVideo && (
            <>
              {/* Show Original Toggle - Only if video has originalUrl */}
              {selectedVideo.originalVideoUrl && (
                <TouchableOpacity
                  style={[styles.toggleOriginalBtn, showOriginal && styles.toggleOriginalBtnActive, { top: insets.top + S.md + 50 }]}
                  onPress={() => {
                    setShowOriginal(!showOriginal);
                    // Stop and restart video when switching
                    if (videoRef.current) {
                      videoRef.current.stopAsync();
                    }
                  }}
                >
                  <Ionicons
                    name={showOriginal ? "eye" : "eye-off"}
                    size={16}
                    color={showOriginal ? C.success : C.textSubtle}
                  />
                  <Text style={[styles.toggleOriginalText, showOriginal && { color: C.success }]}>
                    {showOriginal ? "SHOWING ORIGINAL" : "SHOWING BLURRED"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Video Player */}
              {selectedVideo.videoUrl ? (
                <Video
                  key={showOriginal ? 'original' : 'blurred'}
                  ref={videoRef}
                  source={{ uri: showOriginal && selectedVideo.originalVideoUrl ? selectedVideo.originalVideoUrl : selectedVideo.videoUrl }}
                  style={styles.videoPlayer}
                  useNativeControls
                  resizeMode="contain"
                  shouldPlay
                />
              ) : (
                <View style={styles.noVideoContainer}>
                  <Ionicons name="videocam-off" size={64} color={C.textSubtle} />
                  <Text style={styles.noVideoText}>VIDEO NOT AVAILABLE</Text>
                </View>
              )}

              {/* Video Info */}
              <View style={styles.modalInfo}>
                {/* User Info */}
                <View style={styles.modalUserSection}>
                  <View style={styles.modalAvatar}>
                    {selectedVideo.user?.profileImage ? (
                      <Image
                        source={{ uri: selectedVideo.user.profileImage }}
                        style={styles.modalAvatarImage}
                      />
                    ) : (
                      <Text style={styles.modalAvatarText}>
                        {String(selectedVideo.user?.name || '?')[0].toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.modalUserDetails}>
                    <Text style={styles.modalUserName}>{String(selectedVideo.user?.name || 'Unknown')}</Text>
                    <Text style={styles.modalUserHandle}>{`@${selectedVideo.user?.username || 'unknown'}`}</Text>
                    <View style={styles.modalUserStats}>
                      <View style={styles.modalStatBadge}>
                        <Text style={styles.modalStatText}>{`${Number(selectedVideo.user?.totalPoints || 0)} XP`}</Text>
                      </View>
                      <Text style={styles.modalStatSeparator}>|</Text>
                      <Text style={styles.modalStatText}>{`RANK ${Number(selectedVideo.user?.rank || 99)}`}</Text>
                      <Text style={styles.modalStatSeparator}>|</Text>
                      <Text style={styles.modalStatText}>{String(selectedVideo.user?.region || 'Global')}</Text>
                    </View>
                  </View>
                </View>

                {/* Workout Info Card */}
                <View style={styles.modalWorkoutCard}>
                  <Text style={styles.modalExerciseLabel}>EXERCISE</Text>
                  <Text style={styles.modalExercise}>
                    {String(selectedVideo.exercise || selectedVideo.challenge?.title || 'Challenge Submission').toUpperCase()}
                  </Text>
                  <View style={styles.modalStats}>
                    <View style={styles.modalStatItem}>
                      <Ionicons name="repeat" size={16} color={C.accent} />
                      <Text style={styles.modalStatValue}>{`${Number(selectedVideo.reps || 0)}`}</Text>
                      <Text style={styles.modalStatUnit}>REPS</Text>
                    </View>
                    {Number(selectedVideo.weight || 0) > 0 ? (
                      <View style={styles.modalStatItem}>
                        <Ionicons name="fitness" size={16} color={C.accent} />
                        <Text style={styles.modalStatValue}>{`${Number(selectedVideo.weight || 0)}`}</Text>
                        <Text style={styles.modalStatUnit}>KG</Text>
                      </View>
                    ) : null}
                    {selectedVideo.duration ? (
                      <View style={styles.modalStatItem}>
                        <Ionicons name="time" size={16} color={C.accent} />
                        <Text style={styles.modalStatValue}>
                          {`${Math.floor(Number(selectedVideo.duration) / 60)}:${(Number(selectedVideo.duration) % 60).toString().padStart(2, '0')}`}
                        </Text>
                        <Text style={styles.modalStatUnit}>DURATION</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalApproveButton]}
                    onPress={() => handleApprove(selectedVideo)}
                    disabled={verifying}
                  >
                    <Ionicons name="checkmark-circle" size={22} color={C.white} />
                    <Text style={styles.modalActionText}>APPROVE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalRejectButton]}
                    onPress={() => handleReject(selectedVideo)}
                    disabled={verifying}
                  >
                    <Ionicons name="close-circle" size={22} color={C.white} />
                    <Text style={styles.modalActionText}>REJECT</Text>
                  </TouchableOpacity>
                </View>

                {/* User's Video History */}
                {(selectedVideo.userVideoHistory?.length || 0) > 0 ? (
                  <View style={styles.modalHistory}>
                    <Text style={styles.modalHistoryTitle}>USER'S RECENT SUBMISSIONS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedVideo.userVideoHistory.map((historyVideo, index) => (
                        <View
                          key={historyVideo.id || historyVideo._id || String(index)}
                          style={[
                            styles.historyItem,
                            historyVideo.status === 'approved' ? styles.historyItemApproved : null,
                            historyVideo.status === 'rejected' ? styles.historyItemRejected : null,
                          ]}
                        >
                          <Text style={styles.historyExercise}>{String(historyVideo.exercise || 'Unknown').toUpperCase()}</Text>
                          <Text style={styles.historyStats}>{`${Number(historyVideo.reps || 0)} x ${Number(historyVideo.weight || 0)}kg`}</Text>
                          <View style={[styles.historyStatusBadge, historyVideo.status === 'approved' ? { backgroundColor: C.success } : historyVideo.status === 'rejected' ? { backgroundColor: C.danger } : null]}>
                            <Text style={styles.historyStatus}>{String(historyVideo.status || 'pending').toUpperCase()}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal visible={showRejectionModal} transparent animationType="fade">
        <View style={styles.rejectionModalOverlay}>
          <View style={styles.rejectionModalContent}>
            <View style={styles.rejectionModalHeader}>
              <Ionicons name="close-circle" size={32} color={C.danger} />
              <Text style={styles.rejectionModalTitle}>REJECT VIDEO</Text>
            </View>
            <Text style={styles.rejectionModalSubtitle}>
              Please provide a reason for rejection
            </Text>

            <TextInput
              style={styles.rejectionInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor={C.textSubtle}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              autoFocus
            />

            <View style={styles.rejectionModalButtons}>
              <TouchableOpacity
                style={[styles.rejectionModalButton, styles.rejectionCancelButton]}
                onPress={() => setShowRejectionModal(false)}
              >
                <Text style={styles.rejectionCancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectionModalButton, styles.rejectionConfirmButton]}
                onPress={confirmReject}
              >
                <Ionicons name="close" size={16} color={C.white} />
                <Text style={styles.rejectionConfirmButtonText}>REJECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Points Modal */}
      <Modal visible={showPointsModal} transparent animationType="fade">
        <View style={styles.rejectionModalOverlay}>
          <View style={styles.rejectionModalContent}>
            <View style={styles.rejectionModalHeader}>
              <Ionicons name="star" size={32} color={C.warning} />
              <Text style={styles.rejectionModalTitle}>SET CUSTOM POINTS</Text>
            </View>
            <Text style={styles.rejectionModalSubtitle}>
              Enter the points to award for this video
            </Text>

            <TextInput
              style={styles.rejectionInput}
              placeholder="Enter points..."
              placeholderTextColor={C.textSubtle}
              value={pointsOverride}
              onChangeText={setPointsOverride}
              keyboardType="number-pad"
              autoFocus
            />

            <View style={styles.rejectionModalButtons}>
              <TouchableOpacity
                style={[styles.rejectionModalButton, styles.rejectionCancelButton]}
                onPress={() => setShowPointsModal(false)}
              >
                <Text style={styles.rejectionCancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectionModalButton, styles.rejectionConfirmButton, { backgroundColor: C.success }]}
                onPress={confirmApproveWithPoints}
              >
                <Ionicons name="checkmark" size={16} color={C.white} />
                <Text style={styles.rejectionConfirmButtonText}>AWARD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerCenter: {
    flex: 1,
    marginLeft: S.md,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1.5,
  },
  pageSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 2,
    marginTop: 2,
  },
  queueBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.sm,
  },
  queueCount: {
    fontSize: 14,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 1,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: S.xl,
    marginVertical: S.lg,
    paddingHorizontal: S.md,
    borderRadius: R.sm,
    height: 44,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: { marginRight: S.sm },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
  },
  clearButton: { padding: S.xs },

  // Filters
  filtersContainer: {
    paddingHorizontal: S.xl,
    paddingBottom: S.md,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  filterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    width: 40,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: R.xs,
    marginRight: S.xs,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: C.white,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: C.accent,
    alignSelf: 'flex-start',
    marginTop: S.xs,
    gap: 4,
  },
  resetButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.accent,
    letterSpacing: 1,
  },

  // Center Container
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  loadingText: {
    marginTop: S.md,
    fontSize: 12,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 1,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.success,
    marginBottom: S.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 2,
    marginTop: S.md,
  },
  emptySubtext: {
    marginTop: S.xs,
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: S.xl, paddingBottom: S.xxl },
  bottomSpacer: { height: 40 },

  // Video Card
  videoCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...ADMIN_SHADOWS.card,
  },
  videoCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.accent,
  },
  videoCardInner: {
    flexDirection: 'row',
  },
  videoThumbnail: {
    width: 120,
    height: 140,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.white,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 8,
  },
  videoExercise: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accent,
    letterSpacing: 0.5,
  },
  videoStats: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    marginTop: 2,
  },
  videoTypeTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
    gap: 3,
  },
  videoTypeText: {
    fontSize: 8,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },

  // Video Info
  videoInfo: {
    flex: 1,
    padding: S.md,
    paddingLeft: S.lg,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S.sm,
  },
  videoUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  videoAvatar: {
    width: 28,
    height: 28,
    borderRadius: R.xs,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.sm,
  },
  videoAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.white,
  },
  videoUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  videoUserHandle: {
    fontSize: 10,
    color: C.textSubtle,
    marginTop: 1,
  },
  videoPointsBadge: {
    backgroundColor: C.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: C.accent,
  },
  videoPointsText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.accent,
    letterSpacing: 0.5,
  },
  videoDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: S.sm,
  },
  videoDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 4,
  },
  videoDetailText: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    marginLeft: 4,
  },
  videoActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: R.xs,
    gap: 4,
  },
  approveButton: {
    backgroundColor: C.success,
  },
  rejectButton: {
    backgroundColor: C.danger,
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  videoDate: {
    fontSize: 9,
    fontWeight: '600',
    color: C.textSubtle,
    marginTop: S.sm,
    letterSpacing: 0.5,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  modalClose: {
    position: 'absolute',
    right: S.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toggleOriginalBtn: {
    position: 'absolute',
    right: S.lg,
    backgroundColor: C.card,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    borderRadius: R.xs,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  toggleOriginalBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: C.success,
  },
  toggleOriginalText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: C.black,
  },
  noVideoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  noVideoText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
  },

  // Modal Info
  modalInfo: {
    flex: 1,
    backgroundColor: C.panel,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.xl,
    marginTop: -20,
  },
  modalUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.lg,
    paddingBottom: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: R.sm,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
    overflow: 'hidden',
  },
  modalAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: R.sm,
  },
  modalAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: C.white,
  },
  modalUserDetails: {
    flex: 1,
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    marginBottom: 2,
  },
  modalUserHandle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginBottom: 6,
  },
  modalUserStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalStatBadge: {
    backgroundColor: C.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.xs,
  },
  modalStatText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.5,
  },
  modalStatSeparator: {
    fontSize: 10,
    color: C.textSubtle,
    marginHorizontal: S.sm,
  },

  // Modal Workout Card
  modalWorkoutCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalExerciseLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  modalExercise: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    marginBottom: S.md,
  },
  modalStats: {
    flexDirection: 'row',
    gap: S.lg,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    marginTop: 4,
  },
  modalStatUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
    marginTop: 2,
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: S.md,
    marginBottom: S.lg,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: R.sm,
    gap: 6,
  },
  modalApproveButton: {
    backgroundColor: C.success,
  },
  modalRejectButton: {
    backgroundColor: C.danger,
  },
  modalActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 1,
  },

  // Modal History
  modalHistory: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalHistoryTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: S.sm,
  },
  historyItem: {
    backgroundColor: C.surface,
    borderRadius: R.sm,
    padding: S.sm,
    marginRight: S.sm,
    minWidth: 130,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyItemApproved: {
    borderColor: C.success,
    borderLeftWidth: 3,
  },
  historyItemRejected: {
    borderColor: C.danger,
    borderLeftWidth: 3,
  },
  historyExercise: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  historyStats: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    marginBottom: 6,
  },
  historyStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
    backgroundColor: C.surface,
  },
  historyStatus: {
    fontSize: 8,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
  },

  // Rejection Modal
  rejectionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
  },
  rejectionModalContent: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
    ...ADMIN_SHADOWS.card,
  },
  rejectionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
    gap: S.sm,
  },
  rejectionModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1,
  },
  rejectionModalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
    marginBottom: S.lg,
  },
  rejectionInput: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: S.md,
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.lg,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  rejectionModalButtons: {
    flexDirection: 'row',
    gap: S.md,
  },
  rejectionModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: R.sm,
    gap: 6,
  },
  rejectionCancelButton: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  rejectionConfirmButton: {
    backgroundColor: C.danger,
  },
  rejectionCancelButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
  },
  rejectionConfirmButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
});
