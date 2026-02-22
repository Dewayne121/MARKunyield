import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import api from '../../services/api';
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
  { value: 'pending', label: 'Pending', icon: 'time' },
  { value: 'approved', label: 'Approved', icon: 'checkmark-circle' },
  { value: 'denied', label: 'Denied', icon: 'close-circle' },
  { value: 'all', label: 'All', icon: 'list' },
];

export default function AppealsManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appeals, setAppeals] = useState([]);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  const loadAppeals = async () => {
    try {
      setLoading(true);
      const queryParams = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await api.get(`/api/admin/appeals${queryParams}`);
      if (response?.success) {
        setAppeals(response.data.appeals);
      }
    } catch (err) {
      console.error('Error loading appeals:', err);
      showAlert({
        title: 'Error',
        message: 'Failed to load appeals',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, [statusFilter]);

  const handleReview = async (appeal, action) => {
    try {
      const response = await api.post(`/api/admin/appeals/${appeal._id}/review`, {
        action,
        reviewNotes,
      });
      if (response?.success) {
        setAppeals(prev => prev.filter(a => a._id !== appeal._id));
        setShowReviewModal(false);
        setReviewNotes('');
        showAlert({
          title: 'Success',
          message: `Appeal ${action}ed`,
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to review appeal',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return C.warning;
      case 'approved': return C.success;
      case 'denied': return C.danger;
      default: return C.textSubtle;
    }
  };

  const AppealCard = ({ appeal, onPress }) => (
    <TouchableOpacity style={styles.appealCard} onPress={() => onPress(appeal)} activeOpacity={0.7}>
      {/* Left Accent */}
      <View style={[styles.appealCardAccent, { backgroundColor: getStatusColor(appeal.status) }]} />

      <View style={styles.appealCardInner}>
        {/* Header */}
        <View style={styles.appealHeader}>
          <View style={styles.appealUserInfo}>
            <View style={styles.appealAvatar}>
              <Text style={styles.appealAvatarText}>
                {(appeal.user?.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.appealUserName}>{appeal.user?.name || 'Unknown'}</Text>
              <Text style={styles.appealUserHandle}>@{appeal.user?.username || 'unknown'}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appeal.status) }]}>
            <Ionicons
              name={appeal.status === 'pending' ? 'time' : appeal.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={C.white}
            />
            <Text style={styles.statusText}>{appeal.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Video Info */}
        <View style={styles.appealVideoInfo}>
          <View style={styles.videoInfoRow}>
            <Ionicons name="videocam" size={14} color={C.accent} />
            <Text style={styles.appealVideoText}>{appeal.videoSubmission?.exercise || 'Unknown Exercise'}</Text>
          </View>
          <View style={styles.videoInfoRow}>
            <Ionicons name="barbell" size={12} color={C.textSubtle} />
            <Text style={styles.appealVideoStats}>
              {appeal.videoSubmission?.reps || 0} reps x {appeal.videoSubmission?.weight || 0}kg
            </Text>
          </View>
        </View>

        {/* Reason */}
        <View style={styles.appealReasonContainer}>
          <Text style={styles.appealReasonLabel}>APPEAL REASON</Text>
          <Text style={styles.appealReason} numberOfLines={2}>{appeal.reason}</Text>
        </View>

        {/* Date */}
        <Text style={styles.appealDate}>
          {new Date(appeal.createdAt).toLocaleString().toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.pageTitle}>APPEALS</Text>
          <Text style={styles.pageSubtitle}>MANAGE REJECTION APPEALS</Text>
        </View>
        <View style={styles.headerRight}>
          {appeals.filter(a => a.status === 'pending').length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingCount}>{appeals.filter(a => a.status === 'pending').length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>STATUS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[styles.filterChip, statusFilter === filter.value && styles.filterChipActive]}
              onPress={() => setStatusFilter(filter.value)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={filter.icon}
                size={12}
                color={statusFilter === filter.value ? C.white : C.textSubtle}
              />
              <Text style={[styles.filterChipText, statusFilter === filter.value && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading appeals...</Text>
        </View>
      ) : appeals.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="checkmark-done" size={48} color={C.success} />
          </View>
          <Text style={styles.emptyTitle}>NO APPEALS FOUND</Text>
          <Text style={styles.emptySubtext}>
            {statusFilter === 'pending' ? 'No pending appeals to review' : 'No appeals match the selected filter'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {appeals.map(appeal => (
            <AppealCard
              key={appeal._id}
              appeal={appeal}
              onPress={(a) => {
                setSelectedAppeal(a);
                setShowReviewModal(true);
              }}
            />
          ))}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedAppeal && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Ionicons name="document-text" size={28} color={C.accent} />
                  <Text style={styles.modalTitle}>REVIEW APPEAL</Text>
                </View>

                {/* User Info */}
                <View style={styles.modalUserCard}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {(selectedAppeal.user?.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.modalUserName}>{selectedAppeal.user?.name}</Text>
                    <Text style={styles.modalUserHandle}>@{selectedAppeal.user?.username}</Text>
                  </View>
                </View>

                {/* Video Info */}
                <View style={styles.modalVideoInfo}>
                  <Text style={styles.modalVideoLabel}>VIDEO SUBMISSION</Text>
                  <View style={styles.modalVideoDetails}>
                    <Ionicons name="fitness" size={16} color={C.accent} />
                    <Text style={styles.modalVideoExercise}>{selectedAppeal.videoSubmission?.exercise}</Text>
                  </View>
                  <Text style={styles.modalVideoStats}>
                    {selectedAppeal.videoSubmission?.reps} reps x {selectedAppeal.videoSubmission?.weight || 0}kg
                  </Text>
                </View>

                {/* Appeal Reason */}
                <View style={styles.modalReasonSection}>
                  <Text style={styles.modalReasonLabel}>APPEAL REASON</Text>
                  <Text style={styles.modalReason}>{selectedAppeal.reason}</Text>
                </View>

                {/* Review Notes */}
                <View style={styles.modalNotesSection}>
                  <Text style={styles.modalNotesLabel}>REVIEW NOTES (OPTIONAL)</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Add any notes about your decision..."
                    placeholderTextColor={C.textSubtle}
                    value={reviewNotes}
                    onChangeText={setReviewNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.approveButton]}
                    onPress={() => handleReview(selectedAppeal, 'approve')}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={C.white} />
                    <Text style={styles.modalButtonText}>APPROVE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.denyButton]}
                    onPress={() => handleReview(selectedAppeal, 'deny')}
                  >
                    <Ionicons name="close-circle" size={18} color={C.white} />
                    <Text style={styles.modalButtonText}>DENY</Text>
                  </TouchableOpacity>
                </View>

                {/* Close Button */}
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowReviewModal(false)}>
                  <Text style={styles.closeButtonText}>CANCEL</Text>
                </TouchableOpacity>
              </>
            )}
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
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  pendingBadge: {
    backgroundColor: C.warning,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.sm,
  },
  pendingCount: {
    fontSize: 12,
    fontWeight: '900',
    color: C.black,
    letterSpacing: 0.5,
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
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: C.white,
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: S.xl, paddingBottom: S.xxl },
  bottomSpacer: { height: 40 },

  // Appeal Card
  appealCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...ADMIN_SHADOWS.card,
  },
  appealCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  appealCardInner: {
    padding: S.md,
    paddingLeft: S.lg,
    marginLeft: 4,
  },
  appealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.md,
  },
  appealUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appealAvatar: {
    width: 32,
    height: 32,
    borderRadius: R.xs,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.sm,
  },
  appealAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
  },
  appealUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  appealUserHandle: {
    fontSize: 10,
    color: C.textSubtle,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.xs,
    gap: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },

  // Video Info
  appealVideoInfo: {
    backgroundColor: C.panel,
    borderRadius: R.xs,
    padding: S.sm,
    marginBottom: S.md,
  },
  videoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  appealVideoText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginLeft: 6,
  },
  appealVideoStats: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginLeft: 6,
  },

  // Reason
  appealReasonContainer: {
    marginBottom: S.sm,
  },
  appealReasonLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  appealReason: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    lineHeight: 18,
  },

  // Date
  appealDate: {
    fontSize: 9,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
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
    marginBottom: S.lg,
    gap: S.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1,
  },

  // Modal User Card
  modalUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: S.md,
    marginBottom: S.md,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: R.xs,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
  },
  modalAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
  },
  modalUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  modalUserHandle: {
    fontSize: 11,
    color: C.textSubtle,
    marginTop: 1,
  },

  // Modal Video Info
  modalVideoInfo: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: S.md,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalVideoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  modalVideoDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalVideoExercise: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginLeft: 6,
  },
  modalVideoStats: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
  },

  // Modal Reason
  modalReasonSection: {
    marginBottom: S.md,
  },
  modalReasonLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  modalReason: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    lineHeight: 18,
    backgroundColor: C.panel,
    borderRadius: R.xs,
    padding: S.md,
  },

  // Modal Notes
  modalNotesSection: {
    marginBottom: S.lg,
  },
  modalNotesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: S.md,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 13,
    fontWeight: '500',
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: S.md,
    marginBottom: S.md,
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
  approveButton: {
    backgroundColor: C.success,
  },
  denyButton: {
    backgroundColor: C.danger,
  },
  modalButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  closeButton: {
    paddingVertical: S.sm,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
  },
});
