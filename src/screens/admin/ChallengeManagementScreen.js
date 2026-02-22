import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video } from 'expo-av';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import api from '../../services/api';
import { COMPETITIVE_LIFTS, getCompetitiveLiftLabel } from '../../constants/competitiveLifts';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_TYPOGRAPHY,
  ADMIN_SHADOWS,
  ADMIN_SURFACES,
} from '../../constants/adminTheme';

const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;
const T = ADMIN_TYPOGRAPHY;

const STATUS_FILTERS = [
  { value: 'active', label: 'Active', icon: 'checkmark-circle' },
  { value: 'ended', label: 'Ended', icon: 'time' },
  { value: 'inactive', label: 'Inactive', icon: 'pause-circle' },
  { value: 'all', label: 'All', icon: 'list' },
];

export default function ChallengeManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const getChallengeId = (item) => item?.id || item?._id || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('challenges'); // 'challenges' or 'queue'
  const [challenges, setChallenges] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('active');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    if (activeTab === 'challenges') {
      loadChallenges();
    } else {
      loadSubmissionsQueue();
    }
  }, [activeTab, selectedFilter]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const response = await api.getAdminChallenges({
        page: 1,
        limit: 50,
        status: selectedFilter,
      });

      if (response.success) {
        setChallenges(response.data || []);
        setPagination(response.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
      } else {
        setChallenges([]);
      }
    } catch (err) {
      console.error('Error loading challenges:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to load challenges',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      setChallenges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSubmissionsQueue = async () => {
    console.log('[ADMIN CHALLENGE] Loading submissions queue...');
    try {
      setLoading(true);
      // Get pending submissions from all active challenges
      const response = await api.getPendingChallengeSubmissions({
        limit: 50,
      });

      console.log('[ADMIN CHALLENGE] Response:', {
        success: response.success,
        count: response.data?.length || 0,
        pagination: response.pagination
      });

      if (response.success) {
        console.log('[ADMIN CHALLENGE] Submissions loaded:', response.data?.length || 0);
        setSubmissions(response.data || []);
      } else {
        console.error('[ADMIN CHALLENGE] Response not successful');
        setSubmissions([]);
      }
    } catch (err) {
      console.error('[ADMIN CHALLENGE] Error loading submissions:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to load submissions',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      setSubmissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'challenges') {
      loadChallenges();
    } else {
      loadSubmissionsQueue();
    }
  };

  const handleDeleteChallenge = (challenge) => {
    showAlert({
      title: 'Delete Challenge',
      message: `Are you sure you want to delete "${challenge.title}"? This action cannot be undone.`,
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const challengeId = getChallengeId(challenge);
              if (!challengeId) {
                showAlert({
                  title: 'Error',
                  message: 'Challenge ID is missing',
                  icon: 'error',
                  buttons: [{ text: 'OK', style: 'default' }]
                });
                return;
              }
              const response = await api.deleteChallenge(challengeId);
              if (response.success) {
                showAlert({
                  title: 'Success',
                  message: 'Challenge deleted successfully',
                  icon: 'success',
                  buttons: [{ text: 'OK', style: 'default' }]
                });
                loadChallenges();
              }
            } catch (err) {
              showAlert({
                title: 'Error',
                message: err.message || 'Failed to delete challenge',
                icon: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
              });
            }
          },
        },
      ]
    });
  };

  const handleToggleActive = async (challenge) => {
    try {
      const challengeId = getChallengeId(challenge);
      if (!challengeId) {
        showAlert({
          title: 'Error',
          message: 'Challenge ID is missing',
          icon: 'error',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        return;
      }
      const response = await api.updateChallenge(challengeId, {
        isActive: !challenge.isActive,
      });
      if (response.success) {
        showAlert({
          title: 'Success',
          message: `Challenge ${challenge.isActive ? 'deactivated' : 'activated'}`,
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        loadChallenges();
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to update challenge',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const handleVerifySubmission = async (submission, action) => {
    if (action === 'reject' && !rejectionReason.trim()) {
      showAlert({
        title: 'Required',
        message: 'Please enter a rejection reason',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }

    try {
      setVerifying(true);
      const response = await api.verifyChallengeSubmission(
        submission.id,
        action,
        rejectionReason
      );

      if (response.success) {
        showAlert({
          title: 'Success',
          message: response.message || 'Submission verified',
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
        setShowVerifyModal(false);
        setRejectionReason('');
        setSelectedSubmission(null);
        loadSubmissionsQueue();
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to verify submission',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setVerifying(false);
    }
  };

  const openVerifyModal = (submission) => {
    setSelectedSubmission(submission);
    setRejectionReason('');
    setShowVerifyModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return C.success;
      case 'ended': return C.textSubtle;
      case 'inactive': return C.warning;
      default: return C.textSubtle;
    }
  };

  const getStatusLabel = (challenge) => {
    const now = new Date();
    const endDate = new Date(challenge.endDate);
    if (!challenge.isActive) return 'Inactive';
    if (endDate < now) return 'Ended';
    return 'Active';
  };

  const renderChallengeCard = (challenge) => {
    const challengeId = getChallengeId(challenge);
    const liftId = challenge.exercises?.[0];
    const liftName = getCompetitiveLiftLabel(liftId) || liftId || 'Unknown Lift';
    const targetWeight = challenge.target ? `${challenge.target}kg` : 'No target set';
    const statusLabel = getStatusLabel(challenge);

    return (
      <View key={challengeId || challenge.title} style={styles.card}>
        {/* Left Accent */}
        <View style={[styles.cardAccent, { backgroundColor: getStatusColor(statusLabel) }]} />

        <View style={styles.cardInner}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.liftBadge}>
                <Ionicons name="barbell" size={12} color={C.accent} />
                <Text style={styles.liftBadgeText}>{liftName.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardTitle}>{challenge.title}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(statusLabel) }]}>
              <Ionicons
                name={statusLabel === 'Active' ? 'checkmark-circle' : statusLabel === 'Ended' ? 'time' : 'pause-circle'}
                size={10}
                color={C.white}
              />
              <Text style={styles.statusText}>{statusLabel.toUpperCase()}</Text>
            </View>
          </View>

          {/* Target Row */}
          <View style={styles.targetRow}>
            <View style={styles.targetBadge}>
              <Ionicons name="trophy" size={14} color={C.warning} />
              <Text style={styles.targetText}>{targetWeight}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.cardDescription} numberOfLines={2}>
            {challenge.description}
          </Text>

          {/* Stats */}
          <View style={styles.cardStats}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={14} color={C.textSubtle} />
              <Text style={styles.statText}>{challenge.participantCount || 0} participants</Text>
            </View>
            {challenge.pendingSubmissions > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="time" size={14} color={C.warning} />
                <Text style={[styles.statText, { color: C.warning }]}>{challenge.pendingSubmissions} pending</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Ionicons name="gift" size={14} color={C.success} />
              <Text style={styles.statText}>{challenge.reward} pts reward</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => navigation.navigate('AdminChallengeBuilder', { challenge, isEdit: true })}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={14} color={C.white} />
              <Text style={styles.actionButtonText}>EDIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.toggleButton]}
              onPress={() => handleToggleActive(challenge)}
              activeOpacity={0.7}
            >
              <Ionicons name={challenge.isActive ? "pause" : "play"} size={14} color={C.text} />
              <Text style={styles.actionButtonText}>{challenge.isActive ? 'PAUSE' : 'START'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteChallenge(challenge)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={14} color={C.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSubmissionCard = (submission) => (
    <View key={submission.id} style={styles.card}>
      {/* Left Accent - Warning for pending */}
      <View style={[styles.cardAccent, { backgroundColor: C.warning }]} />

      <View style={styles.cardInner}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            {submission.user.profileImage ? (
              <Image source={{ uri: submission.user.profileImage }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, { backgroundColor: C.surface }]}>
                <Text style={styles.avatarText}>{(submission.user.name || 'U')[0].toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.cardTitle}>{submission.user.name}</Text>
              <Text style={styles.cardSubtitle}>@{submission.user.username}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: C.warning }]}>
            <Ionicons name="time" size={10} color={C.black} />
            <Text style={[styles.statusText, { color: C.black }]}>PENDING</Text>
          </View>
        </View>

        {/* Challenge Tag */}
        <View style={styles.challengeTag}>
          <Ionicons name="trophy" size={12} color={C.warning} />
          <Text style={styles.challengeTagName}>{submission.challenge?.title || 'Unknown Challenge'}</Text>
        </View>

        {/* Submission Details */}
        <View style={styles.submissionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>EXERCISE</Text>
            <Text style={styles.detailValue}>{submission.exercise}</Text>
          </View>
          <View style={styles.detailRowInline}>
            {submission.reps > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>REPS</Text>
                <Text style={styles.detailValue}>{submission.reps}</Text>
              </View>
            )}
            {submission.weight > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>WEIGHT</Text>
                <Text style={styles.detailValue}>{submission.weight}kg</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>VALUE</Text>
              <Text style={styles.detailValue}>{submission.value}</Text>
            </View>
          </View>
        </View>

        {/* Video Button */}
        {submission.videoUrl && (
          <TouchableOpacity
            style={styles.videoButton}
            onPress={() => {/* Navigate to video player */}}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle" size={18} color={C.accent} />
            <Text style={styles.videoButtonText}>WATCH VIDEO</Text>
          </TouchableOpacity>
        )}

        {/* Notes */}
        {submission.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Text style={styles.notesText}>{submission.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton, { flex: 1 }]}
            onPress={() => handleVerifySubmission(submission, 'approve')}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle" size={16} color={C.white} />
            <Text style={styles.actionButtonText}>APPROVE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, { flex: 1 }]}
            onPress={() => openVerifyModal(submission)}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={16} color={C.white} />
            <Text style={styles.actionButtonText}>REJECT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + S.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.pageTitle}>CHALLENGE MANAGEMENT</Text>
          <Text style={styles.pageSubtitle}>MANAGE & VERIFY</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('AdminChallengeBuilder')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color={C.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenges' && styles.tabActive]}
          onPress={() => setActiveTab('challenges')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trophy"
            size={14}
            color={activeTab === 'challenges' ? C.accent : C.textSubtle}
          />
          <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>
            CHALLENGES
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'queue' && styles.tabActive]}
          onPress={() => setActiveTab('queue')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="clipboard"
            size={14}
            color={activeTab === 'queue' ? C.accent : C.textSubtle}
          />
          <Text style={[styles.tabText, activeTab === 'queue' && styles.tabTextActive]}>
            VERIFICATION QUEUE
          </Text>
          {submissions.length > 0 && activeTab !== 'queue' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{submissions.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips - only for challenges tab */}
      {activeTab === 'challenges' && (
        <View style={styles.filtersContainer}>
          <Text style={styles.filterLabel}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[styles.filterChip, selectedFilter === filter.value && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={filter.icon}
                  size={12}
                  color={selectedFilter === filter.value ? C.white : C.textSubtle}
                />
                <Text style={[styles.filterChipText, selectedFilter === filter.value && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'challenges' ? (
            challenges.length > 0 ? (
              challenges.map(renderChallengeCard)
            ) : (
              <View style={styles.centerContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="trophy-outline" size={48} color={C.textSubtle} />
                </View>
                <Text style={styles.emptyTitle}>NO CHALLENGES FOUND</Text>
                <Text style={styles.emptySubtext}>Create a new challenge to get started</Text>
              </View>
            )
          ) : (
            submissions.length > 0 ? (
              submissions.map(renderSubmissionCard)
            ) : (
              <View style={styles.centerContainer}>
                <View style={[styles.emptyIconContainer, { borderColor: C.success }]}>
                  <Ionicons name="checkmark-done" size={48} color={C.success} />
                </View>
                <Text style={styles.emptyTitle}>ALL CAUGHT UP</Text>
                <Text style={styles.emptySubtext}>No pending submissions to review</Text>
              </View>
            )
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Rejection Modal */}
      <Modal visible={showVerifyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBadge}>
                <Ionicons name="close-circle" size={24} color={C.danger} />
              </View>
              <Text style={styles.modalTitle}>REJECT SUBMISSION</Text>
            </View>

            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejection
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor={C.textSubtle}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowVerifyModal(false);
                  setRejectionReason('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={() => handleVerifySubmission(selectedSubmission, 'reject')}
                disabled={verifying}
                activeOpacity={0.7}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <>
                    <Ionicons name="close" size={16} color={C.white} />
                    <Text style={styles.modalRejectText}>REJECT</Text>
                  </>
                )}
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
    fontSize: 16,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1,
  },
  pageSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 2,
    marginTop: 2,
  },
  createButton: {
    backgroundColor: C.accent,
    width: 40,
    height: 40,
    borderRadius: R.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: S.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    borderBottomColor: C.accent,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: C.text,
  },
  tabBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.white,
  },

  // Filters
  filtersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginRight: S.sm,
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
    letterSpacing: 0.3,
  },
  filterChipTextActive: {
    color: C.white,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: S.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
    minHeight: 300,
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
    borderColor: C.textSubtle,
    marginBottom: S.md,
  },
  emptyTitle: {
    fontSize: 18,
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
  bottomSpacer: {
    height: 40,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: R.md,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...ADMIN_SHADOWS.card,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.success,
  },
  cardInner: {
    padding: S.md,
    paddingLeft: S.lg,
    marginLeft: 4,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S.sm,
  },
  cardTitleRow: {
    flex: 1,
    marginRight: S.sm,
  },
  liftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent + '15',
    borderRadius: R.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  liftBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accent,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: C.textSubtle,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.xs,
    gap: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },

  // Target Row
  targetRow: {
    marginBottom: S.sm,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.warning + '15',
    borderRadius: R.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 6,
  },
  targetText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.warning,
  },

  // Card Description
  cardDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    marginBottom: S.sm,
    lineHeight: 17,
  },

  // Card Stats
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: S.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  statText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '600',
    color: C.textSubtle,
  },

  // Challenge Tag
  challengeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: S.sm,
    alignSelf: 'flex-start',
    gap: 6,
  },
  challengeTagName: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text,
  },

  // Submission Details
  submissionDetails: {
    backgroundColor: C.panel,
    borderRadius: R.xs,
    padding: S.sm,
    marginBottom: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  detailRow: {
    marginBottom: 8,
  },
  detailRowInline: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },

  // Video Button
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel,
    borderRadius: R.xs,
    padding: S.sm,
    marginBottom: S.sm,
    borderWidth: 1,
    borderColor: C.accent + '40',
    gap: 6,
  },
  videoButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.5,
  },

  // Notes
  notesContainer: {
    marginBottom: S.sm,
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    fontStyle: 'italic',
  },

  // User Info
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: R.xs,
    marginRight: S.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.accent,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderRadius: R.xs,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  editButton: {
    backgroundColor: C.info,
    borderColor: C.info,
  },
  toggleButton: {
    flex: 1,
  },
  deleteButton: {
    backgroundColor: C.danger,
    borderColor: C.danger,
  },
  approveButton: {
    backgroundColor: C.success,
    borderColor: C.success,
  },
  rejectButton: {
    backgroundColor: C.danger,
    borderColor: C.danger,
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
  },
  modalContent: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
    ...ADMIN_SHADOWS.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.md,
    gap: S.sm,
  },
  modalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.danger + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
    marginBottom: S.lg,
  },
  textInput: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: S.md,
    color: C.text,
    fontSize: 13,
    fontWeight: '500',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: S.md,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: R.sm,
    gap: 6,
  },
  modalCancelButton: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalRejectButton: {
    backgroundColor: C.danger,
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
  },
  modalRejectText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
});
