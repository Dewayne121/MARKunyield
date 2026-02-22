import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
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

const REPORT_TYPES = [
  { value: 'suspicious_lift', label: 'Suspicious Lift', icon: 'alert-circle' },
  { value: 'fake_video', label: 'Fake Video', icon: 'videocam-off' },
  { value: 'inappropriate', label: 'Inappropriate', icon: 'ban' },
  { value: 'spam', label: 'Spam', icon: 'chatbubbles' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending', icon: 'time' },
  { value: 'resolved', label: 'Resolved', icon: 'checkmark-circle' },
  { value: 'dismissed', label: 'Dismissed', icon: 'remove-circle' },
  { value: 'all', label: 'All', icon: 'list' },
];

const ACTION_OPTIONS = [
  { value: 'no_action', label: 'No Action', icon: 'remove' },
  { value: 'warning_issued', label: 'Warning', icon: 'warning' },
  { value: 'video_removed', label: 'Remove Video', icon: 'trash' },
  { value: 'user_suspended', label: 'Suspend User', icon: 'person-remove' },
];

export default function ReportsManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('no_action');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');

  const loadReports = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter && { reportType: typeFilter }),
      }).toString();

      const response = await api.get(`/api/admin/reports${queryParams ? '?' + queryParams : ''}`);
      if (response?.success) {
        setReports(response.data.reports);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
      showAlert({
        title: 'Error',
        message: 'Failed to load reports',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter, typeFilter]);

  const handleReview = async (report, action) => {
    try {
      const response = await api.post(`/api/admin/reports/${report._id}/review`, {
        action,
        reviewNotes,
        actionTaken: action === 'resolve' ? actionTaken : 'no_action',
      });
      if (response?.success) {
        setReports(prev => prev.filter(r => r._id !== report._id));
        setShowReviewModal(false);
        setReviewNotes('');
        setActionTaken('no_action');
        showAlert({
          title: 'Success',
          message: `Report ${action}d`,
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to review report',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return C.warning;
      case 'resolved': return C.success;
      case 'dismissed': return C.textSubtle;
      default: return C.textSubtle;
    }
  };

  const getReportTypeData = (type) => {
    return REPORT_TYPES.find(t => t.value === type) || REPORT_TYPES[REPORT_TYPES.length - 1];
  };

  const ReportCard = ({ report, onPress }) => {
    const typeData = getReportTypeData(report.reportType);

    return (
      <TouchableOpacity style={styles.reportCard} onPress={() => onPress(report)} activeOpacity={0.7}>
        {/* Left Accent - Red for reports */}
        <View style={styles.reportCardAccent} />

        <View style={styles.reportCardInner}>
          {/* Header */}
          <View style={styles.reportHeader}>
            <View style={[styles.reportTypeBadge, { backgroundColor: C.danger + '20' }]}>
              <Ionicons name={typeData.icon} size={14} color={C.danger} />
              <Text style={styles.reportTypeText}>{report.reportType.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
              <Ionicons
                name={report.status === 'pending' ? 'time' : report.status === 'resolved' ? 'checkmark-circle' : 'remove-circle'}
                size={10}
                color={C.white}
              />
              <Text style={styles.statusText}>{report.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Reporter Info */}
          <View style={styles.reporterRow}>
            <Ionicons name="person" size={12} color={C.textSubtle} />
            <Text style={styles.reporterText}>Reported by: {report.reporter?.name || 'Unknown'}</Text>
          </View>

          {/* Reason */}
          <View style={styles.reportReasonContainer}>
            <Text style={styles.reportReasonLabel}>REASON</Text>
            <Text style={styles.reportReason} numberOfLines={3}>{report.reason}</Text>
          </View>

          {/* Video Info */}
          {report.videoSubmission && (
            <View style={styles.reportVideoInfo}>
              <View style={styles.videoInfoRow}>
                <Ionicons name="videocam" size={12} color={C.accent} />
                <Text style={styles.reportVideoText}>{report.videoSubmission?.exercise || 'Unknown exercise'}</Text>
              </View>
              <Text style={styles.reportVideoStats}>
                {report.videoSubmission?.reps || 0} reps x {report.videoSubmission?.weight || 0}kg
              </Text>
            </View>
          )}

          {/* Date */}
          <Text style={styles.reportDate}>
            {new Date(report.createdAt).toLocaleString().toUpperCase()}
          </Text>
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
          <Text style={styles.pageTitle}>REPORTS</Text>
          <Text style={styles.pageSubtitle}>USER REPORTED CONTENT</Text>
        </View>
        <View style={styles.headerRight}>
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingCount}>{reports.filter(r => r.status === 'pending').length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filters Section */}
      <View style={styles.filtersSection}>
        {/* Status Filters */}
        <View style={styles.filterRow}>
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

        {/* Type Filters */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, typeFilter === '' && styles.filterChipActive]}
              onPress={() => setTypeFilter('')}
              activeOpacity={0.7}
            >
              <Ionicons name="grid" size={12} color={typeFilter === '' ? C.white : C.textSubtle} />
              <Text style={[styles.filterChipText, typeFilter === '' && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.filterChip, typeFilter === type.value && styles.filterChipActive]}
                onPress={() => setTypeFilter(type.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={type.icon}
                  size={12}
                  color={typeFilter === type.value ? C.white : C.textSubtle}
                />
                <Text style={[styles.filterChipText, typeFilter === type.value && styles.filterChipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="shield-checkmark" size={48} color={C.success} />
          </View>
          <Text style={styles.emptyTitle}>NO REPORTS FOUND</Text>
          <Text style={styles.emptySubtext}>
            {statusFilter === 'pending' ? 'No pending reports to review' : 'No reports match the selected filters'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {reports.map(report => (
            <ReportCard
              key={report._id}
              report={report}
              onPress={(r) => {
                setSelectedReport(r);
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
            {selectedReport && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalTypeBadge}>
                    <Ionicons name={getReportTypeData(selectedReport.reportType).icon} size={20} color={C.danger} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>REVIEW REPORT</Text>
                    <Text style={styles.modalTypeLabel}>
                      {selectedReport.reportType.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Reporter Info */}
                <View style={styles.modalReporterRow}>
                  <Ionicons name="person-outline" size={14} color={C.textSubtle} />
                  <Text style={styles.modalReporterText}>Reported by: {selectedReport.reporter?.name || 'Unknown'}</Text>
                </View>

                {/* Reason */}
                <View style={styles.modalReasonSection}>
                  <Text style={styles.modalReasonLabel}>REPORT REASON</Text>
                  <Text style={styles.modalReason}>{selectedReport.reason}</Text>
                </View>

                {/* Video Info */}
                {selectedReport.videoSubmission && (
                  <View style={styles.modalVideoInfo}>
                    <Text style={styles.modalVideoLabel}>REPORTED CONTENT</Text>
                    <View style={styles.modalVideoDetails}>
                      <Ionicons name="fitness" size={16} color={C.accent} />
                      <Text style={styles.modalVideoExercise}>{selectedReport.videoSubmission.exercise}</Text>
                    </View>
                    <Text style={styles.modalVideoStats}>
                      {selectedReport.videoSubmission.reps} reps x {selectedReport.videoSubmission.weight || 0}kg
                    </Text>
                  </View>
                )}

                {/* Action Selection */}
                <View style={styles.modalActionSection}>
                  <Text style={styles.modalActionLabel}>ACTION TAKEN</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {ACTION_OPTIONS.map((action) => (
                      <TouchableOpacity
                        key={action.value}
                        style={[styles.actionChip, actionTaken === action.value && styles.actionChipActive]}
                        onPress={() => setActionTaken(action.value)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={action.icon}
                          size={12}
                          color={actionTaken === action.value ? C.white : C.textSubtle}
                        />
                        <Text style={[styles.actionChipText, actionTaken === action.value && styles.actionChipTextActive]}>
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Notes Input */}
                <View style={styles.modalNotesSection}>
                  <Text style={styles.modalNotesLabel}>REVIEW NOTES (OPTIONAL)</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Add notes about your decision..."
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
                    style={[styles.modalButton, styles.dismissButton]}
                    onPress={() => handleReview(selectedReport, 'dismiss')}
                  >
                    <Ionicons name="remove-circle" size={18} color={C.white} />
                    <Text style={styles.modalButtonText}>DISMISS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.resolveButton]}
                    onPress={() => handleReview(selectedReport, 'resolve')}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={C.white} />
                    <Text style={styles.modalButtonText}>RESOLVE</Text>
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
    backgroundColor: C.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.sm,
  },
  pendingCount: {
    fontSize: 12,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 0.5,
  },

  // Filters
  filtersSection: {
    backgroundColor: C.panel,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
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
    width: 50,
    marginRight: S.xs,
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

  // Report Card
  reportCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...ADMIN_SHADOWS.card,
  },
  reportCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.danger,
  },
  reportCardInner: {
    padding: S.md,
    paddingLeft: S.lg,
    marginLeft: 4,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  reportTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.xs,
    gap: 4,
  },
  reportTypeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.danger,
    letterSpacing: 0.5,
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

  // Reporter Row
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  reporterText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginLeft: 6,
  },

  // Reason
  reportReasonContainer: {
    marginBottom: S.sm,
  },
  reportReasonLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  reportReason: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    lineHeight: 18,
  },

  // Video Info
  reportVideoInfo: {
    backgroundColor: C.panel,
    borderRadius: R.xs,
    padding: S.sm,
    marginBottom: S.sm,
  },
  videoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportVideoText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
    marginLeft: 6,
  },
  reportVideoStats: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
  },

  // Date
  reportDate: {
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
    marginBottom: S.md,
    gap: S.sm,
  },
  modalTypeBadge: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.danger + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1,
  },
  modalTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.danger,
    letterSpacing: 1,
    marginTop: 2,
  },
  modalReporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.md,
  },
  modalReporterText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
    marginLeft: 6,
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

  // Modal Video
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

  // Modal Action
  modalActionSection: {
    marginBottom: S.md,
  },
  modalActionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: 6,
    backgroundColor: C.panel,
    borderRadius: R.xs,
    marginRight: S.xs,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  actionChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  actionChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  actionChipTextActive: {
    color: C.white,
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
  dismissButton: {
    backgroundColor: C.textSubtle,
  },
  resolveButton: {
    backgroundColor: C.success,
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
