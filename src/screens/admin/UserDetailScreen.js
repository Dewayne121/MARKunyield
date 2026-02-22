import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import AccoladePickerModal from '../../components/AccoladePickerModal';
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

const REGIONS = ['Global', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'];
const GOALS = ['Hypertrophy', 'Leanness', 'Performance'];
const ACCOLADES = ['admin', 'community_support', 'beta', 'staff', 'verified_athlete', 'founding_member', 'challenge_master'];

// Accolade display labels
const ACCOLADE_LABELS = {
  admin: 'ADMIN',
  community_support: 'SUPPORT',
  beta: 'BETA TESTER',
  staff: 'STAFF',
  verified_athlete: 'VERIFIED ATHLETE',
  founding_member: 'FOUNDER',
  challenge_master: 'CHALLENGE MASTER',
};

const getAccoladeLabel = (accolade) => ACCOLADE_LABELS[accolade] || accolade.replace('_', ' ').toUpperCase();

export default function UserDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const { userId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [recentVideos, setRecentVideos] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAccoladePicker, setShowAccoladePicker] = useState(false);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/users/${userId}`);
      if (response?.success) {
        setUserData(response.data.user);
        setRecentWorkouts(response.data.recentWorkouts || []);
        setRecentVideos(response.data.recentVideos || []);
        setAuditLog(response.data.auditLog || []);
      } else {
        showAlert({
          title: 'Error',
          message: 'Failed to load user data',
          icon: 'error',
          buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
        });
      }
    } catch (err) {
      console.error('Error loading user:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to load user data',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const handleEdit = (field, currentValue) => {
    setEditField(field);
    setEditValue(currentValue?.toString() || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const updateData = {};

      switch (editField) {
        case 'name':
          updateData.name = editValue;
          break;
        case 'username':
          updateData.username = editValue;
          break;
        case 'email':
          updateData.email = editValue;
          break;
        case 'bio':
          updateData.bio = editValue;
          break;
        case 'weight':
          updateData.weight = parseFloat(editValue) || null;
          break;
        case 'height':
          updateData.height = parseFloat(editValue) || null;
          break;
        case 'age':
          updateData.age = parseInt(editValue) || null;
          break;
        case 'totalPoints':
          updateData.totalPoints = parseInt(editValue) || 0;
          break;
        case 'weeklyPoints':
          updateData.weeklyPoints = parseInt(editValue) || 0;
          break;
        case 'rank':
          updateData.rank = parseInt(editValue) || 99;
          break;
        case 'streak':
          updateData.streak = parseInt(editValue) || 0;
          break;
        case 'streakBest':
          updateData.streakBest = parseInt(editValue) || 0;
          break;
      }

      const response = await api.patch(`/api/admin/users/${userId}`, updateData);
      if (response?.success) {
        setUserData(response.data);
        setEditModalVisible(false);
        showAlert({
          title: 'Success',
          message: 'User updated successfully',
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      } else {
        showAlert({
          title: 'Error',
          message: 'Failed to update user',
          icon: 'error',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (err) {
      console.error('Error updating user:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to update user',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccolade = async (accolade) => {
    try {
      const hasAccolade = userData?.accolades?.includes(accolade);
      const response = hasAccolade
        ? await api.delete(`/api/admin/users/${userId}/accolades/${accolade}`)
        : await api.post(`/api/admin/users/${userId}/accolades`, { accolade });

      if (response?.success) {
        setUserData(prev => ({
          ...prev,
          accolades: response.data.accolades,
        }));
        showAlert({
          title: 'Success',
          message: hasAccolade ? 'Accolade removed' : 'Accolade added',
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      } else {
        showAlert({
          title: 'Error',
          message: 'Failed to update accolades',
          icon: 'error',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (err) {
      console.error('Error updating accolades:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to update accolades',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  };

  const handleOpenAccoladePicker = () => {
    setShowAccoladePicker(true);
  };

  const handleAccoladesUpdated = (updatedUser) => {
    setUserData(prev => ({ ...prev, ...updatedUser }));
  };

  const handleDeleteUser = () => {
    showAlert({
      title: 'Delete User',
      message: 'This will permanently delete this user and all their data. This action cannot be undone.',
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/admin/users/${userId}`);
              showAlert({
                title: 'Success',
                message: 'User deleted successfully',
                icon: 'success',
                buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
              });
            } catch (err) {
              console.error('Error deleting user:', err);
              showAlert({
                title: 'Error',
                message: err.message || 'Failed to delete user',
                icon: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
              });
            }
          },
        },
      ]
    });
  };

  const handleSendNotification = () => {
    showAlert({
      title: 'Send Notification',
      message: 'Send a notification to this user?',
      icon: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'default',
          onPress: () => {
            navigation.navigate('AdminSendNotification', { userId, userName: userData?.name });
          },
        },
      ]
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>USER DETAILS</Text>
            <Text style={styles.pageSubtitle}>Profile management</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>Loading user data...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>USER DETAILS</Text>
            <Text style={styles.pageSubtitle}>Profile management</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="person-outline" size={36} color={C.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>User not found</Text>
            <Text style={styles.emptySubtext}>The requested user does not exist</Text>
          </View>
        </View>
      </View>
    );
  }

  const InfoRow = ({ label, value, onEdit, editable = true, field, icon }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelContainer}>
        {icon && <Ionicons name={icon} size={14} color={C.textSubtle} style={styles.infoIcon} />}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <TouchableOpacity
        style={styles.infoValueContainer}
        onPress={editable && onEdit ? () => onEdit(field || label.toLowerCase(), value) : undefined}
        disabled={!editable || !onEdit}
      >
        <Text style={styles.infoValue}>{value ?? 'Not set'}</Text>
        {editable && onEdit && (
          <View style={styles.editIconContainer}>
            <Ionicons name="pencil" size={12} color={C.textSubtle} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const StatBox = ({ label, value, icon, color }) => (
    <View style={styles.statBox}>
      <View style={[styles.statBoxIcon, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.pageTitle}>USER DETAILS</Text>
          <Text style={styles.pageSubtitle}>Profile management</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSendNotification} style={styles.headerActionButton}>
            <Ionicons name="notifications-outline" size={18} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {userData.profileImage ? (
                <Image source={{ uri: userData.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {String(userData.name || userData.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{String(userData.name || 'Unknown')}</Text>
              <Text style={styles.profileHandle}>@{String(userData.username || 'unknown')}</Text>
              <View style={styles.profileBadges}>
                {userData.accolades?.map((accolade, index) => (
                  <View key={index} style={styles.accoladeBadge}>
                    <Ionicons name="shield" size={8} color={C.white} />
                    <Text style={styles.accoladeBadgeText}>{getAccoladeLabel(accolade)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteUser}>
            <Ionicons name="trash-outline" size={18} color={C.accent} />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>PERFORMANCE STATS</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Total XP" value={userData.totalPoints || 0} icon="trophy" color={C.warning} />
            <StatBox label="Weekly XP" value={userData.weeklyPoints || 0} icon="calendar" color={C.success} />
            <StatBox label="Rank" value={`#${userData.rank || 99}`} icon="medal" color={C.info} />
            <StatBox label="Streak" value={userData.streak || 0} icon="flame" color={C.danger} />
            <StatBox label="Best Streak" value={userData.streakBest || 0} icon="star" color={C.warning} />
            <StatBox label="Workouts" value={userData.workoutCount || 0} icon="fitness" color={C.info} />
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Name" value={userData.name} onEdit={handleEdit} field="name" icon="person" />
            <InfoRow label="Username" value={userData.username} onEdit={handleEdit} field="username" icon="at" />
            <InfoRow label="Email" value={userData.email} onEdit={handleEdit} field="email" icon="mail" />
            <InfoRow label="Bio" value={userData.bio} onEdit={handleEdit} field="bio" icon="text" />
            <InfoRow label="Weight (kg)" value={userData.weight} onEdit={handleEdit} field="weight" icon="barbell" />
            <InfoRow label="Height (cm)" value={userData.height} onEdit={handleEdit} field="height" icon="resize" />
            <InfoRow label="Age" value={userData.age} onEdit={handleEdit} field="age" icon="calendar-number" />

            {/* Region Selector */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="location" size={14} color={C.textSubtle} style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Region</Text>
              </View>
              <View style={styles.dropdownContainer}>
                {REGIONS.map(region => (
                  <TouchableOpacity
                    key={region}
                    style={[
                      styles.dropdownItem,
                      userData.region === region && styles.dropdownItemSelected,
                    ]}
                    onPress={async () => {
                      try {
                        await api.patch(`/api/admin/users/${userId}`, { region });
                        setUserData(prev => ({ ...prev, region }));
                      } catch (err) {
                        showAlert({
                          title: 'Error',
                          message: 'Failed to update region',
                          icon: 'error',
                          buttons: [{ text: 'OK', style: 'default' }]
                        });
                      }
                    }}
                  >
                    <Text style={[styles.dropdownItemText, userData.region === region && styles.dropdownItemTextSelected]}>
                      {region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Goal Selector */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="flag" size={14} color={C.textSubtle} style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Goal</Text>
              </View>
              <View style={styles.dropdownContainer}>
                {GOALS.map(goal => (
                  <TouchableOpacity
                    key={goal}
                    style={[
                      styles.dropdownItem,
                      userData.goal === goal && styles.dropdownItemSelected,
                    ]}
                    onPress={async () => {
                      try {
                        await api.patch(`/api/admin/users/${userId}`, { goal });
                        setUserData(prev => ({ ...prev, goal }));
                      } catch (err) {
                        showAlert({
                          title: 'Error',
                          message: 'Failed to update goal',
                          icon: 'error',
                          buttons: [{ text: 'OK', style: 'default' }]
                        });
                      }
                    }}
                  >
                    <Text style={[styles.dropdownItemText, userData.goal === goal && styles.dropdownItemTextSelected]}>
                      {goal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <InfoRow label="Provider" value={userData.provider} editable={false} icon="key" />
            <InfoRow
              label="Joined"
              value={new Date(userData.createdAt).toLocaleDateString()}
              editable={false}
              icon="calendar"
            />
          </View>
        </View>

        {/* Game Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GAME STATS</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Total Points" value={userData.totalPoints} onEdit={handleEdit} field="totalPoints" icon="star" />
            <InfoRow label="Weekly Points" value={userData.weeklyPoints} onEdit={handleEdit} field="weeklyPoints" icon="trending-up" />
            <InfoRow label="Rank" value={userData.rank} onEdit={handleEdit} field="rank" icon="medal" />
            <InfoRow label="Streak" value={userData.streak} onEdit={handleEdit} field="streak" icon="flame" />
            <InfoRow label="Best Streak" value={userData.streakBest} onEdit={handleEdit} field="streakBest" icon="ribbon" />
          </View>
        </View>

        {/* Accolades Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOLADES</Text>
          <View style={styles.accoladesCard}>
            <View style={styles.accoladesDisplay}>
              {userData.accolades?.map((accolade, index) => (
                <View key={index} style={styles.accoladeBadgeLarge}>
                  <Ionicons name="shield-checkmark" size={12} color={C.white} />
                  <Text style={styles.accoladeBadgeTextLarge}>{getAccoladeLabel(accolade)}</Text>
                </View>
              ))}
              {(!userData.accolades || userData.accolades.length === 0) && (
                <Text style={styles.noAccoladesText}>No accolades assigned</Text>
              )}
            </View>
            <TouchableOpacity style={styles.manageAccoladesButton} onPress={handleOpenAccoladePicker}>
              <Ionicons name="shield-checkmark" size={18} color={C.accent} />
              <Text style={styles.manageAccoladesText}>Manage Accolades</Text>
              <Ionicons name="chevron-forward" size={16} color={C.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Video Stats */}
        {userData.videos && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIDEO SUBMISSIONS</Text>
            <View style={styles.videoStats}>
              <View style={styles.videoStatItem}>
                <Text style={styles.videoStatValue}>{userData.videos.total || 0}</Text>
                <Text style={styles.videoStatLabel}>Total</Text>
              </View>
              <View style={styles.videoStatDivider} />
              <View style={styles.videoStatItem}>
                <Text style={[styles.videoStatValue, { color: C.warning }]}>
                  {userData.videos.pending || 0}
                </Text>
                <Text style={styles.videoStatLabel}>Pending</Text>
              </View>
              <View style={styles.videoStatDivider} />
              <View style={styles.videoStatItem}>
                <Text style={[styles.videoStatValue, { color: C.success }]}>
                  {userData.videos.approved || 0}
                </Text>
                <Text style={styles.videoStatLabel}>Approved</Text>
              </View>
              <View style={styles.videoStatDivider} />
              <View style={styles.videoStatItem}>
                <Text style={[styles.videoStatValue, { color: C.danger }]}>
                  {userData.videos.rejected || 0}
                </Text>
                <Text style={styles.videoStatLabel}>Rejected</Text>
              </View>
            </View>
          </View>
        )}

        {/* Audit Log */}
        {auditLog.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AUDIT LOG</Text>
            <View style={styles.auditLog}>
              {auditLog.map((log, index) => (
                <View key={index} style={styles.auditLogItem}>
                  <View style={styles.auditLogHeader}>
                    <View style={styles.auditLogActionContainer}>
                      <Ionicons name="document-text" size={12} color={C.accent} />
                      <Text style={styles.auditLogAction}>{log.action.replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={styles.auditLogDate}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  {log.admin && (
                    <Text style={styles.auditLogAdmin}>By: {log.admin.name || log.admin.username}</Text>
                  )}
                  {log.details && (
                    <View style={styles.auditLogDetailsContainer}>
                      <Text style={styles.auditLogDetails}>
                        {JSON.stringify(log.details, null, 2)}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editField}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={C.textSubtle} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, editField === 'bio' && styles.modalInputMultiline]}
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
              multiline={editField === 'bio'}
              numberOfLines={editField === 'bio' ? 4 : 1}
              keyboardType={
                ['weight', 'height', 'age'].includes(editField?.toLowerCase())
                  ? 'decimal-pad'
                  : ['totalpoints', 'weeklypoints', 'rank', 'streak', 'streakbest'].includes(editField?.toLowerCase())
                  ? 'number-pad'
                  : 'default'
              }
              placeholder={`Enter ${editField}...`}
              placeholderTextColor={C.textSubtle}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color={C.white} />
                    <Text style={styles.modalButtonTextSave}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Accolade Picker Modal */}
      <AccoladePickerModal
        visible={showAccoladePicker}
        onClose={() => setShowAccoladePicker(false)}
        userId={userData?.id || userData?._id}
        currentAccolades={userData?.accolades || []}
        onAccoladesUpdated={handleAccoladesUpdated}
        api={api}
      />

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  headerRight: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    gap: S.sm,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: S.md,
    fontSize: 13,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: S.xxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: S.sm,
    letterSpacing: 0.3,
  },
  emptySubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: S.xxl,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: S.lg,
    backgroundColor: C.card,
    marginHorizontal: S.xl,
    marginTop: S.lg,
    marginBottom: S.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: S.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: R.lg,
    borderWidth: 2,
    borderColor: C.border,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: R.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.border,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 1,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  profileHandle: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  accoladeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  accoladeBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${C.accent}40`,
  },
  statsSection: {
    paddingHorizontal: S.xl,
    marginBottom: S.lg,
  },
  section: {
    paddingHorizontal: S.xl,
    marginBottom: S.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: S.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '31%',
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  statBoxIcon: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.5,
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textSubtle,
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 0.2,
  },
  editIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: C.panel,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  dropdownItemSelected: {
    backgroundColor: C.accentSoft,
    borderColor: C.accent,
  },
  dropdownItemText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  dropdownItemTextSelected: {
    color: C.accent,
    fontWeight: '700',
  },
  accoladesCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  accoladesDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: S.md,
    minHeight: 32,
  },
  accoladeBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.sm,
    gap: 6,
  },
  accoladeBadgeTextLarge: {
    fontSize: 10,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  noAccoladesText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSubtle,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  manageAccoladesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    gap: 10,
  },
  manageAccoladesText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.3,
  },
  videoStats: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  videoStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  videoStatDivider: {
    width: 1,
    height: '100%',
    backgroundColor: C.border,
    marginHorizontal: S.sm,
  },
  videoStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.5,
  },
  videoStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSubtle,
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  auditLog: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  auditLogItem: {
    padding: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  auditLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  auditLogActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditLogAction: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  auditLogDate: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  auditLogAdmin: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  auditLogDetailsContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: C.surface,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  auditLogDetails: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    fontFamily: T.mono.fontFamily,
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: S.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
  },
  modalContent: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInput: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: 14,
    fontSize: 14,
    fontWeight: '500',
    color: C.text,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    letterSpacing: 0.2,
  },
  modalInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: R.md,
    gap: 6,
  },
  modalButtonCancel: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalButtonSave: {
    backgroundColor: C.accent,
  },
  modalButtonTextCancel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.3,
  },
  modalButtonTextSave: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
  },
});
